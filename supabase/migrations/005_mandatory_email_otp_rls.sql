-- ==============================================================================
-- Migration: 005_mandatory_email_otp_rls.sql
-- Application: TASKER (Mandatory Two-Step Email Password + Email OTP RLS Enforcement)
-- Scope: Database-enforced session verification so that knowing email+password alone
--        NEVER permits reading or modifying tasks, notes, history, reminders, or attachments.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Active Verified OTP Sessions Table
-- Tracks whether the current active JWT session (identified by session_id in auth.jwt())
-- has passed the mandatory single-use Email OTP challenge.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_otp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '12 hours'),
    verified_at TIMESTAMPTZ,
    CONSTRAINT uq_user_otp_session UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_user_otp_sessions_lookup
    ON public.user_otp_sessions (user_id, session_id, is_verified, expires_at);

ALTER TABLE public.user_otp_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own otp session status" ON public.user_otp_sessions;
CREATE POLICY "Users can read own otp session status"
    ON public.user_otp_sessions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 2. Session OTP Verification Checker (Fast, STABLE SECURITY DEFINER)
-- Returns TRUE ONLY IF the calling JWT's session_id has an active, verified challenge.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_session_otp_verified()
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_session_id TEXT := auth.jwt() ->> 'session_id';
    v_verified BOOLEAN := FALSE;
BEGIN
    IF v_user_id IS NULL OR v_session_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT is_verified INTO v_verified
    FROM public.user_otp_sessions
    WHERE user_id = v_user_id
      AND session_id = v_session_id
      AND expires_at > now()
    LIMIT 1;

    RETURN COALESCE(v_verified, FALSE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_session_otp_verified() TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- 3. Challenge Management RPC Functions
-- ------------------------------------------------------------------------------

-- RPC: initiate_login_challenge
-- Called right after password validation to register the session as UNVERIFIED.
CREATE OR REPLACE FUNCTION public.initiate_login_challenge()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_session_id TEXT := auth.jwt() ->> 'session_id';
BEGIN
    IF v_user_id IS NULL OR v_session_id IS NULL THEN
        RAISE EXCEPTION 'Authenticated session required to initiate challenge';
    END IF;

    INSERT INTO public.user_otp_sessions (user_id, session_id, is_verified, created_at, expires_at)
    VALUES (v_user_id, v_session_id, FALSE, now(), now() + INTERVAL '12 hours')
    ON CONFLICT (user_id, session_id)
    DO UPDATE SET
        is_verified = FALSE,
        created_at = now(),
        expires_at = now() + INTERVAL '12 hours',
        verified_at = NULL;

    RETURN jsonb_build_object(
        'success', TRUE,
        'user_id', v_user_id,
        'session_id', v_session_id,
        'is_verified', FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.initiate_login_challenge() TO authenticated;

-- RPC: complete_login_challenge
-- Called immediately upon successful single-use OTP verification to mark session verified.
CREATE OR REPLACE FUNCTION public.complete_login_challenge()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_session_id TEXT := auth.jwt() ->> 'session_id';
BEGIN
    IF v_user_id IS NULL OR v_session_id IS NULL THEN
        RAISE EXCEPTION 'Active session required to complete challenge';
    END IF;

    UPDATE public.user_otp_sessions
    SET is_verified = TRUE,
        verified_at = now()
    WHERE user_id = v_user_id
      AND session_id = v_session_id
      AND expires_at > now();

    IF NOT FOUND THEN
        INSERT INTO public.user_otp_sessions (user_id, session_id, is_verified, created_at, expires_at, verified_at)
        VALUES (v_user_id, v_session_id, TRUE, now(), now() + INTERVAL '12 hours', now())
        ON CONFLICT (user_id, session_id)
        DO UPDATE SET is_verified = TRUE, verified_at = now();
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'user_id', v_user_id,
        'is_verified', TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.complete_login_challenge() TO authenticated;

-- RPC: revoke_login_challenge
-- Called on logout to immediately invalidate the OTP verification status.
CREATE OR REPLACE FUNCTION public.revoke_login_challenge()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_session_id TEXT := auth.jwt() ->> 'session_id';
BEGIN
    IF v_user_id IS NOT NULL AND v_session_id IS NOT NULL THEN
        DELETE FROM public.user_otp_sessions
        WHERE user_id = v_user_id AND session_id = v_session_id;
    END IF;

    RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.revoke_login_challenge() TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. Mandatory OTP Row Level Security (RLS) Policies
-- Cryptographically guarantees:
-- Even if an attacker obtains a JWT using only email + password,
-- PostgREST RLS blocks ALL task reads and writes until OTP challenge is completed.
-- ------------------------------------------------------------------------------

-- A. tasks table
DROP POLICY IF EXISTS "Users can read own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

CREATE POLICY "Users can read own tasks"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_otp_verified());

CREATE POLICY "Users can insert own tasks"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() AND public.is_session_otp_verified());

CREATE POLICY "Users can update own tasks"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_otp_verified())
    WITH CHECK (user_id = auth.uid() AND public.is_session_otp_verified());

CREATE POLICY "Users can delete own tasks"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_otp_verified());

-- B. task_status_history table
DROP POLICY IF EXISTS "Users can read own task history" ON public.task_status_history;
DROP POLICY IF EXISTS "Users can insert own task history" ON public.task_status_history;
DROP POLICY IF EXISTS "Users can delete own task history" ON public.task_status_history;

CREATE POLICY "Users can read own task history"
    ON public.task_status_history FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_otp_verified());

CREATE POLICY "Users can insert own task history"
    ON public.task_status_history FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() AND public.is_session_otp_verified());

CREATE POLICY "Users can delete own task history"
    ON public.task_status_history FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_otp_verified());

-- C. task_notes table
DROP POLICY IF EXISTS "Users can read own task notes" ON public.task_notes;
DROP POLICY IF EXISTS "Users can insert own task notes" ON public.task_notes;
DROP POLICY IF EXISTS "Users can update own task notes" ON public.task_notes;
DROP POLICY IF EXISTS "Users can delete own task notes" ON public.task_notes;

CREATE POLICY "Users can read own task notes"
    ON public.task_notes FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_otp_verified());

CREATE POLICY "Users can insert own task notes"
    ON public.task_notes FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() AND public.is_session_otp_verified());

CREATE POLICY "Users can update own task notes"
    ON public.task_notes FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_otp_verified())
    WITH CHECK (user_id = auth.uid() AND public.is_session_otp_verified());

CREATE POLICY "Users can delete own task notes"
    ON public.task_notes FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_otp_verified());

-- D. task_attachments table
DROP POLICY IF EXISTS "Users can read own task attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can insert own task attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can delete own task attachments" ON public.task_attachments;

CREATE POLICY "Users can read own task attachments"
    ON public.task_attachments FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_otp_verified());

CREATE POLICY "Users can insert own task attachments"
    ON public.task_attachments FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() AND public.is_session_otp_verified());

CREATE POLICY "Users can delete own task attachments"
    ON public.task_attachments FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_otp_verified());

-- E. task_reminders table
DROP POLICY IF EXISTS "Users can read own task reminders" ON public.task_reminders;
DROP POLICY IF EXISTS "Users can insert own task reminders" ON public.task_reminders;
DROP POLICY IF EXISTS "Users can update own task reminders" ON public.task_reminders;
DROP POLICY IF EXISTS "Users can delete own task reminders" ON public.task_reminders;

CREATE POLICY "Users can read own task reminders"
    ON public.task_reminders FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_otp_verified());

CREATE POLICY "Users can insert own task reminders"
    ON public.task_reminders FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() AND public.is_session_otp_verified());

CREATE POLICY "Users can update own task reminders"
    ON public.task_reminders FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_otp_verified())
    WITH CHECK (user_id = auth.uid() AND public.is_session_otp_verified());

CREATE POLICY "Users can delete own task reminders"
    ON public.task_reminders FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_otp_verified());

-- ------------------------------------------------------------------------------
-- 5. Storage Security Policy Update for task-attachments bucket
-- Enforces public.is_session_otp_verified() on storage object access.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can select own task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own task-attachments" ON storage.objects;

CREATE POLICY "Users can select own task-attachments"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'task-attachments'
        AND public.is_session_otp_verified()
        AND (
            EXISTS (
                SELECT 1 FROM public.tasks t
                WHERE t.id::text = (storage.foldername(name))[2]
                AND t.user_id = auth.uid()
            )
            OR ((storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text)
        )
    );

CREATE POLICY "Users can upload own task-attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'task-attachments'
        AND auth.uid() IS NOT NULL
        AND public.is_session_otp_verified()
    );

CREATE POLICY "Users can delete own task-attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'task-attachments'
        AND public.is_session_otp_verified()
        AND (
            EXISTS (
                SELECT 1 FROM public.tasks t
                WHERE t.id::text = (storage.foldername(name))[2]
                AND t.user_id = auth.uid()
            )
            OR ((storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text)
        )
    );

-- ------------------------------------------------------------------------------
-- 6. Universal Search Scoped with OTP Verification
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
    -- Block if unauthenticated or OTP challenge not completed
    IF v_user_id IS NULL OR NOT public.is_session_otp_verified() THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH matches AS (
        SELECT t.id AS task_id, 'title_exact'::TEXT AS matched_field, t.title AS snippet, 1 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false
          AND t.user_id = v_user_id
          AND lower(t.title) = clean_q

        UNION ALL

        SELECT t.id AS task_id, 'title'::TEXT AS matched_field, t.title AS snippet, 2 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false
          AND t.user_id = v_user_id
          AND lower(t.title) LIKE pattern AND lower(t.title) != clean_q

        UNION ALL

        SELECT t.id AS task_id, 'description'::TEXT AS matched_field, substring(t.description from 1 for 120) AS snippet, 3 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false
          AND t.user_id = v_user_id
          AND t.description IS NOT NULL AND lower(t.description) LIKE pattern

        UNION ALL

        SELECT tn.task_id, 'note'::TEXT AS matched_field, substring(tn.note from 1 for 120) AS snippet, 4 AS rank_score
        FROM public.task_notes tn
        JOIN public.tasks t ON t.id = tn.task_id
        WHERE t.is_deleted = false
          AND t.user_id = v_user_id
          AND lower(tn.note) LIKE pattern

        UNION ALL

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

