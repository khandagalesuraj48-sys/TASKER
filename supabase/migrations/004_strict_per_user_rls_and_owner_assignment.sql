-- ==============================================================================
-- Migration: 004_strict_per_user_rls_and_owner_assignment.sql
-- Application: TASKER (Multi-User Security & Controlled Owner Legacy Claim)
-- Scope: Strict Per-User RLS, Zero-Data-Leak for New Users, Server-Side Owner Assignment
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Strict Row Level Security (RLS) Policies
-- Enforces: user_id = auth.uid() strictly.
-- CRITICAL FIX: Eliminates any fallback allowing user_id IS NULL to authenticated users.
-- Newly registered users will see 0 tasks, 0 notes, 0 history, 0 attachments.
-- ------------------------------------------------------------------------------

-- A. tasks table
DROP POLICY IF EXISTS "Users can read own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

CREATE POLICY "Users can read own tasks"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tasks"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tasks"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own tasks"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- B. task_status_history table
DROP POLICY IF EXISTS "Users can read own task history" ON public.task_status_history;
DROP POLICY IF EXISTS "Users can insert own task history" ON public.task_status_history;
DROP POLICY IF EXISTS "Users can delete own task history" ON public.task_status_history;

CREATE POLICY "Users can read own task history"
    ON public.task_status_history FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own task history"
    ON public.task_status_history FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own task history"
    ON public.task_status_history FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- C. task_notes table
DROP POLICY IF EXISTS "Users can read own task notes" ON public.task_notes;
DROP POLICY IF EXISTS "Users can insert own task notes" ON public.task_notes;
DROP POLICY IF EXISTS "Users can update own task notes" ON public.task_notes;
DROP POLICY IF EXISTS "Users can delete own task notes" ON public.task_notes;

CREATE POLICY "Users can read own task notes"
    ON public.task_notes FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own task notes"
    ON public.task_notes FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own task notes"
    ON public.task_notes FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own task notes"
    ON public.task_notes FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- D. task_attachments table
DROP POLICY IF EXISTS "Users can read own task attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can insert own task attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can delete own task attachments" ON public.task_attachments;

CREATE POLICY "Users can read own task attachments"
    ON public.task_attachments FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own task attachments"
    ON public.task_attachments FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own task attachments"
    ON public.task_attachments FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- E. task_reminders table
DROP POLICY IF EXISTS "Users can read own task reminders" ON public.task_reminders;
DROP POLICY IF EXISTS "Users can insert own task reminders" ON public.task_reminders;
DROP POLICY IF EXISTS "Users can update own task reminders" ON public.task_reminders;
DROP POLICY IF EXISTS "Users can delete own task reminders" ON public.task_reminders;

CREATE POLICY "Users can read own task reminders"
    ON public.task_reminders FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own task reminders"
    ON public.task_reminders FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own task reminders"
    ON public.task_reminders FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own task reminders"
    ON public.task_reminders FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 2. Strict Storage Security Policies: task-attachments bucket
-- Ensures User B cannot access, read, or generate signed URLs for User A's attachments.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can select own task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own task-attachments" ON storage.objects;

CREATE POLICY "Users can select own task-attachments"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'task-attachments' AND (
            -- User owns the task in path (tasks/:taskId/...)
            EXISTS (
                SELECT 1 FROM public.tasks t
                WHERE t.id::text = (storage.foldername(name))[2]
                AND t.user_id = auth.uid()
            )
            -- Or user-scoped path (users/:userId/...)
            OR ((storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text)
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
            EXISTS (
                SELECT 1 FROM public.tasks t
                WHERE t.id::text = (storage.foldername(name))[2]
                AND t.user_id = auth.uid()
            )
            OR ((storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text)
        )
    );

-- ------------------------------------------------------------------------------
-- 3. Strict User-Scoped Universal Search Function
-- Searches strictly within auth.uid() tasks. Zero data leakage across users.
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
    -- If unauthenticated, return empty
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH matches AS (
        -- 1. Exact task title (Rank 1)
        SELECT t.id AS task_id, 'title_exact'::TEXT AS matched_field, t.title AS snippet, 1 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false
          AND t.user_id = v_user_id
          AND lower(t.title) = clean_q

        UNION ALL

        -- 2. Partial task title (Rank 2)
        SELECT t.id AS task_id, 'title'::TEXT AS matched_field, t.title AS snippet, 2 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false
          AND t.user_id = v_user_id
          AND lower(t.title) LIKE pattern AND lower(t.title) != clean_q

        UNION ALL

        -- 3. Description (Rank 3)
        SELECT t.id AS task_id, 'description'::TEXT AS matched_field, substring(t.description from 1 for 120) AS snippet, 3 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false
          AND t.user_id = v_user_id
          AND t.description IS NOT NULL AND lower(t.description) LIKE pattern

        UNION ALL

        -- 4. Notes & Remarks (Rank 4)
        SELECT tn.task_id, 'note'::TEXT AS matched_field, substring(tn.note from 1 for 120) AS snippet, 4 AS rank_score
        FROM public.task_notes tn
        JOIN public.tasks t ON t.id = tn.task_id
        WHERE t.is_deleted = false
          AND t.user_id = v_user_id
          AND lower(tn.note) LIKE pattern

        UNION ALL

        -- 5. Status / Priority / Person (Rank 5)
        SELECT t.id AS task_id, 'person'::TEXT AS matched_field, t.person_name AS snippet, 5 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false
          AND t.user_id = v_user_id
          AND t.person_name IS NOT NULL AND lower(t.person_name) LIKE pattern

        UNION ALL

        SELECT t.id AS task_id, 'status_priority'::TEXT AS matched_field, (t.status || ' / ' || t.priority) AS snippet, 5 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false
          AND t.user_id = v_user_id
          AND (lower(t.status) LIKE pattern OR lower(t.priority) LIKE pattern)

        UNION ALL

        -- 6. Status History (Rank 6)
        SELECT tsh.task_id, 'status_history'::TEXT AS matched_field, substring(COALESCE(tsh.remarks, (COALESCE(tsh.old_status, 'start') || ' -> ' || tsh.new_status)) from 1 for 120) AS snippet, 6 AS rank_score
        FROM public.task_status_history tsh
        JOIN public.tasks t ON t.id = tsh.task_id
        WHERE t.is_deleted = false
          AND t.user_id = v_user_id
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
          AND t.user_id = v_user_id
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
-- 4. Secure Server-Side Controlled Legacy Data Ownership Assignment
-- Allows assigning existing orphaned single-user tasks to the legitimate owner account
-- using the owner's registered email address.
-- Execution: Can be run in the Supabase SQL Editor by the owner:
--   SELECT public.assign_legacy_data_to_owner('owner_email@example.com');
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_legacy_data_to_owner(p_owner_email TEXT)
RETURNS JSONB AS $$
DECLARE
    v_owner_uid UUID;
    v_tasks_count INTEGER := 0;
    v_history_count INTEGER := 0;
    v_notes_count INTEGER := 0;
    v_attachments_count INTEGER := 0;
    v_reminders_count INTEGER := 0;
BEGIN
    -- Check if owner email exists in auth.users
    SELECT id INTO v_owner_uid 
    FROM auth.users 
    WHERE lower(email) = lower(trim(p_owner_email))
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_owner_uid IS NULL THEN
        RAISE EXCEPTION 'Owner account with email "%" was not found in auth.users. Please ensure the owner has created an account first.', p_owner_email;
    END IF;

    -- Permanently assign legacy tasks where user_id IS NULL
    UPDATE public.tasks
    SET user_id = v_owner_uid
    WHERE user_id IS NULL;
    GET DIAGNOSTICS v_tasks_count = ROW_COUNT;

    -- Assign related records
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
        'success', true,
        'owner_email', p_owner_email,
        'owner_uid', v_owner_uid,
        'tasks_assigned', v_tasks_count,
        'history_assigned', v_history_count,
        'notes_assigned', v_notes_count,
        'attachments_assigned', v_attachments_count,
        'reminders_assigned', v_reminders_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check status of legacy data
CREATE OR REPLACE FUNCTION public.get_legacy_data_status()
RETURNS JSONB AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.tasks WHERE user_id IS NULL;
    RETURN jsonb_build_object(
        'has_unclaimed_legacy_data', v_count > 0,
        'unclaimed_tasks_count', v_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_legacy_data_status() TO authenticated, anon;

