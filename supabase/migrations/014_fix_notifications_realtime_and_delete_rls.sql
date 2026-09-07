-- ==============================================================================
-- Migration: 014_fix_notifications_realtime_and_delete_rls.sql
-- Application: TASKER Enterprise Operating System
-- Target: 
--   1. Realtime notification delivery guarantee (REPLICA IDENTITY FULL + publication)
--   2. Strict Task Delete Authorization (Trigger & RLS: User B cannot delete User A's task!)
--   3. Notification Insert Policy verification
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Realtime Notification Delivery Guarantee
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;

-- Ensure authenticated users can insert notifications for team members
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications"
    ON public.notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Ensure users can read their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (recipient_user_id = auth.uid());

-- Ensure users can update (mark as read) their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (recipient_user_id = auth.uid())
    WITH CHECK (recipient_user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 2. Strict Task Delete Authorization (Database Level)
-- STRICT RULE: Only task creator, platform admin, or org admin can delete/soft-delete a task!
-- An assignee (User B) CANNOT delete User A's task under any circumstance!
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_task_delete_permission()
RETURNS TRIGGER AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_platform_admin BOOLEAN := false;
    v_is_org_admin BOOLEAN := false;
BEGIN
    -- If no authenticated user (e.g. background service role), allow
    IF v_caller_id IS NULL THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    -- Only check if operation is DELETE OR soft delete (is_deleted transitioning from false to true)
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.is_deleted = true AND (OLD.is_deleted = false OR OLD.is_deleted IS NULL)) THEN

        -- 1. Check if caller is the task creator
        IF OLD.user_id = v_caller_id THEN
            RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
        END IF;

        -- 2. Check if caller is a Platform Admin (Superadmin)
        SELECT is_active INTO v_is_platform_admin 
        FROM public.platform_admins 
        WHERE user_id = v_caller_id AND is_active = true 
        LIMIT 1;

        IF v_is_platform_admin THEN
            RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
        END IF;

        -- 3. Check if caller is an Org Admin or Owner
        IF OLD.org_id IS NOT NULL THEN
            SELECT true INTO v_is_org_admin
            FROM public.org_memberships
            WHERE org_id = OLD.org_id 
              AND user_id = v_caller_id 
              AND role IN ('org_owner', 'org_admin')
            LIMIT 1;

            IF v_is_org_admin THEN
                RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
            END IF;
        END IF;

        -- If none of the above, block deletion!
        RAISE EXCEPTION 'परमिशन नाकारली! फक्त टास्क तयार करणारा किंवा ॲडमिनच हा टास्क डिलीट करू शकतो. (Permission denied! Only the task creator or admin can delete this task.)';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to tasks table
DROP TRIGGER IF EXISTS trg_enforce_task_delete_permission ON public.tasks;
CREATE TRIGGER trg_enforce_task_delete_permission
    BEFORE UPDATE OR DELETE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.check_task_delete_permission();

-- ------------------------------------------------------------------------------
-- 3. Update DELETE RLS Policy on public.tasks
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can delete own tasks"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR
        public.is_platform_admin(auth.uid())
        OR
        (
            scope = 'workplace'
            AND org_id IS NOT NULL
            AND public.is_org_admin(org_id)
        )
    );
