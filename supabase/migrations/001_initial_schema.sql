-- ==============================================================================
-- Migration: 001_initial_schema.sql
-- Application: My Work Tracker (Single-User Personal Work & Task Tracker)
-- Author: Software Architecture Team
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Table: tasks
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    person_name TEXT, -- Pending with / Assigned person
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'partial', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    due_date TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by TEXT,
    created_by TEXT NOT NULL DEFAULT 'Pawan',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    pending_since TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by TEXT
);

-- Comments on tasks table
COMMENT ON TABLE public.tasks IS 'Core tasks and work items for My Work Tracker';
COMMENT ON COLUMN public.tasks.person_name IS 'Person or entity task is pending with / assigned to';
COMMENT ON COLUMN public.tasks.pending_since IS 'Timestamp when the task most recently entered Pending status';

-- ------------------------------------------------------------------------------
-- 2. Table: task_status_history
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    old_status TEXT CHECK (old_status IS NULL OR old_status IN ('pending', 'in_progress', 'partial', 'completed', 'cancelled')),
    new_status TEXT NOT NULL CHECK (new_status IN ('pending', 'in_progress', 'partial', 'completed', 'cancelled')),
    changed_by TEXT NOT NULL DEFAULT 'Pawan',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    remarks TEXT
);

COMMENT ON TABLE public.task_status_history IS 'Immutable timeline of every status transition per task';

-- ------------------------------------------------------------------------------
-- 3. Table: task_notes
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_by TEXT NOT NULL DEFAULT 'Pawan',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.task_notes IS 'Timestamped notes and remarks associated with a task';

-- ------------------------------------------------------------------------------
-- 4. Table: task_attachments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    uploaded_by TEXT NOT NULL DEFAULT 'Pawan',
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.task_attachments IS 'Metadata for files stored in Supabase Storage task-attachments bucket';

-- ------------------------------------------------------------------------------
-- 5. Indexes for High Performance
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_is_deleted ON public.tasks (is_deleted);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks (priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_pending_since ON public.tasks (pending_since);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_person_name ON public.tasks (person_name);
CREATE INDEX IF NOT EXISTS idx_tasks_active_dashboard ON public.tasks (is_deleted, status, priority, due_date);

CREATE INDEX IF NOT EXISTS idx_task_status_history_task_id ON public.task_status_history (task_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_notes_task_id ON public.task_notes (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments (task_id, uploaded_at DESC);

-- ------------------------------------------------------------------------------
-- 6. Trigger Functions & Lifecycle Management
-- ------------------------------------------------------------------------------

-- Trigger function: Automatically keep updated_at in sync
CREATE OR REPLACE FUNCTION public.handle_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_updated_at ON public.tasks;
CREATE TRIGGER trg_task_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_task_updated_at();

-- Trigger function: Manage status lifecycle dates on direct table updates
CREATE OR REPLACE FUNCTION public.handle_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If status actually changed
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR (TG_OP = 'INSERT') THEN
        -- When entering 'in_progress', record started_at if not already set
        IF NEW.status = 'in_progress' AND NEW.started_at IS NULL THEN
            NEW.started_at = timezone('utc'::text, now());
        END IF;

        -- When entering 'pending', update pending_since
        IF NEW.status = 'pending' THEN
            NEW.pending_since = timezone('utc'::text, now());
        END IF;

        -- When entering 'completed', set completed_at and completed_by
        IF NEW.status = 'completed' THEN
            IF NEW.completed_at IS NULL THEN
                NEW.completed_at = timezone('utc'::text, now());
            END IF;
            IF NEW.completed_by IS NULL OR NEW.completed_by = '' THEN
                NEW.completed_by = COALESCE(NEW.created_by, 'Pawan');
            END IF;
        ELSE
            -- If transitioning away from completed, clear completion info
            NEW.completed_at = NULL;
            NEW.completed_by = NULL;
        END IF;
    END IF;

    -- Deletion lifecycle
    IF TG_OP = 'UPDATE' AND OLD.is_deleted IS DISTINCT FROM NEW.is_deleted THEN
        IF NEW.is_deleted = true THEN
            NEW.deleted_at = timezone('utc'::text, now());
            IF NEW.deleted_by IS NULL OR NEW.deleted_by = '' THEN
                NEW.deleted_by = COALESCE(NEW.created_by, 'Pawan');
            END IF;
        ELSE
            NEW.deleted_at = NULL;
            NEW.deleted_by = NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_status_change ON public.tasks;
CREATE TRIGGER trg_task_status_change
    BEFORE INSERT OR UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_task_status_change();

-- Trigger function: Ensure initial status history record on normal INSERT
-- Guarded against duplicate records during backup restore
CREATE OR REPLACE FUNCTION public.handle_task_initial_history()
RETURNS TRIGGER AS $$
BEGIN
    -- If backup restore flag is active in session, bypass automatic generation
    IF current_setting('app.is_restoring', true) = 'true' THEN
        RETURN NEW;
    END IF;

    -- If a history record already exists for this task, do not duplicate
    IF EXISTS (SELECT 1 FROM public.task_status_history WHERE task_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.task_status_history (
        task_id,
        old_status,
        new_status,
        changed_by,
        changed_at,
        remarks
    ) VALUES (
        NEW.id,
        NULL,
        NEW.status,
        COALESCE(NEW.created_by, 'Pawan'),
        NEW.created_at,
        'Initial task creation'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_initial_history ON public.tasks;
CREATE TRIGGER trg_task_initial_history
    AFTER INSERT ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_task_initial_history();

-- ------------------------------------------------------------------------------
-- 7. Transactional Status Update RPC
-- Ensures status change and history record succeed together or fail together.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_task_status_with_history(
    p_task_id UUID,
    p_new_status TEXT,
    p_actor TEXT,
    p_remarks TEXT DEFAULT NULL
)
RETURNS SETOF public.tasks AS $$
DECLARE
    v_task public.tasks%ROWTYPE;
    v_old_status TEXT;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- Validate new status
    IF p_new_status NOT IN ('pending', 'in_progress', 'partial', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status value: %', p_new_status;
    END IF;

    -- Select and lock the task row
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task with ID % not found', p_task_id;
    END IF;

    v_old_status := v_task.status;

    -- Prepare lifecycle updates
    v_task.status := p_new_status;
    v_task.updated_at := v_now;

    IF p_new_status = 'in_progress' AND v_task.started_at IS NULL THEN
        v_task.started_at := v_now;
    END IF;

    IF p_new_status = 'pending' THEN
        v_task.pending_since := v_now;
    END IF;

    IF p_new_status = 'completed' THEN
        v_task.completed_at := v_now;
        v_task.completed_by := COALESCE(NULLIF(p_actor, ''), v_task.created_by, 'Pawan');
    ELSIF v_old_status = 'completed' THEN
        v_task.completed_at := NULL;
        v_task.completed_by := NULL;
    END IF;

    -- 1. Update task in tasks table
    UPDATE public.tasks
    SET
        status = v_task.status,
        updated_at = v_task.updated_at,
        started_at = v_task.started_at,
        pending_since = v_task.pending_since,
        completed_at = v_task.completed_at,
        completed_by = v_task.completed_by
    WHERE id = p_task_id
    RETURNING * INTO v_task;

    -- 2. Insert status history record atomically
    INSERT INTO public.task_status_history (
        task_id,
        old_status,
        new_status,
        changed_by,
        changed_at,
        remarks
    ) VALUES (
        p_task_id,
        v_old_status,
        p_new_status,
        COALESCE(NULLIF(p_actor, ''), 'Pawan'),
        v_now,
        p_remarks
    );

    RETURN NEXT v_task;
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 8. Supabase Storage Setup: Private task-attachments bucket
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ------------------------------------------------------------------------------
-- 9. Row Level Security (RLS) Configuration
-- Designed for Single-User application with Application Access Key support
-- ------------------------------------------------------------------------------

-- App authorization helper function
CREATE OR REPLACE FUNCTION public.is_app_authorized()
RETURNS boolean AS $$
DECLARE
    configured_key text;
    req_headers json;
    app_key text;
BEGIN
    BEGIN
        configured_key := current_setting('app.settings.access_key', true);
    EXCEPTION WHEN OTHERS THEN
        configured_key := NULL;
    END;

    -- If no server-side access key is configured in DB, allow access
    IF configured_key IS NULL OR configured_key = '' THEN
        RETURN true;
    END IF;

    -- Extract x-app-access-key header from request
    BEGIN
        req_headers := current_setting('request.headers', true)::json;
        app_key := req_headers->>'x-app-access-key';
    EXCEPTION WHEN OTHERS THEN
        RETURN false;
    END;

    RETURN app_key IS NOT NULL AND app_key = configured_key;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow anon full access on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow anon full access on task_status_history" ON public.task_status_history;
DROP POLICY IF EXISTS "Allow anon full access on task_notes" ON public.task_notes;
DROP POLICY IF EXISTS "Allow anon full access on task_attachments" ON public.task_attachments;

-- Create secure policies checked via authorization function
CREATE POLICY "Allow anon full access on tasks"
    ON public.tasks FOR ALL
    TO anon, authenticated
    USING (public.is_app_authorized())
    WITH CHECK (public.is_app_authorized());

CREATE POLICY "Allow anon full access on task_status_history"
    ON public.task_status_history FOR ALL
    TO anon, authenticated
    USING (public.is_app_authorized())
    WITH CHECK (public.is_app_authorized());

CREATE POLICY "Allow anon full access on task_notes"
    ON public.task_notes FOR ALL
    TO anon, authenticated
    USING (public.is_app_authorized())
    WITH CHECK (public.is_app_authorized());

CREATE POLICY "Allow anon full access on task_attachments"
    ON public.task_attachments FOR ALL
    TO anon, authenticated
    USING (public.is_app_authorized())
    WITH CHECK (public.is_app_authorized());

-- Storage bucket access policies
DROP POLICY IF EXISTS "Public Access to task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon upload to task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon update in task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon delete in task-attachments" ON storage.objects;

CREATE POLICY "Allow anon select in task-attachments"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'task-attachments' AND public.is_app_authorized());

CREATE POLICY "Allow anon upload to task-attachments"
    ON storage.objects FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'task-attachments' AND public.is_app_authorized());

CREATE POLICY "Allow anon update in task-attachments"
    ON storage.objects FOR UPDATE
    TO anon, authenticated
    USING (bucket_id = 'task-attachments' AND public.is_app_authorized());

CREATE POLICY "Allow anon delete in task-attachments"
    ON storage.objects FOR DELETE
    TO anon, authenticated
    USING (bucket_id = 'task-attachments' AND public.is_app_authorized());

-- ------------------------------------------------------------------------------
-- 10. Table & Schema Privileges for PostgREST
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;

