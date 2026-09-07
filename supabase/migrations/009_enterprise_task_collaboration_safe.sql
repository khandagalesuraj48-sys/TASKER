-- ==============================================================================
-- Migration: 009_enterprise_task_collaboration_safe.sql
-- Application: TASKER Enterprise Operating System
-- Target Organization: SAMAJ RACHANA CONSTRUCTION LIMITED
-- Super Admin / Owner: khandagalesuraj48@gmail.com
--
-- Scope:
-- 1. Self-contained Enterprise Organization, Membership, and Employee Directory
-- 2. Dual-Scope Tasks (Personal vs Workplace) with Strict Isolation
-- 3. Workplace Assignment Visibility: Assigner + Assignee + Admin ONLY (User C BLOCKED)
-- 4. Audit-Grade Task Assignment History (Preserving Reassignment Chains)
-- 5. In-App Notifications with Trigger-Driven Realtime Delivery
-- 6. Secure SHA-256 Hashed Read-Only Task Share Links (RPC get_shared_task_public)
-- 7. Zero-Loss Data Preservation for all existing tasks, notes, history, and attachments
--    (Exact column compatibility with remote: storage_path, uploaded_at)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Enterprise Organization, Departments & Memberships
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name TEXT NOT NULL,
    trade_name TEXT,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    fiscal_year_start_month INT NOT NULL DEFAULT 4,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_id);

CREATE TABLE IF NOT EXISTS public.org_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_departments_org ON public.org_departments(org_id);

CREATE TABLE IF NOT EXISTS public.erp_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.org_departments(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT,
    employee_code VARCHAR(32) NOT NULL,
    designation TEXT NOT NULL,
    phone VARCHAR(20),
    email TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'resigned', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_employees_org ON public.erp_employees(org_id);
CREATE INDEX IF NOT EXISTS idx_erp_employees_user ON public.erp_employees(user_id);

CREATE TABLE IF NOT EXISTS public.org_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'team_member' CHECK (role IN (
        'org_owner', 'org_admin', 'project_manager', 'team_member', 'viewer'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_org_membership_user_org UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.org_memberships(org_id);

-- ------------------------------------------------------------------------------
-- 2. Bootstrap SAMAJ RACHANA CONSTRUCTION LIMITED & Owner Admin
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_owner_user_id UUID;
    v_org_id UUID;
BEGIN
    -- Locate existing owner user by email
    SELECT id INTO v_owner_user_id 
    FROM auth.users 
    WHERE email = 'khandagalesuraj48@gmail.com'
    LIMIT 1;

    -- If the owner user exists in auth.users, associate the organization
    IF v_owner_user_id IS NOT NULL THEN
        -- Check if organization already exists
        SELECT id INTO v_org_id 
        FROM public.organizations 
        WHERE legal_name = 'SAMAJ RACHANA CONSTRUCTION LIMITED'
        LIMIT 1;

        IF v_org_id IS NULL THEN
            INSERT INTO public.organizations (legal_name, trade_name, owner_id, currency, is_active)
            VALUES ('SAMAJ RACHANA CONSTRUCTION LIMITED', 'SAMAJ RACHANA', v_owner_user_id, 'INR', true)
            RETURNING id INTO v_org_id;
        ELSE
            UPDATE public.organizations 
            SET owner_id = v_owner_user_id, updated_at = now() 
            WHERE id = v_org_id;
        END IF;

        -- Ensure owner has 'org_owner' membership
        INSERT INTO public.org_memberships (user_id, org_id, role)
        VALUES (v_owner_user_id, v_org_id, 'org_owner')
        ON CONFLICT (user_id, org_id) 
        DO UPDATE SET role = 'org_owner';

        -- Ensure owner is in erp_employees directory
        IF NOT EXISTS (SELECT 1 FROM public.erp_employees WHERE org_id = v_org_id AND user_id = v_owner_user_id) THEN
            INSERT INTO public.erp_employees (org_id, user_id, first_name, last_name, employee_code, designation, email, status)
            VALUES (v_org_id, v_owner_user_id, 'Suraj', 'Khandagale', 'EMP-001', 'Managing Director & Owner', 'khandagalesuraj48@gmail.com', 'active');
        END IF;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Helper Security Functions (STABLE, SECURITY DEFINER)
-- ------------------------------------------------------------------------------

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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated;

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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. Additive Tasks Schema & Safe Legacy Preservation
-- ------------------------------------------------------------------------------

ALTER TABLE public.tasks 
    ADD COLUMN IF NOT EXISTS scope VARCHAR(16) NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'workplace')),
    ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_employee_id UUID REFERENCES public.erp_employees(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;

-- Safe Legacy Backfill: All existing tasks remain 'personal'
UPDATE public.tasks SET scope = 'personal' WHERE scope IS NULL;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_scope_user ON public.tasks(scope, user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_scope_org ON public.tasks(scope, org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_employee ON public.tasks(assigned_employee_id);

-- ------------------------------------------------------------------------------
-- 5. Task Assignment History Table (Audit Trail)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_employee_id UUID REFERENCES public.erp_employees(id) ON DELETE SET NULL,
    assigned_to_name TEXT,
    remark TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'assigned' CHECK (status IN (
        'assigned', 'in_progress', 'submitted', 'completed', 'reassigned', 'reopened', 'cancelled'
    )),
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
-- 6. In-App Notifications Table
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL CHECK (type IN (
        'task_assigned', 'task_reassigned', 'task_submitted', 'task_completed', 'task_reopened', 'task_comment', 'system'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(32) NOT NULL DEFAULT 'task',
    entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON public.notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- ------------------------------------------------------------------------------
-- 7. Secure Read-Only Task Share Links (Token Hash)
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
-- 8. Public RPC Function: get_shared_task_public
-- Exact Remote Compatibility: uses storage_path and uploaded_at
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_shared_task_public(p_token_hash TEXT)
RETURNS JSONB AS $$
DECLARE
    v_link RECORD;
    v_task RECORD;
    v_attachments JSONB := '[]'::jsonb;
BEGIN
    IF p_token_hash IS NULL OR trim(p_token_hash) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid share token');
    END IF;

    -- Find active, non-expired share link
    SELECT * INTO v_link
    FROM public.task_share_links
    WHERE token_hash = p_token_hash
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;

    IF v_link.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Share link is expired, revoked, or not found');
    END IF;

    -- Fetch task record
    SELECT 
        id, title, description, status, priority, due_date, 
        person_name, scope, created_at, updated_at
    INTO v_task
    FROM public.tasks
    WHERE id = v_link.task_id AND is_deleted = false;

    IF v_task.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Task not found or has been moved to Bin');
    END IF;

    -- Update statistics
    UPDATE public.task_share_links
    SET view_count = view_count + 1,
        last_accessed_at = now()
    WHERE id = v_link.id;

    -- Fetch attachments using EXACT remote columns: storage_path, uploaded_at
    IF v_link.allow_attachments = true THEN
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', a.id,
                    'file_name', a.file_name,
                    'file_size', a.file_size,
                    'file_type', a.file_type,
                    'storage_path', a.storage_path,
                    'uploaded_at', a.uploaded_at
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
-- 9. Trigger: Workplace Task Assignment & Notification Automation
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_task_assignment_event()
RETURNS TRIGGER AS $$
DECLARE
    v_assigner_id UUID := COALESCE(auth.uid(), NEW.user_id);
    v_target_name TEXT := NEW.person_name;
BEGIN
    IF NEW.scope = 'workplace' AND NEW.org_id IS NOT NULL THEN
        -- Resolve employee name if needed
        IF NEW.assigned_employee_id IS NOT NULL AND (v_target_name IS NULL OR v_target_name = '') THEN
            SELECT (first_name || ' ' || COALESCE(last_name, '')) INTO v_target_name
            FROM public.erp_employees
            WHERE id = NEW.assigned_employee_id;
        END IF;

        -- On INSERT: record initial assignment
        IF (TG_OP = 'INSERT') THEN
            IF NEW.assigned_to IS NOT NULL OR NEW.assigned_employee_id IS NOT NULL THEN
                INSERT INTO public.task_assignments (
                    task_id, org_id, assigned_by, assigned_to,
                    assigned_employee_id, assigned_to_name, remark, status
                ) VALUES (
                    NEW.id, NEW.org_id, v_assigner_id, NEW.assigned_to,
                    NEW.assigned_employee_id, v_target_name, 'Initial task assignment', 'assigned'
                );

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

        -- On UPDATE: detect assignment change or completion
        ELSIF (TG_OP = 'UPDATE') THEN
            IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to OR OLD.assigned_employee_id IS DISTINCT FROM NEW.assigned_employee_id) THEN
                UPDATE public.task_assignments
                SET status = 'reassigned'
                WHERE task_id = NEW.id AND status IN ('assigned', 'in_progress');

                INSERT INTO public.task_assignments (
                    task_id, org_id, assigned_by, assigned_to,
                    assigned_employee_id, assigned_to_name, remark, status
                ) VALUES (
                    NEW.id, NEW.org_id, v_assigner_id, NEW.assigned_to,
                    NEW.assigned_employee_id, v_target_name, 'Task reassigned', 'assigned'
                );

                IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != v_assigner_id THEN
                    INSERT INTO public.notifications (
                        recipient_user_id, organization_id, type, title, message, entity_type, entity_id
                    ) VALUES (
                        NEW.assigned_to,
                        NEW.org_id,
                        'task_reassigned',
                        'Task Reassigned to You: ' || NEW.title,
                        'Task "' || NEW.title || '" has been reassigned to you.',
                        'task',
                        NEW.id
                    );
                END IF;
            END IF;

            -- Completion / Submission Notification
            IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('completed', 'submitted')) THEN
                IF NEW.user_id != v_assigner_id THEN
                    INSERT INTO public.notifications (
                        recipient_user_id, organization_id, type, title, message, entity_type, entity_id
                    ) VALUES (
                        NEW.user_id,
                        NEW.org_id,
                        'task_completed',
                        'Task ' || initcap(NEW.status) || ': ' || NEW.title,
                        'Task "' || NEW.title || '" has been marked as ' || NEW.status || '.',
                        'task',
                        NEW.id
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_task_assignment_event ON public.tasks;
CREATE TRIGGER trg_task_assignment_event
    AFTER INSERT OR UPDATE OF assigned_to, assigned_employee_id, status
    ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_task_assignment_event();

-- ------------------------------------------------------------------------------
-- 10. PostgreSQL Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. Organizations & Memberships Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
CREATE POLICY "Members can view their organization"
    ON public.organizations FOR SELECT
    TO authenticated
    USING (public.is_org_member(id) OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage organization" ON public.organizations;
CREATE POLICY "Admins can manage organization"
    ON public.organizations FOR ALL
    TO authenticated
    USING (public.is_org_admin(id) OR owner_id = auth.uid())
    WITH CHECK (public.is_org_admin(id) OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Members can view memberships" ON public.org_memberships;
CREATE POLICY "Members can view memberships"
    ON public.org_memberships FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_org_member(org_id));

DROP POLICY IF EXISTS "Admins can manage memberships" ON public.org_memberships;
CREATE POLICY "Admins can manage memberships"
    ON public.org_memberships FOR ALL
    TO authenticated
    USING (public.is_org_admin(org_id))
    WITH CHECK (public.is_org_admin(org_id));

-- ------------------------------------------------------------------------------
-- B. Employee Directory Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can view employees" ON public.erp_employees;
CREATE POLICY "Org members can view employees"
    ON public.erp_employees FOR SELECT
    TO authenticated
    USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "Org members can add employees" ON public.erp_employees;
CREATE POLICY "Org members can add employees"
    ON public.erp_employees FOR INSERT
    TO authenticated
    WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS "Org admins can manage employees" ON public.erp_employees;
CREATE POLICY "Org admins can manage employees"
    ON public.erp_employees FOR UPDATE
    TO authenticated
    USING (public.is_org_admin(org_id))
    WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "Org admins can delete employees" ON public.erp_employees;
CREATE POLICY "Org admins can delete employees"
    ON public.erp_employees FOR DELETE
    TO authenticated
    USING (public.is_org_admin(org_id));

-- ------------------------------------------------------------------------------
-- C. Tasks Dual-Scope RLS Policies
-- PERSONAL: creator only.
-- WORKPLACE: creator OR assigned_to OR authorized org admin.
-- USER C IN SAME ORG IS BLOCKED.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

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
-- D. Task Assignments RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view task assignments" ON public.task_assignments;
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

DROP POLICY IF EXISTS "Members can insert task assignments" ON public.task_assignments;
CREATE POLICY "Members can insert task assignments"
    ON public.task_assignments FOR INSERT
    TO authenticated
    WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS "Members can update task assignments" ON public.task_assignments;
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
-- E. Notifications RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (recipient_user_id = auth.uid())
    WITH CHECK (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    TO authenticated
    USING (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications"
    ON public.notifications FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------------------------
-- F. Task Share Links RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view share links for visible tasks" ON public.task_share_links;
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

DROP POLICY IF EXISTS "Users can create share links" ON public.task_share_links;
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

DROP POLICY IF EXISTS "Users can modify own share links" ON public.task_share_links;
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

DROP POLICY IF EXISTS "Users can delete own share links" ON public.task_share_links;
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
-- G. Child Records (Status History, Notes, Attachments, Reminders) Dual-Scope RLS
-- ------------------------------------------------------------------------------

-- Task Status History
DROP POLICY IF EXISTS "Users can read own task history" ON public.task_status_history;
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

DROP POLICY IF EXISTS "Users can insert own task history" ON public.task_status_history;
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

-- Task Notes
DROP POLICY IF EXISTS "Users can read own task notes" ON public.task_notes;
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

DROP POLICY IF EXISTS "Users can insert own task notes" ON public.task_notes;
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

DROP POLICY IF EXISTS "Users can update own task notes" ON public.task_notes;
CREATE POLICY "Users can update own task notes"
    ON public.task_notes FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own task notes" ON public.task_notes;
CREATE POLICY "Users can delete own task notes"
    ON public.task_notes FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Task Attachments
DROP POLICY IF EXISTS "Users can read own task attachments" ON public.task_attachments;
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

DROP POLICY IF EXISTS "Users can insert own task attachments" ON public.task_attachments;
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

DROP POLICY IF EXISTS "Users can delete own task attachments" ON public.task_attachments;
CREATE POLICY "Users can delete own task attachments"
    ON public.task_attachments FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_attachments.task_id
              AND (
                (COALESCE(t.scope, 'personal') = 'personal' AND t.user_id = auth.uid())
                OR
                (t.scope = 'workplace' AND public.is_org_member(t.org_id) AND (t.user_id = auth.uid() OR public.is_org_admin(t.org_id)))
              )
        )
    );

-- Task Reminders (Strictly personal to the user who set them)
DROP POLICY IF EXISTS "Users can read own task reminders" ON public.task_reminders;
CREATE POLICY "Users can read own task reminders"
    ON public.task_reminders FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own task reminders" ON public.task_reminders;
CREATE POLICY "Users can insert own task reminders"
    ON public.task_reminders FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own task reminders" ON public.task_reminders;
CREATE POLICY "Users can update own task reminders"
    ON public.task_reminders FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own task reminders" ON public.task_reminders;
CREATE POLICY "Users can delete own task reminders"
    ON public.task_reminders FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- H. Storage Objects Dual-Scope Access for task-attachments bucket
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can select own task-attachments" ON storage.objects;
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

DROP POLICY IF EXISTS "Users can upload own task-attachments" ON storage.objects;
CREATE POLICY "Users can upload own task-attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL
    );

DROP POLICY IF EXISTS "Users can delete own task-attachments" ON storage.objects;
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

