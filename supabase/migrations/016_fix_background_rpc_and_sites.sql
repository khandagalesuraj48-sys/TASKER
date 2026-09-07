-- ==============================================================================
-- Migration: 016_fix_background_rpc_and_sites.sql  (CORRECTED VERSION)
-- Application: TASKER Enterprise Operating System
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Fix Background Notification Sync RPC (fixes HTTP 400 / error 42804)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_unread_notifications_background(UUID, INT);

CREATE OR REPLACE FUNCTION public.get_unread_notifications_background(
    p_user_id UUID,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    recipient_user_id UUID,
    title TEXT,
    message TEXT,
    type TEXT,
    entity_type TEXT,
    entity_id UUID,
    created_at TIMESTAMPTZ,
    is_read BOOLEAN
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id,
        n.recipient_user_id,
        n.title,
        n.message,
        n.type::TEXT,
        n.entity_type::TEXT,
        n.entity_id,
        n.created_at,
        n.is_read
    FROM public.notifications n
    WHERE n.recipient_user_id = p_user_id
      AND n.is_read = false
    ORDER BY n.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_unread_notifications_background(UUID, INT) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
    ON public.notifications (recipient_user_id, is_read, created_at DESC);

-- ------------------------------------------------------------------------------
-- STEP 2: Create org_sites table (Workplace Sites like VTR, 18 B)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_sites (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id  UUID,           -- nullable: sites can exist without a project
    name        TEXT NOT NULL,
    code        TEXT NOT NULL,
    address     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_sites_org ON public.org_sites(org_id);

ALTER TABLE public.org_sites ENABLE ROW LEVEL SECURITY;

-- Unique site code per org
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_org_sites_org_code') THEN
        ALTER TABLE public.org_sites ADD CONSTRAINT uq_org_sites_org_code UNIQUE (org_id, code);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- RLS for org_sites
DROP POLICY IF EXISTS "Authenticated can view org sites" ON public.org_sites;
CREATE POLICY "Authenticated can view org sites"
    ON public.org_sites FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage org sites" ON public.org_sites;
CREATE POLICY "Admins can manage org sites"
    ON public.org_sites FOR ALL TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR public.is_org_admin(org_id)
    );

-- ------------------------------------------------------------------------------
-- STEP 3: Create org_user_sites table (User → Site assignment)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_user_sites (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    site_id     UUID NOT NULL REFERENCES public.org_sites(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_org_user_site UNIQUE (user_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_org_user_sites_user ON public.org_user_sites(user_id);
CREATE INDEX IF NOT EXISTS idx_org_user_sites_site ON public.org_user_sites(site_id);
CREATE INDEX IF NOT EXISTS idx_org_user_sites_org  ON public.org_user_sites(org_id);

ALTER TABLE public.org_user_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view site assignments" ON public.org_user_sites;
CREATE POLICY "Members can view site assignments"
    ON public.org_user_sites FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_platform_admin(auth.uid())
        OR public.is_org_admin(org_id)
    );

DROP POLICY IF EXISTS "Admins can manage site assignments" ON public.org_user_sites;
CREATE POLICY "Admins can manage site assignments"
    ON public.org_user_sites FOR ALL TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR public.is_org_admin(org_id)
    );

-- ------------------------------------------------------------------------------
-- STEP 4: Seed VTR and 18 B sites for all existing organizations
-- ------------------------------------------------------------------------------
DO $$
DECLARE v_org RECORD;
BEGIN
    FOR v_org IN SELECT id FROM public.organizations LOOP
        INSERT INTO public.org_sites (org_id, name, code, address)
        VALUES (v_org.id, 'VTR Site', 'VTR', 'VTR Location')
        ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name;

        INSERT INTO public.org_sites (org_id, name, code, address)
        VALUES (v_org.id, '18 B Site', '18_B', '18 B Development Site')
        ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name;
    END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
