-- ==============================================================================
-- Migration: 013_fix_org_tasks_and_admin_user_mgmt.sql
-- Application: TASKER Enterprise Operating System
-- Target: 
--   1. Fix Workplace Task Creation for Platform Admins and Members
--   2. Grant Platform Admin Full Governance across all Organizations
--   3. Central Super-Admin User Management: View all App Users with Names,
--      Move or Add Users between Organizations
--   4. Fix erp_employees columns in approve_join_request
--   5. Ensure custom_fields column exists on tasks table and reload schema
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Ensure tasks table schema columns
-- ------------------------------------------------------------------------------
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_employee_id UUID;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'personal';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS org_id UUID;

-- Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------------------------
-- 1. Enhanced Helper Functions: is_org_member & is_org_admin
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL OR check_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Platform Admin has universal member access across all organizations
    IF public.is_platform_admin(v_user_id) THEN
        RETURN TRUE;
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

GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated, anon;


CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL OR check_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Platform Admin has universal admin access across all organizations
    IF public.is_platform_admin(v_user_id) THEN
        RETURN TRUE;
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

GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated, anon;


-- ------------------------------------------------------------------------------
-- 2. Tasks Dual-Scope RLS Policies (Rock-solid for Personal & Workplace)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can read own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

-- SELECT Policy
CREATE POLICY "Users can read own tasks"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (
        -- Personal tasks: strictly creator-only
        (COALESCE(scope, 'personal') = 'personal' AND user_id = auth.uid())
        OR
        -- Workplace tasks: visible to creator, assigned user, org member, or platform admin
        (
            scope = 'workplace'
            AND org_id IS NOT NULL
            AND (
                public.is_org_member(org_id)
                OR public.is_platform_admin(auth.uid())
            )
            AND (
                user_id = auth.uid()
                OR assigned_to = auth.uid()
                OR public.is_org_admin(org_id)
                OR public.is_platform_admin(auth.uid())
            )
        )
    );

-- INSERT Policy: allows inserting personal tasks for self, or workplace tasks for org
CREATE POLICY "Users can insert own tasks"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Personal tasks: strictly current user
        (COALESCE(scope, 'personal') = 'personal' AND user_id = auth.uid())
        OR
        -- Workplace tasks: user is a member of the target org OR is a platform admin
        (
            scope = 'workplace'
            AND org_id IS NOT NULL
            AND user_id = auth.uid()
            AND (
                public.is_org_member(org_id)
                OR public.is_platform_admin(auth.uid())
            )
        )
    );

-- UPDATE Policy
CREATE POLICY "Users can update own tasks"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (
        (COALESCE(scope, 'personal') = 'personal' AND user_id = auth.uid())
        OR
        (
            scope = 'workplace'
            AND org_id IS NOT NULL
            AND (
                user_id = auth.uid()
                OR assigned_to = auth.uid()
                OR public.is_org_admin(org_id)
                OR public.is_platform_admin(auth.uid())
            )
        )
    )
    WITH CHECK (
        (COALESCE(scope, 'personal') = 'personal' AND user_id = auth.uid())
        OR
        (
            scope = 'workplace'
            AND org_id IS NOT NULL
            AND (
                user_id = auth.uid()
                OR assigned_to = auth.uid()
                OR public.is_org_admin(org_id)
                OR public.is_platform_admin(auth.uid())
            )
        )
    );

-- DELETE Policy
CREATE POLICY "Users can delete own tasks"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (
        (COALESCE(scope, 'personal') = 'personal' AND user_id = auth.uid())
        OR
        (
            scope = 'workplace'
            AND org_id IS NOT NULL
            AND (
                user_id = auth.uid()
                OR public.is_org_admin(org_id)
                OR public.is_platform_admin(auth.uid())
            )
        )
    );


-- ------------------------------------------------------------------------------
-- 3. Robust Task Assignment Trigger (Safe Insert & Notifications)
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
EXCEPTION
    WHEN OTHERS THEN
        -- Prevent trigger error from blocking task creation/update
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ------------------------------------------------------------------------------
-- 4. Corrected approve_join_request (Strictly matching erp_employees schema)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_join_request(
    p_request_id UUID, 
    p_role VARCHAR DEFAULT 'team_member',
    p_target_org_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_org_id UUID;
    v_org_name TEXT;
    v_first_name TEXT;
    v_last_name TEXT := '';
BEGIN
    SELECT * INTO v_req FROM public.org_join_requests WHERE id = p_request_id;
    IF v_req.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request not found');
    END IF;

    v_org_id := COALESCE(p_target_org_id, v_req.org_id);

    IF NOT (public.is_platform_admin(v_admin_id) OR public.is_org_admin(v_org_id)) THEN
        RAISE EXCEPTION 'Access denied. You are not authorized to approve requests for this organization.';
    END IF;

    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;
    SELECT legal_name INTO v_org_name FROM public.organizations WHERE id = v_org_id;

    -- 1. Insert or update org membership
    INSERT INTO public.org_memberships (user_id, org_id, role)
    VALUES (v_req.user_id, v_org_id, COALESCE(p_role, v_req.requested_role, 'team_member'))
    ON CONFLICT (user_id, org_id)
    DO UPDATE SET role = COALESCE(p_role, v_req.requested_role, 'team_member');

    -- 2. Link employee record in erp_employees with correct columns
    v_first_name := COALESCE(NULLIF(trim(v_req.user_name), ''), split_part(v_req.user_email, '@', 1));
    
    IF NOT EXISTS (SELECT 1 FROM public.erp_employees WHERE org_id = v_org_id AND user_id = v_req.user_id) THEN
        INSERT INTO public.erp_employees (
            org_id, user_id, first_name, last_name, employee_code, designation, email, status
        ) VALUES (
            v_org_id,
            v_req.user_id,
            v_first_name,
            v_last_name,
            'EMP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)),
            COALESCE(p_role, 'team_member'),
            v_req.user_email,
            'active'
        );
    ELSE
        UPDATE public.erp_employees
        SET designation = COALESCE(p_role, 'team_member'),
            status = 'active',
            updated_at = now()
        WHERE org_id = v_org_id AND user_id = v_req.user_id;
    END IF;

    -- 3. Update request status
    UPDATE public.org_join_requests
    SET status = 'approved',
        org_id = v_org_id,
        reviewed_by = v_admin_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_request_id;

    -- 4. Send in-app notification to the approved user
    INSERT INTO public.notifications (
        recipient_user_id, organization_id, type, title, message, entity_type, entity_id
    ) VALUES (
        v_req.user_id,
        v_org_id,
        'system',
        'Organization Access Approved: ' || COALESCE(v_org_name, 'Workplace'),
        'Your request to join "' || COALESCE(v_org_name, 'Workplace') || '" has been approved. You can now access workplace tasks.',
        'organization',
        v_org_id
    );

    -- 5. Audit Log
    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
        v_admin_id,
        v_admin_email,
        'approve_join_request',
        'request',
        p_request_id::TEXT,
        jsonb_build_object(
            'org_id', v_org_id,
            'org_name', v_org_name,
            'user_id', v_req.user_id,
            'user_email', v_req.user_email,
            'role', COALESCE(p_role, v_req.requested_role)
        )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Request approved successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.approve_join_request(UUID, VARCHAR, UUID) TO authenticated;


-- ------------------------------------------------------------------------------
-- 5. Central Super Admin User Management RPCs
-- ------------------------------------------------------------------------------

-- A. Get All App Users with Names, Emails, and Organization Memberships
CREATE OR REPLACE FUNCTION public.get_all_app_users_admin()
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_result JSONB;
BEGIN
    IF NOT public.is_platform_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Access denied. Only Platform Admins can list all users.';
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object(
            'id', u.id,
            'email', u.email,
            'display_name', COALESCE(
                NULLIF(u.raw_user_meta_data->>'full_name', ''),
                NULLIF(u.raw_user_meta_data->>'name', ''),
                (SELECT first_name || ' ' || COALESCE(last_name, '') FROM public.erp_employees WHERE user_id = u.id LIMIT 1),
                split_part(u.email, '@', 1)
            ),
            'created_at', u.created_at,
            'last_sign_in_at', u.last_sign_in_at,
            'is_platform_admin', EXISTS(SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = u.id AND pa.is_active = true),
            'organizations', COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'membership_id', m.id,
                            'org_id', m.org_id,
                            'org_name', o.legal_name,
                            'trade_name', o.trade_name,
                            'role', m.role,
                            'created_at', m.created_at
                        )
                    )
                    FROM public.org_memberships m
                    JOIN public.organizations o ON o.id = m.org_id
                    WHERE m.user_id = u.id
                ),
                '[]'::jsonb
            )
        )
        ORDER BY u.created_at DESC
    ) INTO v_result
    FROM auth.users u;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_all_app_users_admin() TO authenticated;


-- B. Assign or Move User to an Organization
CREATE OR REPLACE FUNCTION public.assign_user_to_organization_admin(
    p_user_id UUID,
    p_target_org_id UUID,
    p_role VARCHAR DEFAULT 'team_member',
    p_remove_from_other_orgs BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_user RECORD;
    v_org RECORD;
    v_display_name TEXT;
BEGIN
    IF NOT public.is_platform_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Access denied. Only Platform Admins can assign users to organizations.';
    END IF;

    SELECT id, email, raw_user_meta_data INTO v_user FROM auth.users WHERE id = p_user_id;
    IF v_user.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    SELECT id, legal_name INTO v_org FROM public.organizations WHERE id = p_target_org_id;
    IF v_org.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target organization not found');
    END IF;

    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;

    -- If moving user exclusively, remove from other orgs
    IF p_remove_from_other_orgs THEN
        DELETE FROM public.org_memberships 
        WHERE user_id = p_user_id AND org_id != p_target_org_id;
    END IF;

    -- Add or update membership in target org
    INSERT INTO public.org_memberships (user_id, org_id, role)
    VALUES (p_user_id, p_target_org_id, COALESCE(p_role, 'team_member'))
    ON CONFLICT (user_id, org_id)
    DO UPDATE SET role = COALESCE(p_role, 'team_member');

    -- Ensure employee directory record exists
    v_display_name := COALESCE(
        NULLIF(v_user.raw_user_meta_data->>'full_name', ''),
        NULLIF(v_user.raw_user_meta_data->>'name', ''),
        split_part(v_user.email, '@', 1)
    );

    IF NOT EXISTS (SELECT 1 FROM public.erp_employees WHERE org_id = p_target_org_id AND user_id = p_user_id) THEN
        INSERT INTO public.erp_employees (
            org_id, user_id, first_name, last_name, employee_code, designation, email, status
        ) VALUES (
            p_target_org_id,
            p_user_id,
            v_display_name,
            '',
            'EMP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)),
            COALESCE(p_role, 'team_member'),
            v_user.email,
            'active'
        );
    ELSE
        UPDATE public.erp_employees
        SET designation = COALESCE(p_role, 'team_member'),
            status = 'active',
            updated_at = now()
        WHERE org_id = p_target_org_id AND user_id = p_user_id;
    END IF;

    -- Notify user
    INSERT INTO public.notifications (
        recipient_user_id, organization_id, type, title, message, entity_type, entity_id
    ) VALUES (
        p_user_id,
        p_target_org_id,
        'system',
        'Added to ' || v_org.legal_name,
        'You have been added to ' || v_org.legal_name || ' as a ' || COALESCE(p_role, 'team_member') || '.',
        'organization',
        p_target_org_id
    );

    -- Audit Log
    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
        v_admin_id,
        v_admin_email,
        'assign_user_to_org',
        'user',
        p_user_id::TEXT,
        jsonb_build_object(
            'target_org_id', p_target_org_id,
            'target_org_name', v_org.legal_name,
            'role', p_role,
            'exclusive_move', p_remove_from_other_orgs,
            'user_email', v_user.email
        )
    );

    RETURN jsonb_build_object('success', true, 'message', 'User assigned to organization successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.assign_user_to_organization_admin(UUID, UUID, VARCHAR, BOOLEAN) TO authenticated;


-- C. Remove User from an Organization
CREATE OR REPLACE FUNCTION public.remove_user_from_organization_admin(
    p_user_id UUID,
    p_org_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
BEGIN
    IF NOT public.is_platform_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Access denied. Only Platform Admins can remove users from organizations.';
    END IF;

    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;

    DELETE FROM public.org_memberships 
    WHERE user_id = p_user_id AND org_id = p_org_id;

    UPDATE public.erp_employees
    SET status = 'inactive', updated_at = now()
    WHERE user_id = p_user_id AND org_id = p_org_id;

    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
        v_admin_id,
        v_admin_email,
        'remove_user_from_org',
        'user',
        p_user_id::TEXT,
        jsonb_build_object('org_id', p_org_id)
    );

    RETURN jsonb_build_object('success', true, 'message', 'User removed from organization');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.remove_user_from_organization_admin(UUID, UUID) TO authenticated;
