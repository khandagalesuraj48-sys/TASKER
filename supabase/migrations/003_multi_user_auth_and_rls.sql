-- ==============================================================================
-- Migration: 003_multi_user_auth_and_rls.sql
-- Application: TASKER (Multi-User Personal Work & Task Tracker)
-- Scope: Multi-User Supabase Auth, PostgreSQL RLS, Realtime & Data Safety
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Add user_id Column to All Core Tables (Additive & Non-Destructive)
-- Existing columns and primary keys are untouched.
-- ------------------------------------------------------------------------------

-- tasks table
ALTER TABLE public.tasks 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- task_status_history table
ALTER TABLE public.task_status_history 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- task_notes table
ALTER TABLE public.task_notes 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- task_attachments table
ALTER TABLE public.task_attachments 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- task_reminders table
ALTER TABLE public.task_reminders 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------------------
-- 2. Create High-Performance Indexes for user_id on All Tables
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id_active ON public.tasks (user_id, is_deleted, status);
CREATE INDEX IF NOT EXISTS idx_task_status_history_user_id ON public.task_status_history (user_id);
CREATE INDEX IF NOT EXISTS idx_task_notes_user_id ON public.task_notes (user_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_user_id ON public.task_attachments (user_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_user_id ON public.task_reminders (user_id);

-- ------------------------------------------------------------------------------
-- 3. Automatic user_id Population Trigger on INSERT
-- Ensures any row inserted by an authenticated user automatically receives auth.uid()
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        NEW.user_id := auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tasks_set_user_id ON public.tasks;
CREATE TRIGGER trg_tasks_set_user_id
    BEFORE INSERT ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_task_status_history_set_user_id ON public.task_status_history;
CREATE TRIGGER trg_task_status_history_set_user_id
    BEFORE INSERT ON public.task_status_history
    FOR EACH ROW
    EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_task_notes_set_user_id ON public.task_notes;
CREATE TRIGGER trg_task_notes_set_user_id
    BEFORE INSERT ON public.task_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_task_attachments_set_user_id ON public.task_attachments;
CREATE TRIGGER trg_task_attachments_set_user_id
    BEFORE INSERT ON public.task_attachments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_task_reminders_set_user_id ON public.task_reminders;
CREATE TRIGGER trg_task_reminders_set_user_id
    BEFORE INSERT ON public.task_reminders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_user_id_on_insert();

-- ------------------------------------------------------------------------------
-- 4. Secure Legacy Data Adoption Function
-- Preserves 100% of existing single-user tasks by assigning orphaned rows (user_id IS NULL)
-- to the authenticated user calling this function (e.g. on first signup/login).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adopt_legacy_tasks()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_tasks_count INTEGER := 0;
    v_history_count INTEGER := 0;
    v_notes_count INTEGER := 0;
    v_attachments_count INTEGER := 0;
    v_reminders_count INTEGER := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to adopt legacy tasks';
    END IF;

    -- Update tasks where user_id IS NULL
    UPDATE public.tasks
    SET user_id = v_user_id
    WHERE user_id IS NULL;
    GET DIAGNOSTICS v_tasks_count = ROW_COUNT;

    -- Update related entities to match task owner
    UPDATE public.task_status_history tsh
    SET user_id = t.user_id
    FROM public.tasks t
    WHERE tsh.task_id = t.id AND tsh.user_id IS NULL;
    GET DIAGNOSTICS v_history_count = ROW_COUNT;

    UPDATE public.task_notes tn
    SET user_id = t.user_id
    FROM public.tasks t
    WHERE tn.task_id = t.id AND tn.user_id IS NULL;
    GET DIAGNOSTICS v_notes_count = ROW_COUNT;

    UPDATE public.task_attachments ta
    SET user_id = t.user_id
    FROM public.tasks t
    WHERE ta.task_id = t.id AND ta.user_id IS NULL;
    GET DIAGNOSTICS v_attachments_count = ROW_COUNT;

    UPDATE public.task_reminders tr
    SET user_id = t.user_id
    FROM public.tasks t
    WHERE tr.task_id = t.id AND tr.user_id IS NULL;
    GET DIAGNOSTICS v_reminders_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'tasks_adopted', v_tasks_count,
        'history_adopted', v_history_count,
        'notes_adopted', v_notes_count,
        'attachments_adopted', v_attachments_count,
        'reminders_adopted', v_reminders_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.adopt_legacy_tasks() TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. Row Level Security (RLS) Multi-User Isolation Policies
-- Strictly enforces: auth.uid() = user_id at the PostgreSQL level.
-- Frontend filtering alone is not security.
-- ------------------------------------------------------------------------------

-- A. tasks RLS
DROP POLICY IF EXISTS "Allow anon full access on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can read own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

CREATE POLICY "Users can read own tasks"
    ON public.tasks FOR SELECT
    TO authenticated, anon
    USING (
        (auth.uid() IS NOT NULL AND user_id = auth.uid())
        OR (user_id IS NULL AND public.is_app_authorized())
    );

CREATE POLICY "Users can insert own tasks"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update own tasks"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() OR (user_id IS NULL AND public.is_app_authorized()))
    WITH CHECK (user_id = auth.uid() OR (user_id IS NULL AND public.is_app_authorized()));

CREATE POLICY "Users can delete own tasks"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR (user_id IS NULL AND public.is_app_authorized()));

-- B. task_status_history RLS
DROP POLICY IF EXISTS "Allow anon full access on task_status_history" ON public.task_status_history;
DROP POLICY IF EXISTS "Users can read own task history" ON public.task_status_history;
DROP POLICY IF EXISTS "Users can insert own task history" ON public.task_status_history;
DROP POLICY IF EXISTS "Users can delete own task history" ON public.task_status_history;

CREATE POLICY "Users can read own task history"
    ON public.task_status_history FOR SELECT
    TO authenticated, anon
    USING (
        (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())))
        OR (user_id IS NULL AND public.is_app_authorized())
    );

CREATE POLICY "Users can insert own task history"
    ON public.task_status_history FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
        OR (user_id IS NULL AND public.is_app_authorized())
    );

CREATE POLICY "Users can delete own task history"
    ON public.task_status_history FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
    );

-- C. task_notes RLS
DROP POLICY IF EXISTS "Allow anon full access on task_notes" ON public.task_notes;
DROP POLICY IF EXISTS "Users can read own task notes" ON public.task_notes;
DROP POLICY IF EXISTS "Users can insert own task notes" ON public.task_notes;
DROP POLICY IF EXISTS "Users can update own task notes" ON public.task_notes;
DROP POLICY IF EXISTS "Users can delete own task notes" ON public.task_notes;

CREATE POLICY "Users can read own task notes"
    ON public.task_notes FOR SELECT
    TO authenticated, anon
    USING (
        (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())))
        OR (user_id IS NULL AND public.is_app_authorized())
    );

CREATE POLICY "Users can insert own task notes"
    ON public.task_notes FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
        OR (user_id IS NULL AND public.is_app_authorized())
    );

CREATE POLICY "Users can update own task notes"
    ON public.task_notes FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
    );

CREATE POLICY "Users can delete own task notes"
    ON public.task_notes FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
    );

-- D. task_attachments RLS
DROP POLICY IF EXISTS "Allow anon full access on task_attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can read own task attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can insert own task attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can delete own task attachments" ON public.task_attachments;

CREATE POLICY "Users can read own task attachments"
    ON public.task_attachments FOR SELECT
    TO authenticated, anon
    USING (
        (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())))
        OR (user_id IS NULL AND public.is_app_authorized())
    );

CREATE POLICY "Users can insert own task attachments"
    ON public.task_attachments FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
        OR (user_id IS NULL AND public.is_app_authorized())
    );

CREATE POLICY "Users can delete own task attachments"
    ON public.task_attachments FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
    );

-- E. task_reminders RLS
DROP POLICY IF EXISTS "Allow anon full access on task_reminders" ON public.task_reminders;
DROP POLICY IF EXISTS "Users can read own task reminders" ON public.task_reminders;
DROP POLICY IF EXISTS "Users can insert own task reminders" ON public.task_reminders;
DROP POLICY IF EXISTS "Users can update own task reminders" ON public.task_reminders;
DROP POLICY IF EXISTS "Users can delete own task reminders" ON public.task_reminders;

CREATE POLICY "Users can read own task reminders"
    ON public.task_reminders FOR SELECT
    TO authenticated, anon
    USING (
        (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())))
        OR (user_id IS NULL AND public.is_app_authorized())
    );

CREATE POLICY "Users can insert own task reminders"
    ON public.task_reminders FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
        OR (user_id IS NULL AND public.is_app_authorized())
    );

CREATE POLICY "Users can update own task reminders"
    ON public.task_reminders FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
    );

CREATE POLICY "Users can delete own task reminders"
    ON public.task_reminders FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
    );

-- ------------------------------------------------------------------------------
-- 6. Storage Policies: task-attachments bucket
-- Preserves existing paths: tasks/{task_id}/{filename}
-- And supports future paths: users/{user_id}/tasks/{task_id}/{filename}
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow anon select in task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon upload to task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon update in task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon delete in task-attachments" ON storage.objects;

DROP POLICY IF EXISTS "Users can select own task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own task-attachments" ON storage.objects;

CREATE POLICY "Users can select own task-attachments"
    ON storage.objects FOR SELECT
    TO authenticated, anon
    USING (
        bucket_id = 'task-attachments' AND (
            -- User owns the task linked in the path (tasks/:taskId/...)
            EXISTS (
                SELECT 1 FROM public.tasks t
                WHERE t.id::text = (storage.foldername(name))[2]
                AND (t.user_id = auth.uid() OR t.user_id IS NULL)
            )
            -- Or user-prefixed path (users/:userId/...)
            OR ((storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text)
            -- Or backward compatible access key
            OR public.is_app_authorized()
        )
    );

CREATE POLICY "Users can upload own task-attachments"
    ON storage.objects FOR INSERT
    TO authenticated, anon
    WITH CHECK (
        bucket_id = 'task-attachments' AND (
            auth.uid() IS NOT NULL
            OR public.is_app_authorized()
        )
    );

CREATE POLICY "Users can delete own task-attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'task-attachments' AND (
            EXISTS (
                SELECT 1 FROM public.tasks t
                WHERE t.id::text = (storage.foldername(name))[2]
                AND t.user_id = auth.uid()
            )
            OR ((storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text)
        )
    );

-- ------------------------------------------------------------------------------
-- 7. User-Scoped Universal Search Function
-- Searches strictly within the calling authenticated user's tasks
-- Strictly NO inspection inside PDF / file contents.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_tasks_universal(p_query TEXT)
RETURNS TABLE (
    task_id UUID,
    matched_field TEXT,
    snippet TEXT,
    rank_score INTEGER
) AS $$
DECLARE
    clean_q TEXT := lower(trim(p_query));
    pattern TEXT := '%' || clean_q || '%';
    v_user_id UUID := auth.uid();
BEGIN
    RETURN QUERY
    WITH matches AS (
        -- 1. Exact task title (Rank 1)
        SELECT t.id AS task_id, 'title_exact'::TEXT AS matched_field, t.title AS snippet, 1 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false
          AND (v_user_id IS NULL OR t.user_id = v_user_id OR t.user_id IS NULL)
          AND lower(t.title) = clean_q

        UNION ALL

        -- 2. Partial task title (Rank 2)
        SELECT t.id AS task_id, 'title'::TEXT AS matched_field, t.title AS snippet, 2 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false
          AND (v_user_id IS NULL OR t.user_id = v_user_id OR t.user_id IS NULL)
          AND lower(t.title) LIKE pattern AND lower(t.title) != clean_q

        UNION ALL

        -- 3. Description (Rank 3)
        SELECT t.id AS task_id, 'description'::TEXT AS matched_field, substring(t.description from 1 for 120) AS snippet, 3 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false
          AND (v_user_id IS NULL OR t.user_id = v_user_id OR t.user_id IS NULL)
          AND t.description IS NOT NULL AND lower(t.description) LIKE pattern

        UNION ALL

        -- 4. Notes & Remarks (Rank 4)
        SELECT tn.task_id, 'note'::TEXT AS matched_field, substring(tn.note from 1 for 120) AS snippet, 4 AS rank_score
        FROM public.task_notes tn
        JOIN public.tasks t ON t.id = tn.task_id
        WHERE t.is_deleted = false
          AND (v_user_id IS NULL OR t.user_id = v_user_id OR t.user_id IS NULL)
          AND lower(tn.note) LIKE pattern

        UNION ALL

        -- 5. Status / Priority / Person (Rank 5)
        SELECT t.id AS task_id, 'person'::TEXT AS matched_field, t.person_name AS snippet, 5 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false
          AND (v_user_id IS NULL OR t.user_id = v_user_id OR t.user_id IS NULL)
          AND t.person_name IS NOT NULL AND lower(t.person_name) LIKE pattern

        UNION ALL

        SELECT t.id AS task_id, 'status_priority'::TEXT AS matched_field, (t.status || ' / ' || t.priority) AS snippet, 5 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false
          AND (v_user_id IS NULL OR t.user_id = v_user_id OR t.user_id IS NULL)
          AND (lower(t.status) LIKE pattern OR lower(t.priority) LIKE pattern)

        UNION ALL

        -- 6. Status History (Rank 6)
        SELECT tsh.task_id, 'status_history'::TEXT AS matched_field, substring(COALESCE(tsh.remarks, (COALESCE(tsh.old_status, 'start') || ' -> ' || tsh.new_status)) from 1 for 120) AS snippet, 6 AS rank_score
        FROM public.task_status_history tsh
        JOIN public.tasks t ON t.id = tsh.task_id
        WHERE t.is_deleted = false
          AND (v_user_id IS NULL OR t.user_id = v_user_id OR t.user_id IS NULL)
          AND (
            (tsh.remarks IS NOT NULL AND lower(tsh.remarks) LIKE pattern)
            OR lower(tsh.new_status) LIKE pattern
            OR (tsh.old_status IS NOT NULL AND lower(tsh.old_status) LIKE pattern)
          )

        UNION ALL

        -- 7. Attachment filename / metadata (Rank 7) - strictly NO content inspection
        SELECT ta.task_id, 'attachment'::TEXT AS matched_field, ta.file_name AS snippet, 7 AS rank_score
        FROM public.task_attachments ta
        JOIN public.tasks t ON t.id = ta.task_id
        WHERE t.is_deleted = false
          AND (v_user_id IS NULL OR t.user_id = v_user_id OR t.user_id IS NULL)
          AND (
            lower(ta.file_name) LIKE pattern
            OR (ta.file_type IS NOT NULL AND lower(ta.file_type) LIKE pattern)
          )
    )
    SELECT DISTINCT ON (m.task_id)
        m.task_id,
        m.matched_field,
        m.snippet,
        m.rank_score
    FROM matches m
    ORDER BY m.task_id, m.rank_score ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 8. Enable Supabase Realtime Replication on Core Tables
-- Required for instant updates across Web, Mobile, and future Android app
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_status_history;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_notes;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_attachments;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_reminders;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

