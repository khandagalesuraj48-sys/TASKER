-- ==============================================================================
-- Migration: 016_fix_background_rpc_and_sites.sql
-- Application: TASKER Enterprise Operating System
-- Target: 
--   1. Fix Background Sync RPC (use SETOF public.notifications to prevent type mismatch 42804)
--   2. Multi-Site Architecture inside Organization (e.g. Rachana -> VTR, 18 B)
--   3. User-to-Site assignment mapping
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Fix Background Notification Sync RPC
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_unread_notifications_background(UUID, INT);

CREATE OR REPLACE FUNCTION public.get_unread_notifications_background(
    p_user_id UUID,
    p_limit INT DEFAULT 20
)
RETURNS SETOF public.notifications
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.notifications n
    WHERE n.recipient_user_id = p_user_id
      AND n.is_read = false
    ORDER BY n.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_unread_notifications_background(UUID, INT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Multi-Site Architecture inside Organizations
-- ------------------------------------------------------------------------------
-- Allow org_sites to be created directly under an organization without requiring a project
ALTER TABLE IF EXISTS public.org_sites ALTER COLUMN project_id DROP NOT NULL;

-- Ensure org_sites has unique site code per organization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_org_sites_org_code'
    ) THEN
        ALTER TABLE public.org_sites ADD CONSTRAINT uq_org_sites_org_code UNIQUE (org_id, code);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 3. User Site Assignment (org_user_sites)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_user_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES public.org_sites(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_org_user_site UNIQUE (user_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_org_user_sites_user ON public.org_user_sites(user_id);
CREATE INDEX IF NOT EXISTS idx_org_user_sites_site ON public.org_user_sites(site_id);
CREATE INDEX IF NOT EXISTS idx_org_user_sites_org ON public.org_user_sites(org_id);

ALTER TABLE public.org_user_sites ENABLE ROW LEVEL SECURITY;

-- Policies for org_user_sites
DROP POLICY IF EXISTS "Members can view site assignments" ON public.org_user_sites;
CREATE POLICY "Members can view site assignments"
    ON public.org_user_sites FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR
        public.is_platform_admin(auth.uid())
        OR
        public.is_org_admin(org_id)
    );

DROP POLICY IF EXISTS "Admins can manage site assignments" ON public.org_user_sites;
CREATE POLICY "Admins can manage site assignments"
    ON public.org_user_sites FOR ALL
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR
        public.is_org_admin(org_id)
    );

-- Allow authenticated users to view org_sites for their organizations
DROP POLICY IF EXISTS "Authenticated can view org sites" ON public.org_sites;
CREATE POLICY "Authenticated can view org sites"
    ON public.org_sites FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can manage org sites" ON public.org_sites;
CREATE POLICY "Admins can manage org sites"
    ON public.org_sites FOR ALL
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR
        public.is_org_admin(org_id)
    );

-- ------------------------------------------------------------------------------
-- 4. Seed default sites 'VTR' and '18 B' for organizations
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_org RECORD;
BEGIN
    FOR v_org IN SELECT id FROM public.organizations LOOP
        -- Seed VTR
        INSERT INTO public.org_sites (org_id, name, code, address)
        VALUES (v_org.id, 'VTR Site', 'VTR', 'Main VTR Location')
        ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name;

        -- Seed 18 B
        INSERT INTO public.org_sites (org_id, name, code, address)
        VALUES (v_org.id, '18 B Site', '18_B', '18 B Development Site')
        ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name;
    END LOOP;
END $$;
