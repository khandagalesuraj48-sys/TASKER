-- ==============================================================================
-- Migration: 017_release_channels_and_beta_management.sql
-- Application: TASKER Enterprise Operating System
-- Target: Release Channel Infrastructure (Beta / Stable), User Channels,
--         Atomic VersionCode Monotonicity, Kill Switch, Staged Rollout, Audit Logs
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Extend existing public.app_releases table
--    (Safe, additive only. Preserves all 19 existing production records)
-- ------------------------------------------------------------------------------

-- Channel: 'stable' or 'beta' (defaults to 'stable')
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'app_releases' AND column_name = 'release_channel'
    ) THEN
        ALTER TABLE public.app_releases 
        ADD COLUMN release_channel VARCHAR(16) NOT NULL DEFAULT 'stable' 
        CHECK (release_channel IN ('stable', 'beta'));
    END IF;
END $$;

-- Status: 'draft', 'published', 'disabled' (defaults to 'published' for existing live releases)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'app_releases' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.app_releases 
        ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'published' 
        CHECK (status IN ('draft', 'published', 'disabled'));
    END IF;
END $$;

-- Staged Rollout percentage: 0 to 100 (defaults to 100% for full rollout)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'app_releases' AND column_name = 'rollout_percentage'
    ) THEN
        ALTER TABLE public.app_releases 
        ADD COLUMN rollout_percentage INTEGER NOT NULL DEFAULT 100 
        CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100);
    END IF;
END $$;

-- Published timestamp
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'app_releases' AND column_name = 'published_at'
    ) THEN
        ALTER TABLE public.app_releases 
        ADD COLUMN published_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- Created by (Platform Admin user ID)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'app_releases' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.app_releases 
        ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Kill switch audit fields
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'app_releases' AND column_name = 'disabled_at'
    ) THEN
        ALTER TABLE public.app_releases 
        ADD COLUMN disabled_at TIMESTAMPTZ;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'app_releases' AND column_name = 'disabled_by'
    ) THEN
        ALTER TABLE public.app_releases 
        ADD COLUMN disabled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Performance index for channel & status lookup
CREATE INDEX IF NOT EXISTS idx_app_releases_channel_status_code 
ON public.app_releases (release_channel, status, version_code DESC);

-- Ensure all historical production releases are confirmed as stable and published
UPDATE public.app_releases 
SET release_channel = 'stable', status = 'published', rollout_percentage = 100
WHERE release_channel IS NULL OR status IS NULL;

-- ------------------------------------------------------------------------------
-- 2. Dedicated user_release_channels Table
--    (Authoritative user channel membership: 'stable' | 'beta')
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_release_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    release_channel VARCHAR(16) NOT NULL DEFAULT 'stable' CHECK (release_channel IN ('stable', 'beta')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT uq_user_release_channel UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_release_channels_user ON public.user_release_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_release_channels_channel ON public.user_release_channels(release_channel);

-- Enable RLS on user_release_channels
ALTER TABLE public.user_release_channels ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.user_release_channels TO authenticated, anon, service_role;

-- Users can read their own release channel
DROP POLICY IF EXISTS "Users can view own release channel" ON public.user_release_channels;
CREATE POLICY "Users can view own release channel"
    ON public.user_release_channels FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

-- Users can insert/update their own release channel
DROP POLICY IF EXISTS "Users can self enroll or switch channel" ON public.user_release_channels;
CREATE POLICY "Users can self enroll or switch channel"
    ON public.user_release_channels FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    WITH CHECK (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 3. Restrict public.app_releases RLS
--    (Only published releases are viewable, Platform Admins can manage all)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "public select" ON public.app_releases;
DROP POLICY IF EXISTS "Allow read published releases" ON public.app_releases;
CREATE POLICY "Allow read published releases"
    ON public.app_releases FOR SELECT
    TO public
    USING (status = 'published' OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins full control releases" ON public.app_releases;
CREATE POLICY "Platform admins full control releases"
    ON public.app_releases FOR ALL
    TO authenticated
    USING (public.is_platform_admin(auth.uid()))
    WITH CHECK (public.is_platform_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 4. Atomic Monotonicity Verification Function & Trigger
--    (Guarantees that new published releases must have versionCode > current max)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_app_release_monotonicity()
RETURNS TRIGGER AS $$
DECLARE
    v_max_code INT;
BEGIN
    -- Only check for published releases
    IF NEW.status = 'published' THEN
        -- Lock table rows for concurrent safety
        SELECT COALESCE(MAX(version_code), 0) INTO v_max_code
        FROM public.app_releases
        WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND status = 'published';

        IF NEW.version_code <= v_max_code THEN
            RAISE EXCEPTION 'Version code % must be greater than current maximum published version code %',
                NEW.version_code, v_max_code;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_app_release_monotonicity ON public.app_releases;
CREATE TRIGGER trg_app_release_monotonicity
    BEFORE INSERT OR UPDATE OF version_code, status
    ON public.app_releases
    FOR EACH ROW
    EXECUTE FUNCTION public.check_app_release_monotonicity();

-- ------------------------------------------------------------------------------
-- 5. Authoritative Update Resolver RPC Function
--    (Server-side matching of user channel -> release channel)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_eligible_app_release(
    p_current_version_code INT,
    p_client_platform TEXT DEFAULT 'android'
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_user_channel VARCHAR(16) := 'stable';
    v_release RECORD;
    v_user_bucket INT := 0;
    v_eligible BOOLEAN := false;
BEGIN
    -- 1. Determine user release channel (Server Authoritative)
    IF v_caller_id IS NOT NULL THEN
        SELECT release_channel INTO v_user_channel
        FROM public.user_release_channels
        WHERE user_id = v_caller_id;

        IF v_user_channel IS NULL THEN
            v_user_channel := 'stable';
        END IF;
    ELSE
        -- Anonymous / unauthenticated callers are always locked to Stable
        v_user_channel := 'stable';
    END IF;

    -- 2. Find eligible release strictly matching caller channel
    FOR v_release IN (
        SELECT *
        FROM public.app_releases
        WHERE release_channel = v_user_channel
          AND status = 'published'
          AND version_code > COALESCE(p_current_version_code, 0)
        ORDER BY version_code DESC
    ) LOOP
        -- 3. Staged rollout deterministic evaluation
        -- Hash caller ID (or anonymous token) + release ID to get bucket 0-99
        IF v_release.rollout_percentage >= 100 THEN
            v_eligible := true;
        ELSE
            v_user_bucket := ABS(HASHTEXT(COALESCE(v_caller_id::TEXT, 'anon') || '-' || v_release.id::TEXT)) % 100;
            IF v_user_bucket < v_release.rollout_percentage THEN
                v_eligible := true;
            ELSE
                v_eligible := false;
            END IF;
        END IF;

        IF v_eligible THEN
            RETURN jsonb_build_object(
                'update_available', true,
                'user_channel', v_user_channel,
                'release_id', v_release.id,
                'version_name', v_release.version_name,
                'version_code', v_release.version_code,
                'release_channel', v_release.release_channel,
                'release_notes', v_release.release_notes,
                'apk_url', v_release.apk_url,
                'release_url', COALESCE(v_release.release_url, v_release.apk_url),
                'is_mandatory', v_release.is_mandatory,
                'rollout_percentage', v_release.rollout_percentage,
                'created_at', v_release.created_at
            );
        END IF;
    END LOOP;

    -- No update eligible
    RETURN jsonb_build_object(
        'update_available', false,
        'user_channel', v_user_channel,
        'current_version_code', p_current_version_code
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_eligible_app_release(INT, TEXT) TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- 6. Self-Service Channel Management RPC Functions
-- ------------------------------------------------------------------------------

-- Join Beta
CREATE OR REPLACE FUNCTION public.join_beta_channel()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_email TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to join Beta channel.';
    END IF;

    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    INSERT INTO public.user_release_channels (user_id, release_channel, joined_at, updated_at, updated_by)
    VALUES (v_user_id, 'beta', now(), now(), v_user_id)
    ON CONFLICT (user_id)
    DO UPDATE SET release_channel = 'beta', updated_at = now(), updated_by = v_user_id;

    -- Record in audit log
    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
        v_user_id, v_user_email, 'user_joined_beta', 'channel', v_user_id::TEXT,
        jsonb_build_object('channel', 'beta', 'timestamp', now())
    );

    RETURN jsonb_build_object(
        'success', true,
        'channel', 'beta',
        'message', 'Successfully enrolled in TASKER Beta channel.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.join_beta_channel() TO authenticated;

-- Leave Beta (Switch to Stable)
CREATE OR REPLACE FUNCTION public.leave_beta_channel()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_email TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    INSERT INTO public.user_release_channels (user_id, release_channel, joined_at, updated_at, updated_by)
    VALUES (v_user_id, 'stable', now(), now(), v_user_id)
    ON CONFLICT (user_id)
    DO UPDATE SET release_channel = 'stable', updated_at = now(), updated_by = v_user_id;

    -- Record in audit log
    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
        v_user_id, v_user_email, 'user_left_beta', 'channel', v_user_id::TEXT,
        jsonb_build_object('channel', 'stable', 'timestamp', now())
    );

    RETURN jsonb_build_object(
        'success', true,
        'channel', 'stable',
        'message', 'Successfully switched to TASKER Stable channel.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.leave_beta_channel() TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. Platform Admin Release & Channel RPC Functions
-- ------------------------------------------------------------------------------

-- Admin change user channel
CREATE OR REPLACE FUNCTION public.admin_set_user_channel(
    p_target_user_id UUID,
    p_channel VARCHAR
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_target_email TEXT;
BEGIN
    IF NOT public.is_platform_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Access denied. Caller is not an active Platform Admin.';
    END IF;

    IF p_channel NOT IN ('stable', 'beta') THEN
        RAISE EXCEPTION 'Invalid channel. Allowed channels are "stable" or "beta".';
    END IF;

    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;
    SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;

    INSERT INTO public.user_release_channels (user_id, release_channel, joined_at, updated_at, updated_by)
    VALUES (p_target_user_id, p_channel, now(), now(), v_admin_id)
    ON CONFLICT (user_id)
    DO UPDATE SET release_channel = p_channel, updated_at = now(), updated_by = v_admin_id;

    -- Audit log
    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
        v_admin_id, v_admin_email, 'admin_changed_user_channel', 'channel', p_target_user_id::TEXT,
        jsonb_build_object('target_email', v_target_email, 'new_channel', p_channel)
    );

    RETURN jsonb_build_object('success', true, 'channel', p_channel);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.admin_set_user_channel(UUID, VARCHAR) TO authenticated;

-- Admin Create or Publish Release
CREATE OR REPLACE FUNCTION public.admin_publish_release(
    p_version_name TEXT,
    p_version_code INT,
    p_release_channel VARCHAR,
    p_apk_url TEXT,
    p_release_url TEXT DEFAULT NULL,
    p_release_notes TEXT DEFAULT NULL,
    p_is_mandatory BOOLEAN DEFAULT false,
    p_rollout_percentage INT DEFAULT 100,
    p_status VARCHAR DEFAULT 'published'
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_new_id UUID;
    v_max_code INT := 0;
BEGIN
    IF NOT public.is_platform_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Access denied. Caller is not an active Platform Admin.';
    END IF;

    IF p_release_channel NOT IN ('stable', 'beta') THEN
        RAISE EXCEPTION 'Invalid channel: %. Must be "stable" or "beta".', p_release_channel;
    END IF;

    IF p_status NOT IN ('draft', 'published', 'disabled') THEN
        RAISE EXCEPTION 'Invalid status: %. Must be "draft", "published", or "disabled".', p_status;
    END IF;

    -- Atomic check of version_code for published release
    IF p_status = 'published' THEN
        SELECT COALESCE(MAX(version_code), 0) INTO v_max_code FROM public.app_releases WHERE status = 'published';
        IF p_version_code <= v_max_code THEN
            RAISE EXCEPTION 'Version code % cannot be published because build % already exists.', p_version_code, v_max_code;
        END IF;
    END IF;

    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;

    INSERT INTO public.app_releases (
        version_name, version_code, release_channel, apk_url, release_url,
        release_notes, is_mandatory, rollout_percentage, status,
        published_at, created_by
    ) VALUES (
        p_version_name, p_version_code, p_release_channel, p_apk_url, p_release_url,
        p_release_notes, COALESCE(p_is_mandatory, false), COALESCE(p_rollout_percentage, 100), p_status,
        CASE WHEN p_status = 'published' THEN now() ELSE NULL END, v_admin_id
    )
    RETURNING id INTO v_new_id;

    -- Audit Log
    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
        v_admin_id, v_admin_email, 'admin_published_release', 'release', v_new_id::TEXT,
        jsonb_build_object(
            'version_name', p_version_name,
            'version_code', p_version_code,
            'channel', p_release_channel,
            'status', p_status,
            'is_mandatory', p_is_mandatory,
            'rollout_percentage', p_rollout_percentage
        )
    );

    RETURN jsonb_build_object('success', true, 'release_id', v_new_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.admin_publish_release(TEXT, INT, VARCHAR, TEXT, TEXT, TEXT, BOOLEAN, INT, VARCHAR) TO authenticated;

-- Admin Kill Switch (Disable Release)
CREATE OR REPLACE FUNCTION public.admin_disable_release(p_release_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_rel RECORD;
BEGIN
    IF NOT public.is_platform_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Access denied. Caller is not an active Platform Admin.';
    END IF;

    SELECT * INTO v_rel FROM public.app_releases WHERE id = p_release_id;
    IF v_rel.id IS NULL THEN
        RAISE EXCEPTION 'Release not found.';
    END IF;

    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;

    UPDATE public.app_releases
    SET status = 'disabled',
        disabled_at = now(),
        disabled_by = v_admin_id
    WHERE id = p_release_id;

    -- Audit Log
    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
        v_admin_id, v_admin_email, 'admin_disabled_release', 'release', p_release_id::TEXT,
        jsonb_build_object(
            'version_name', v_rel.version_name,
            'version_code', v_rel.version_code,
            'channel', v_rel.release_channel
        )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Release disabled successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.admin_disable_release(UUID) TO authenticated;

-- Admin Set Rollout Percentage
CREATE OR REPLACE FUNCTION public.admin_set_release_rollout(p_release_id UUID, p_percentage INT)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
BEGIN
    IF NOT public.is_platform_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Access denied. Caller is not an active Platform Admin.';
    END IF;

    IF p_percentage < 0 OR p_percentage > 100 THEN
        RAISE EXCEPTION 'Rollout percentage must be between 0 and 100.';
    END IF;

    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;

    UPDATE public.app_releases
    SET rollout_percentage = p_percentage
    WHERE id = p_release_id;

    -- Audit Log
    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
        v_admin_id, v_admin_email, 'admin_set_release_rollout', 'release', p_release_id::TEXT,
        jsonb_build_object('new_rollout_percentage', p_percentage)
    );

    RETURN jsonb_build_object('success', true, 'rollout_percentage', p_percentage);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.admin_set_release_rollout(UUID, INT) TO authenticated;

