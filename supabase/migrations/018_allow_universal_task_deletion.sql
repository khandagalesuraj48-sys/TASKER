-- ==============================================================================
-- Migration: 018_allow_universal_task_deletion.sql
-- Application: TASKER Enterprise Operating System
-- Target: Enable universal task deletion across all views, roles, and components
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Drop trigger and replace check_task_delete_permission
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_enforce_task_delete_permission ON public.tasks;

CREATE OR REPLACE FUNCTION public.check_task_delete_permission()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow universal task deletion and soft deletion for all users
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-attach relaxed trigger if needed, or leave unblocked
DROP TRIGGER IF EXISTS trg_enforce_task_delete_permission ON public.tasks;

-- ------------------------------------------------------------------------------
-- 2. Update Tasks RLS Policies for Universal Update & Delete
-- ------------------------------------------------------------------------------

-- Allow authenticated users to soft-delete and update tasks
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON public.tasks;
CREATE POLICY "Users can update tasks"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to delete tasks
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks" ON public.tasks;
CREATE POLICY "Users can delete tasks"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (true);

-- ------------------------------------------------------------------------------
-- 3. Fail-Safe Server RPC: delete_task_universal
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_task_universal(
    p_task_id UUID,
    p_actor TEXT DEFAULT 'Team Member',
    p_permanent BOOLEAN DEFAULT false
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_permanent THEN
        -- Permanent deletion: cascade purge all associated records
        DELETE FROM public.notifications WHERE entity_id = p_task_id;
        DELETE FROM public.task_assignments WHERE task_id = p_task_id;
        DELETE FROM public.task_notes WHERE task_id = p_task_id;
        DELETE FROM public.task_attachments WHERE task_id = p_task_id;
        DELETE FROM public.task_status_history WHERE task_id = p_task_id;
        DELETE FROM public.tasks WHERE id = p_task_id;
    ELSE
        -- Soft deletion: move to bin
        UPDATE public.tasks
        SET is_deleted = true,
            deleted_at = now(),
            deleted_by = p_actor,
            updated_at = now()
        WHERE id = p_task_id;

        -- Clean up notifications and cancel pending assignments
        DELETE FROM public.notifications WHERE entity_id = p_task_id;
        UPDATE public.task_assignments
        SET status = 'cancelled', remark = 'Task moved to bin by ' || p_actor
        WHERE task_id = p_task_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'task_id', p_task_id,
        'permanent', p_permanent
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.delete_task_universal(UUID, TEXT, BOOLEAN) TO authenticated, anon;

-- Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';

