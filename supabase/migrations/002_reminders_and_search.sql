-- ==============================================================================
-- Migration: 002_reminders_and_search.sql
-- Application: My Work Tracker / TASKER
-- Scope: Smart Reminders System + Universal Search Acceleration
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Table: task_reminders
-- Centralized reminder state designed for Vercel Web & future Android TASKER App
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    remind_at TIMESTAMPTZ NOT NULL,
    recurrence_type TEXT NOT NULL DEFAULT 'once' CHECK (recurrence_type IN ('once', 'hourly', 'every_2_hours', 'daily', 'custom')),
    custom_interval_minutes INTEGER DEFAULT NULL,
    next_trigger_at TIMESTAMPTZ NOT NULL,
    last_triggered_at TIMESTAMPTZ DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dismissed', 'snoozed', 'stopped')),
    snooze_until TIMESTAMPTZ DEFAULT NULL,
    notification_channel TEXT NOT NULL DEFAULT 'system' CHECK (notification_channel IN ('system', 'browser', 'push', 'all')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.task_reminders IS 'Centralized smart reminder configuration and state for Web & Android TASKER';
COMMENT ON COLUMN public.task_reminders.recurrence_type IS 'once, hourly, every_2_hours, daily, or custom interval';
COMMENT ON COLUMN public.task_reminders.status IS 'active, completed, dismissed, snoozed, or stopped';

-- Indexes for fast lookup by task and due queries
CREATE INDEX IF NOT EXISTS idx_task_reminders_task_id ON public.task_reminders (task_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_active ON public.task_reminders (is_enabled, status, next_trigger_at);

-- ------------------------------------------------------------------------------
-- 2. Trigger: Automatically stop reminders on task completion or deletion
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_task_reminder_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
    -- When a task is marked completed or soft-deleted, immediately stop all active reminders
    IF (NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM NEW.status OR TG_OP = 'INSERT'))
       OR (NEW.is_deleted = true AND (OLD.is_deleted IS DISTINCT FROM NEW.is_deleted OR TG_OP = 'INSERT')) THEN
        UPDATE public.task_reminders
        SET
            status = 'stopped',
            is_enabled = false,
            updated_at = timezone('utc'::text, now())
        WHERE task_id = NEW.id AND status IN ('active', 'snoozed');
    END IF;

    -- When a task is restored from bin or moved away from completed, allow active reminder re-scheduling
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.is_deleted = true AND NEW.is_deleted = false AND NEW.status != 'completed')
           OR (OLD.status = 'completed' AND NEW.status != 'completed' AND NEW.is_deleted = false) THEN
            UPDATE public.task_reminders
            SET
                status = 'active',
                is_enabled = true,
                updated_at = timezone('utc'::text, now())
            WHERE task_id = NEW.id AND status = 'stopped' AND next_trigger_at > timezone('utc'::text, now());
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_reminder_lifecycle ON public.tasks;
CREATE TRIGGER trg_task_reminder_lifecycle
    AFTER INSERT OR UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_task_reminder_lifecycle();

-- ------------------------------------------------------------------------------
-- 3. Row Level Security (RLS) for task_reminders
-- ------------------------------------------------------------------------------
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access on task_reminders" ON public.task_reminders;
CREATE POLICY "Allow anon full access on task_reminders"
    ON public.task_reminders FOR ALL
    TO anon, authenticated
    USING (public.is_app_authorized())
    WITH CHECK (public.is_app_authorized());

-- ------------------------------------------------------------------------------
-- 4. Server-Side Universal Search Function
-- Searches title, description, person, status, priority, notes, history remarks,
-- and attachment filenames/metadata (strictly NO inspection inside PDF contents).
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
BEGIN
    RETURN QUERY
    WITH matches AS (
        -- 1. Exact task title (Rank 1)
        SELECT t.id AS task_id, 'title_exact'::TEXT AS matched_field, t.title AS snippet, 1 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false AND lower(t.title) = clean_q

        UNION ALL

        -- 2. Partial task title (Rank 2)
        SELECT t.id AS task_id, 'title'::TEXT AS matched_field, t.title AS snippet, 2 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false AND lower(t.title) LIKE pattern AND lower(t.title) != clean_q

        UNION ALL

        -- 3. Description (Rank 3)
        SELECT t.id AS task_id, 'description'::TEXT AS matched_field, substring(t.description from 1 for 120) AS snippet, 3 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false AND t.description IS NOT NULL AND lower(t.description) LIKE pattern

        UNION ALL

        -- 4. Notes & Remarks (Rank 4)
        SELECT tn.task_id, 'note'::TEXT AS matched_field, substring(tn.note from 1 for 120) AS snippet, 4 AS rank_score
        FROM public.task_notes tn
        JOIN public.tasks t ON t.id = tn.task_id
        WHERE t.is_deleted = false AND lower(tn.note) LIKE pattern

        UNION ALL

        -- 5. Status / Priority / Person (Rank 5)
        SELECT t.id AS task_id, 'person'::TEXT AS matched_field, t.person_name AS snippet, 5 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false AND t.person_name IS NOT NULL AND lower(t.person_name) LIKE pattern

        UNION ALL

        SELECT t.id AS task_id, 'status_priority'::TEXT AS matched_field, (t.status || ' / ' || t.priority) AS snippet, 5 AS rank_score
        FROM public.tasks t
        WHERE t.is_deleted = false AND (lower(t.status) LIKE pattern OR lower(t.priority) LIKE pattern)

        UNION ALL

        -- 6. Status History (Rank 6)
        SELECT tsh.task_id, 'status_history'::TEXT AS matched_field, substring(COALESCE(tsh.remarks, (COALESCE(tsh.old_status, 'start') || ' -> ' || tsh.new_status)) from 1 for 120) AS snippet, 6 AS rank_score
        FROM public.task_status_history tsh
        JOIN public.tasks t ON t.id = tsh.task_id
        WHERE t.is_deleted = false AND (
            (tsh.remarks IS NOT NULL AND lower(tsh.remarks) LIKE pattern)
            OR lower(tsh.new_status) LIKE pattern
            OR (tsh.old_status IS NOT NULL AND lower(tsh.old_status) LIKE pattern)
        )

        UNION ALL

        -- 7. Attachment filename / metadata (Rank 7) - strictly NO content inspection
        SELECT ta.task_id, 'attachment'::TEXT AS matched_field, ta.file_name AS snippet, 7 AS rank_score
        FROM public.task_attachments ta
        JOIN public.tasks t ON t.id = ta.task_id
        WHERE t.is_deleted = false AND (
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

-- Grant access on new table and function
GRANT ALL ON public.task_reminders TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_tasks_universal(TEXT) TO anon, authenticated;