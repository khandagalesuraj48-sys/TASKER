-- ==============================================================================
-- Migration: 008_enterprise_task_collaboration.sql
-- Application: TASKER Enterprise Operating System
-- Scope: Personal vs Workplace Task Scope, Task Assignment Engine, 
--        Strict RLS Isolation, Assignment History, Notifications,
--        and Secure Hashed Token Read-Only Task Sharing.
-- Non-Destructive: All existing personal tasks, users, and owner data preserved.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Functions (Security Definer)
-- ------------------------------------------------------------------------------

-- Check if current authenticated user is a member or owner of the organization
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL OR check_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = check_org_id AND o.owner_id = v_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.org_id = check_org_id AND m.user_id = v_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated;

-- Check if current user is an org owner, admin, or project manager
CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL OR check_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = check_org_id AND o.owner_id = v_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.org_id = check_org_id 
          AND m.user_id = v_user_id 
          AND m.role IN ('org_owner', 'org_admin', 'project_manager')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. Additive Schema Updates on Tasks & ERP Employees
-- ------------------------------------------------------------------------------

-- Add scope, assigned_to, and assigned_employee_id to tasks
ALTER TABLE public.tasks 
    ADD COLUMN IF NOT EXISTS scope VARCHAR(16) NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'workplace')),
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_employee_id UUID REFERENCES public.erp_employees(id) ON DELETE SET NULL;

-- Backfill legacy records: default existing tasks to personal
UPDATE public.tasks SET scope = 'personal' WHERE scope IS NULL;
UPDATE public.tasks SET scope = 'workplace' WHERE org_id IS NOT NULL AND scope = 'personal';

-- Performance Indexes for Tasks Scope & Assignment
CREATE INDEX IF NOT EXISTS idx_tasks_scope_user ON public.tasks(scope, user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_scope_org ON public.tasks(scope, org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_employee ON public.tasks(assigned_employee_id);

-- Add user_id link to erp_employees table
ALTER TABLE public.erp_employees 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_erp_employees_user ON public.erp_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_erp_employees_org ON public.erp_employees(org_id);

-- ------------------------------------------------------------------------------
-- 3. Task Assignment History Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_employee_id UUID REFERENCES public.erp_employees(id) ON DELETE SET NULL,
    assigned_to_name TEXT,
    remark TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'reassigned', 'cancelled')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON public.task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_org ON public.task_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to ON public.task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_by ON public.task_assignments(assigned_by);

-- ------------------------------------------------------------------------------
-- 4. In-App Notifications Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(32) DEFAULT 'task',
    entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. Secure Read-Only Task Share Links (Token Hash)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    allow_attachments BOOLEAN NOT NULL DEFAULT false,
    view_count INT NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_task_share_links_token ON public.task_share_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_task_share_links_task ON public.task_share_links(task_id);

-- ------------------------------------------------------------------------------
-- 6. Public Shared Task Retrieval Function (Security Definer)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_shared_task_public(p_token_hash TEXT)
RETURNS JSONB AS $$
DECLARE
    v_link RECORD;
    v_task RECORD;
    v_attachments JSONB := '[]'::jsonb;
BEGIN
    IF p_token_hash IS NULL OR trim(p_token_hash) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid token');
    END IF;

    -- Lookup share link
    SELECT * INTO v_link
    FROM public.task_share_links
    WHERE token_hash = p_token_hash
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;

    IF v_link.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Share link is expired, inactive, or not found');
    END IF;

    -- Fetch task record
    SELECT 
        id, title, description, status, priority, due_date, 
        person_name, scope, created_at, updated_at
    INTO v_task
    FROM public.tasks
    WHERE id = v_link.task_id AND is_deleted = false;

    IF v_task.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Task not found or has been deleted');
    END IF;

    -- Update usage statistics
    UPDATE public.task_share_links
    SET view_count = view_count + 1,
        last_accessed_at = now()
    WHERE id = v_link.id;

    -- Fetch attachments if allowed
    IF v_link.allow_attachments = true THEN
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', a.id,
                    'file_name', a.file_name,
                    'file_size', a.file_size,
                    'file_type', a.file_type,
                    'file_path', a.file_path,
                    'created_at', a.created_at
                )
            ), '[]'::jsonb
        )
        INTO v_attachments
        FROM public.task_attachments a
        WHERE a.task_id = v_task.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'task', jsonb_build_object(
            'id', v_task.id,
            'title', v_task.title,
            'description', v_task.description,
            'status', v_task.status,
            'priority', v_task.priority,
            'due_date', v_task.due_date,
            'person_name', v_task.person_name,
            'scope', v_task.scope,
            'created_at', v_task.created_at,
            'updated_at', v_task.updated_at
        ),
        'allow_attachments', v_link.allow_attachments,
        'attachments', v_attachments,
        'expires_at', v_link.expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_shared_task_public(TEXT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 7. Trigger: Workplace Task Assignment & Notification Automation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_task_assignment_event()
RETURNS TRIGGER AS $$
DECLARE
    v_assigner_id UUID := COALESCE(auth.uid(), NEW.user_id);
    v_target_name TEXT := NEW.person_name;
BEGIN
    -- Only process workplace tasks with an organization
    IF NEW.scope = 'workplace' AND NEW.org_id IS NOT NULL THEN
        -- Resolve employee name if employee_id provided but person_name empty
        IF NEW.assigned_employee_id IS NOT NULL AND (v_target_name IS NULL OR v_target_name = '') THEN
            SELECT (first_name || ' ' || COALESCE(last_name, '')) INTO v_target_name
            FROM public.erp_employees
            WHERE id = NEW.assigned_employee_id;
        END IF;

        -- On INSERT: if assigned, record in task_assignments and notify
        IF (TG_OP = 'INSERT') THEN
            IF NEW.assigned_to IS NOT NULL OR NEW.assigned_employee_id IS NOT NULL THEN
                INSERT INTO public.task_assignments (
                    task_id, org_id, assigned_by, assigned_to, 
                    assigned_employee_id, assigned_to_name, remark, status
                ) VALUES (
                    NEW.id, NEW.org_id, v_assigner_id, NEW.assigned_to,
                    NEW.assigned_employee_id, v_target_name, 'Initial task assignment', 'assigned'
                );

                -- In-App Notification to assigned user
                IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != v_assigner_id THEN
                    INSERT INTO public.notifications (
                        recipient_user_id, organization_id, type, title, message, entity_type, entity_id
                    ) VALUES (
                        NEW.assigned_to,
                        NEW.org_id,
                        'task_assigned',
                        'New Task Assigned: ' || NEW.title,
                        'You have been assigned task "' || NEW.title || '". Priority: ' || NEW.priority,
                        'task',
                        NEW.id
                    );
                END IF;
            END IF;

        -- On UPDATE: detect change in assignment
        ELSIF (TG_OP = 'UPDATE') THEN
            IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to OR OLD.assigned_employee_id IS DISTINCT FROM NEW.assigned_employee_id) THEN
                -- Mark previous active assignment as reassigned
                UPDATE public.task_assignments
                SET status = 'reassigned'
                WHERE task_id = NEW.id AND status IN ('assigned', 'in_progress');

                -- Insert new assignment entry
                INSERT INTO public.task_assignments (
                    task_id, org_id, assigned_by, assigned_to, 
                    assigned_employee_id, assigned_to_name, remark, status
                ) VALUES (
                    NEW.id, NEW.org_id, v_assigner_id, NEW.assigned_to,
                    NEW.assigned_employee_id, v_target_name, 'Task reassigned', 'assigned'
                );

                -- In-App Notification to newly assigned user
                IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != v_assigner_id THEN
                    INSERT INTO public.notifications (
                        recipient_user_id, organization_id, type, title, message, entity_type, entity_id
                    ) VALUES (
                        NEW.assigned_to,
                        NEW.org_id,
                        'task_reassigned',
                        'Task Assigned to You: ' || NEW.title,
                        'Task "' || NEW.title || '" has been reassigned to you.',
                        'task',
                        NEW.id
                    );
                END IF;
            END IF;

            -- On task completion notify assigner if assigned user completed it
            IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed') THEN
                IF NEW.user_id != v_assigner_id THEN
                    INSERT INTO public.notifications (
                        recipient_user_id, organization_id, type, title, message, entity_type, entity_id
                    ) VALUES (
                        NEW.user_id,
                        NEW.org_id,
                        'task_completed',
                        'Task Completed: ' || NEW.title,
                        'Task "' || NEW.title || '" was marked as completed.',
                        'task',
                        NEW.id
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_task_assignment_event ON public.tasks;
CREATE TRIGGER trg_task_assignment_event
    AFTER INSERT OR UPDATE OF assigned_to, assigned_employee_id, status
    ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_task_assignment_event();

-- ------------------------------------------------------------------------------
-- 8. Dual-Scope Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. Tasks Dual-Scope RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

-- SELECT: Personal tasks are strictly creator-only.
-- Workplace tasks are visible only to creator, assigned user, or org admin.
CREATE POLICY "Users can read own tasks"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (
        (COALESCE(scope, 'personal') = 'personal' AND user_id = auth.uid())
        OR
        (
            scope = 'workplace'
            AND org_id IS NOT NULL
            AND public.is_org_member(org_id)
            AND (
                user_id = auth.uid()
                OR assigned_to = auth.uid()
                OR public.is_org_admin(org_id)
            )
        )
    );

-- INSERT: User creates personal task for self, or workplace task for org they belong to
CREATE POLICY "Users can insert own tasks"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (
        (COALESCE(scope, 'personal') = 'personal' AND user_id = auth.uid())
        OR
        (
            scope = 'workplace'
            AND org_id IS NOT NULL
            AND user_id = auth.uid()
            AND public.is_org_member(org_id)
        )
    );

-- UPDATE: Personal task by owner. Workplace task by creator, assigned user, or org admin.
CREATE POLICY "Users can update own tasks"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (
        (COALESCE(scope, 'personal') = 'personal' AND user_id = auth.uid())
        OR
        (
            scope = 'workplace'
            AND org_id IS NOT NULL
            AND public.is_org_member(org_id)
            AND (
                user_id = auth.uid()
                OR assigned_to = auth.uid()
                OR public.is_org_admin(org_id)
            )
        )
    )
    WITH CHECK (
        (COALESCE(scope, 'personal') = 'personal' AND user_id = auth.uid())
        OR
        (
            scope = 'workplace'
            AND org_id IS NOT NULL
            AND public.is_org_member(org_id)
            AND (
                user_id = auth.uid()
                OR assigned_to = auth.uid()
                OR public.is_org_admin(org_id)
            )
        )
    );

-- DELETE: Personal task by owner. Workplace task ONLY by creator or org admin.
CREATE POLICY "Users can delete own tasks"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (
        (COALESCE(scope, 'personal') = 'personal' AND user_id = auth.uid())
        OR
        (
            scope = 'workplace'
            AND org_id IS NOT NULL
            AND public.is_org_member(org_id)
            AND (
                user_id = auth.uid()
                OR public.is_org_admin(org_id)
            )
        )
    );

-- ------------------------------------------------------------------------------
-- B. Task Assignments RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view task assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Members can insert task assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Members can update task assignments" ON public.task_assignments;

CREATE POLICY "Members can view task assignments"
    ON public.task_assignments FOR SELECT
    TO authenticated
    USING (
        public.is_org_member(org_id)
        AND (
            public.is_org_admin(org_id)
            OR assigned_to = auth.uid()
            OR assigned_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.tasks t
                WHERE t.id = task_assignments.task_id
                  AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid() OR public.is_org_admin(t.org_id))
            )
        )
    );

CREATE POLICY "Members can insert task assignments"
    ON public.task_assignments FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_org_member(org_id)
    );

CREATE POLICY "Members can update task assignments"
    ON public.task_assignments FOR UPDATE
    TO authenticated
    USING (
        public.is_org_member(org_id)
        AND (
            assigned_to = auth.uid()
            OR assigned_by = auth.uid()
            OR public.is_org_admin(org_id)
        )
    );

-- ------------------------------------------------------------------------------
-- C. Notifications RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (recipient_user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (recipient_user_id = auth.uid())
    WITH CHECK (recipient_user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    TO authenticated
    USING (recipient_user_id = auth.uid());

CREATE POLICY "Authenticated can insert notifications"
    ON public.notifications FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------------------------
-- D. Task Share Links RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view share links for visible tasks" ON public.task_share_links;
DROP POLICY IF EXISTS "Users can create share links" ON public.task_share_links;
DROP POLICY IF EXISTS "Users can modify own share links" ON public.task_share_links;
DROP POLICY IF EXISTS "Users can delete own share links" ON public.task_share_links;

CREATE POLICY "Users can view share links for visible tasks"
    ON public.task_share_links FOR SELECT
    TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_share_links.task_id
              AND t.scope = 'workplace'
              AND public.is_org_admin(t.org_id)
        )
    );

CREATE POLICY "Users can create share links"
    ON public.task_share_links FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_share_links.task_id
              AND (
                (COALESCE(t.scope, 'personal') = 'personal' AND t.user_id = auth.uid())
                OR
                (t.scope = 'workplace' AND public.is_org_member(t.org_id) AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid() OR public.is_org_admin(t.org_id)))
              )
        )
    );

CREATE POLICY "Users can modify own share links"
    ON public.task_share_links FOR UPDATE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_share_links.task_id
              AND t.scope = 'workplace'
              AND public.is_org_admin(t.org_id)
        )
    );

CREATE POLICY "Users can delete own share links"
    ON public.task_share_links FOR DELETE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_share_links.task_id
              AND t.scope = 'workplace'
              AND public.is_org_admin(t.org_id)
        )
    );

-- ------------------------------------------------------------------------------
-- E. ERP Employees Directory RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view employees" ON public.erp_employees;
DROP POLICY IF EXISTS "Org admins can manage employees" ON public.erp_employees;

CREATE POLICY "Org members can view employees"
    ON public.erp_employees FOR SELECT
    TO authenticated
    USING (public.is_org_member(org_id));

CREATE POLICY "Org admins can manage employees"
    ON public.erp_employees FOR ALL
    TO authenticated
    USING (public.is_org_admin(org_id))
    WITH CHECK (public.is_org_admin(org_id));

-- ------------------------------------------------------------------------------
-- F. Task Status History, Notes, Attachments RLS Updates
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own task history" ON public.task_status_history;
DROP POLICY IF EXISTS "Users can insert own task history" ON public.task_status_history;
DROP POLICY IF EXISTS "Users can delete own task history" ON public.task_status_history;

CREATE POLICY "Users can read own task history"
    ON public.task_status_history FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_status_history.task_id
              AND t.scope = 'workplace'
              AND public.is_org_member(t.org_id)
              AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid() OR public.is_org_admin(t.org_id))
        )
    );

CREATE POLICY "Users can insert own task history"
    ON public.task_status_history FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND (
            task_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.tasks t
                WHERE t.id = task_status_history.task_id
                  AND (
                    (COALESCE(t.scope, 'personal') = 'personal' AND t.user_id = auth.uid())
                    OR
                    (t.scope = 'workplace' AND public.is_org_member(t.org_id) AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid() OR public.is_org_admin(t.org_id)))
                  )
            )
        )
    );

CREATE POLICY "Users can delete own task history"
    ON public.task_status_history FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Task Notes
DROP POLICY IF EXISTS "Users can read own task notes" ON public.task_notes;
DROP POLICY IF EXISTS "Users can insert own task notes" ON public.task_notes;
DROP POLICY IF EXISTS "Users can update own task notes" ON public.task_notes;
DROP POLICY IF EXISTS "Users can delete own task notes" ON public.task_notes;

CREATE POLICY "Users can read own task notes"
    ON public.task_notes FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_notes.task_id
              AND t.scope = 'workplace'
              AND public.is_org_member(t.org_id)
              AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid() OR public.is_org_admin(t.org_id))
        )
    );

CREATE POLICY "Users can insert own task notes"
    ON public.task_notes FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_notes.task_id
              AND (
                (COALESCE(t.scope, 'personal') = 'personal' AND t.user_id = auth.uid())
                OR
                (t.scope = 'workplace' AND public.is_org_member(t.org_id) AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid() OR public.is_org_admin(t.org_id)))
              )
        )
    );

CREATE POLICY "Users can update own task notes"
    ON public.task_notes FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own task notes"
    ON public.task_notes FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Task Attachments
DROP POLICY IF EXISTS "Users can read own task attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can insert own task attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can delete own task attachments" ON public.task_attachments;

CREATE POLICY "Users can read own task attachments"
    ON public.task_attachments FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_attachments.task_id
              AND t.scope = 'workplace'
              AND public.is_org_member(t.org_id)
              AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid() OR public.is_org_admin(t.org_id))
        )
    );

CREATE POLICY "Users can insert own task attachments"
    ON public.task_attachments FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_attachments.task_id
              AND (
                (COALESCE(t.scope, 'personal') = 'personal' AND t.user_id = auth.uid())
                OR
                (t.scope = 'workplace' AND public.is_org_member(t.org_id) AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid() OR public.is_org_admin(t.org_id)))
              )
        )
    );

CREATE POLICY "Users can delete own task attachments"
    ON public.task_attachments FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_attachments.task_id
              AND t.scope = 'workplace'
              AND public.is_org_admin(t.org_id)
        )
    );

-- ------------------------------------------------------------------------------
-- G. Storage Objects Dual-Scope Access for task-attachments
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can select own task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own task-attachments" ON storage.objects;

CREATE POLICY "Users can select own task-attachments"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'task-attachments' AND (
            -- User-scoped paths: users/:userId/...
            ((storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text)
            OR
            -- Task-scoped paths: tasks/:taskId/...
            EXISTS (
                SELECT 1 FROM public.tasks t
                WHERE t.id::text = (storage.foldername(name))[2]
                AND (
                    (COALESCE(t.scope, 'personal') = 'personal' AND t.user_id = auth.uid())
                    OR
                    (
                        t.scope = 'workplace' 
                        AND public.is_org_member(t.org_id) 
                        AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid() OR public.is_org_admin(t.org_id))
                    )
                )
            )
        )
    );

CREATE POLICY "Users can upload own task-attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL
    );

CREATE POLICY "Users can delete own task-attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'task-attachments' AND (
            ((storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text)
            OR
            EXISTS (
                SELECT 1 FROM public.tasks t
                WHERE t.id::text = (storage.foldername(name))[2]
                AND (
                    (COALESCE(t.scope, 'personal') = 'personal' AND t.user_id = auth.uid())
                    OR
                    (
                        t.scope = 'workplace' 
                        AND public.is_org_member(t.org_id) 
                        AND (t.user_id = auth.uid() OR public.is_org_admin(t.org_id))
                    )
                )
            )
        )
    );

