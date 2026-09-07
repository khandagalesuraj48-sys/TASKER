-- ==============================================================================
-- Migration: 010_central_admin_and_platform_roles.sql
-- Application: TASKER Enterprise Operating System
-- Target: Central Platform Administration, Multi-Org Control, Join Requests, Audit
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Platform Admins Table (Central Super Admin System)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    role VARCHAR(32) NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'platform_admin', 'auditor')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_platform_admin_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_user ON public.platform_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_admins_active ON public.platform_admins(is_active);

-- Helper function: check if authenticated user is active platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    IF check_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.platform_admins
        WHERE user_id = check_user_id AND is_active = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- 2. Organization Join / Access Requests Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    user_name TEXT,
    requested_role VARCHAR(32) NOT NULL DEFAULT 'team_member' CHECK (requested_role IN (
        'org_admin', 'project_manager', 'team_member', 'viewer'
    )),
    notes TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_join_requests_org ON public.org_join_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_org_join_requests_user ON public.org_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_org_join_requests_status ON public.org_join_requests(status);

-- ------------------------------------------------------------------------------
-- 3. Central Admin Audit Logs Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_email TEXT,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NOT NULL, -- 'user', 'organization', 'membership', 'request', 'role', 'directory'
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. RPC Functions for Central Administration
-- ------------------------------------------------------------------------------

-- A. Admin Dashboard Metrics (Callable by Platform Admin)
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics()
RETURNS JSONB AS $$
DECLARE
    v_total_users INT := 0;
    v_active_orgs INT := 0;
    v_pending_requests INT := 0;
    v_total_memberships INT := 0;
    v_total_platform_admins INT := 0;
    v_recent_logs JSONB := '[]'::jsonb;
BEGIN
    IF NOT public.is_platform_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Caller is not an active Platform Admin.';
    END IF;

    -- Distinct users participating in orgs or requests or tasks
    SELECT COUNT(DISTINCT user_id) INTO v_total_users FROM (
        SELECT user_id FROM public.org_memberships
        UNION
        SELECT user_id FROM public.org_join_requests
        UNION
        SELECT user_id FROM public.platform_admins
        UNION
        SELECT user_id FROM public.tasks WHERE user_id IS NOT NULL
    ) u;

    SELECT COUNT(*) INTO v_active_orgs FROM public.organizations WHERE is_active = true;
    SELECT COUNT(*) INTO v_pending_requests FROM public.org_join_requests WHERE status = 'pending';
    SELECT COUNT(*) INTO v_total_memberships FROM public.org_memberships;
    SELECT COUNT(*) INTO v_total_platform_admins FROM public.platform_admins WHERE is_active = true;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', l.id,
                'admin_email', l.admin_email,
                'action', l.action,
                'target_type', l.target_type,
                'target_id', l.target_id,
                'details', l.details,
                'created_at', l.created_at
            )
        ), '[]'::jsonb
    ) INTO v_recent_logs
    FROM (
        SELECT * FROM public.admin_audit_logs
        ORDER BY created_at DESC
        LIMIT 10
    ) l;

    RETURN jsonb_build_object(
        'success', true,
        'total_users', v_total_users,
        'active_organizations', v_active_orgs,
        'pending_requests', v_pending_requests,
        'total_memberships', v_total_memberships,
        'platform_admins_count', v_total_platform_admins,
        'recent_activity', v_recent_logs
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO authenticated;

-- B. Approve Join Request
CREATE OR REPLACE FUNCTION public.approve_join_request(p_request_id UUID, p_role VARCHAR DEFAULT 'team_member')
RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_org_name TEXT;
BEGIN
    SELECT * INTO v_req FROM public.org_join_requests WHERE id = p_request_id;
    IF v_req.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request not found');
    END IF;

    -- Verify authorization: Platform Admin OR Org Admin of this org
    IF NOT (public.is_platform_admin(v_admin_id) OR public.is_org_admin(v_req.org_id)) THEN
        RAISE EXCEPTION 'Access denied. You are not authorized to approve requests for this organization.';
    END IF;

    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;
    SELECT legal_name INTO v_org_name FROM public.organizations WHERE id = v_req.org_id;

    -- 1. Insert or update org membership (ONE user ID)
    INSERT INTO public.org_memberships (user_id, org_id, role)
    VALUES (v_req.user_id, v_req.org_id, COALESCE(p_role, v_req.requested_role, 'team_member'))
    ON CONFLICT (user_id, org_id)
    DO UPDATE SET role = COALESCE(p_role, v_req.requested_role, 'team_member');

    -- 2. Link employee directory record if not already present
    IF NOT EXISTS (SELECT 1 FROM public.erp_employees WHERE org_id = v_req.org_id AND user_id = v_req.user_id) THEN
        INSERT INTO public.erp_employees (
            org_id, user_id, first_name, last_name, employee_code, designation, email, status
        ) VALUES (
            v_req.org_id,
            v_req.user_id,
            COALESCE(v_req.user_name, split_part(v_req.user_email, '@', 1)),
            '',
            'EMP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)),
            'Team Member',
            v_req.user_email,
            'active'
        );
    END IF;

    -- 3. Mark request as approved
    UPDATE public.org_join_requests
    SET status = 'approved',
        reviewed_by = v_admin_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_request_id;

    -- 4. Send in-app notification to the approved user
    INSERT INTO public.notifications (
        recipient_user_id, organization_id, type, title, message, entity_type, entity_id
    ) VALUES (
        v_req.user_id,
        v_req.org_id,
        'system',
        'Organization Access Approved: ' || COALESCE(v_org_name, 'Workplace'),
        'Your request to join "' || COALESCE(v_org_name, 'Workplace') || '" has been approved. You can now access workplace tasks.',
        'organization',
        v_req.org_id
    );

    -- 5. Audit Log
    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
        v_admin_id,
        v_admin_email,
        'approve_join_request',
        'request',
        p_request_id::TEXT,
        jsonb_build_object(
            'org_id', v_req.org_id,
            'org_name', v_org_name,
            'user_id', v_req.user_id,
            'user_email', v_req.user_email,
            'role', COALESCE(p_role, v_req.requested_role)
        )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Request approved successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.approve_join_request(UUID, VARCHAR) TO authenticated;

-- C. Reject Join Request
CREATE OR REPLACE FUNCTION public.reject_join_request(p_request_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_org_name TEXT;
BEGIN
    SELECT * INTO v_req FROM public.org_join_requests WHERE id = p_request_id;
    IF v_req.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request not found');
    END IF;

    IF NOT (public.is_platform_admin(v_admin_id) OR public.is_org_admin(v_req.org_id)) THEN
        RAISE EXCEPTION 'Access denied. You are not authorized to review requests for this organization.';
    END IF;

    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;
    SELECT legal_name INTO v_org_name FROM public.organizations WHERE id = v_req.org_id;

    UPDATE public.org_join_requests
    SET status = 'rejected',
        rejection_reason = p_reason,
        reviewed_by = v_admin_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_request_id;

    INSERT INTO public.notifications (
        recipient_user_id, organization_id, type, title, message, entity_type, entity_id
    ) VALUES (
        v_req.user_id,
        v_req.org_id,
        'system',
        'Organization Request Update',
        'Your request to join "' || COALESCE(v_org_name, 'Workplace') || '" was not approved.' || 
        CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN ' Reason: ' || p_reason ELSE '' END,
        'organization',
        v_req.org_id
    );

    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
        v_admin_id,
        v_admin_email,
        'reject_join_request',
        'request',
        p_request_id::TEXT,
        jsonb_build_object(
            'org_id', v_req.org_id,
            'user_id', v_req.user_id,
            'user_email', v_req.user_email,
            'reason', p_reason
        )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Request rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.reject_join_request(UUID, TEXT) TO authenticated;

-- D. Create Organization (Admin RPC)
CREATE OR REPLACE FUNCTION public.create_organization_admin(
    p_legal_name TEXT,
    p_trade_name TEXT DEFAULT NULL,
    p_currency VARCHAR DEFAULT 'INR',
    p_is_active BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_org_id UUID;
BEGIN
    IF NOT public.is_platform_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Access denied. Only Platform Admins can create organizations.';
    END IF;

    IF p_legal_name IS NULL OR trim(p_legal_name) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Legal name is required');
    END IF;

    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;

    INSERT INTO public.organizations (
        legal_name, trade_name, currency, is_active, owner_id
    ) VALUES (
        trim(p_legal_name),
        trim(COALESCE(p_trade_name, p_legal_name)),
        COALESCE(p_currency, 'INR'),
        COALESCE(p_is_active, true),
        v_admin_id
    )
    RETURNING id INTO v_org_id;

    -- Add admin as org_owner
    INSERT INTO public.org_memberships (user_id, org_id, role)
    VALUES (v_admin_id, v_org_id, 'org_owner')
    ON CONFLICT (user_id, org_id) DO NOTHING;

    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
        v_admin_id,
        v_admin_email,
        'create_organization',
        'organization',
        v_org_id::TEXT,
        jsonb_build_object(
            'legal_name', p_legal_name,
            'trade_name', p_trade_name,
            'currency', p_currency
        )
    );

    RETURN jsonb_build_object('success', true, 'org_id', v_org_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_organization_admin(TEXT, TEXT, VARCHAR, BOOLEAN) TO authenticated;

-- E. Safe Platform Admin Bootstrap RPC
-- Allows granting super_admin safely.
CREATE OR REPLACE FUNCTION public.claim_or_register_super_admin(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_target_user_id UUID;
    v_existing_admins INT;
BEGIN
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT COUNT(*) INTO v_existing_admins FROM public.platform_admins WHERE is_active = true;

    -- Locate target user ID
    SELECT id INTO v_target_user_id FROM auth.users WHERE email = lower(trim(p_email)) LIMIT 1;
    IF v_target_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No user found with email: ' || p_email);
    END IF;

    -- If no active platform admin exists, allow caller to bootstrap the designated user
    -- OR if caller is already an active platform admin, allow granting to another user
    IF v_existing_admins = 0 OR public.is_platform_admin(v_caller_id) THEN
        INSERT INTO public.platform_admins (user_id, email, role, is_active, granted_by)
        VALUES (v_target_user_id, lower(trim(p_email)), 'super_admin', true, v_caller_id)
        ON CONFLICT (user_id)
        DO UPDATE SET role = 'super_admin', is_active = true, updated_at = now();

        INSERT INTO public.admin_audit_logs (
            admin_id, admin_email, action, target_type, target_id, details
        ) VALUES (
            v_caller_id,
            (SELECT email FROM auth.users WHERE id = v_caller_id),
            'bootstrap_super_admin',
            'role',
            v_target_user_id::TEXT,
            jsonb_build_object('target_email', p_email, 'role', 'super_admin')
        );

        RETURN jsonb_build_object('success', true, 'message', 'Super Admin assigned to: ' || p_email);
    ELSE
        RAISE EXCEPTION 'Access denied. Platform Admin already exists and caller is not a Platform Admin.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.claim_or_register_super_admin(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- A. Platform Admins Table RLS
DROP POLICY IF EXISTS "Platform Admins can view platform admins" ON public.platform_admins;
CREATE POLICY "Platform Admins can view platform admins"
    ON public.platform_admins FOR SELECT
    TO authenticated
    USING (public.is_platform_admin(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Platform Admins can manage platform admins" ON public.platform_admins;
CREATE POLICY "Platform Admins can manage platform admins"
    ON public.platform_admins FOR ALL
    TO authenticated
    USING (public.is_platform_admin(auth.uid()))
    WITH CHECK (public.is_platform_admin(auth.uid()));

-- B. Organizations Table RLS Extension for Platform Admin
DROP POLICY IF EXISTS "Platform Admin full control of organizations" ON public.organizations;
CREATE POLICY "Platform Admin full control of organizations"
    ON public.organizations FOR ALL
    TO authenticated
    USING (public.is_platform_admin(auth.uid()))
    WITH CHECK (public.is_platform_admin(auth.uid()));

-- C. Org Memberships Table RLS Extension for Platform Admin
DROP POLICY IF EXISTS "Platform Admin full control of memberships" ON public.org_memberships;
CREATE POLICY "Platform Admin full control of memberships"
    ON public.org_memberships FOR ALL
    TO authenticated
    USING (public.is_platform_admin(auth.uid()))
    WITH CHECK (public.is_platform_admin(auth.uid()));

-- D. Join Requests Table RLS
DROP POLICY IF EXISTS "Users can view own join requests" ON public.org_join_requests;
CREATE POLICY "Users can view own join requests"
    ON public.org_join_requests FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_platform_admin(auth.uid())
        OR public.is_org_admin(org_id)
    );

DROP POLICY IF EXISTS "Users can submit join request" ON public.org_join_requests;
CREATE POLICY "Users can submit join request"
    ON public.org_join_requests FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update join requests" ON public.org_join_requests;
CREATE POLICY "Admins can update join requests"
    ON public.org_join_requests FOR UPDATE
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR public.is_org_admin(org_id)
    )
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR public.is_org_admin(org_id)
    );

DROP POLICY IF EXISTS "Platform Admins can delete join requests" ON public.org_join_requests;
CREATE POLICY "Platform Admins can delete join requests"
    ON public.org_join_requests FOR DELETE
    TO authenticated
    USING (public.is_platform_admin(auth.uid()));

-- E. Admin Audit Logs RLS
DROP POLICY IF EXISTS "Platform Admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Platform Admins can view audit logs"
    ON public.admin_audit_logs FOR SELECT
    TO authenticated
    USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform Admins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Platform Admins can insert audit logs"
    ON public.admin_audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_platform_admin(auth.uid()));

-- F. STRICT PERSONAL TASK PRIVACY VERIFICATION
-- Ensure that personal tasks remain STRICTLY user_id = auth.uid()
-- Even Platform Admin CANNOT view another user's personal task content.
-- (This policy was already established in Migration 009 and is maintained here without alteration.)

-- ------------------------------------------------------------------------------
-- 6. Initial Super Admin Seeding
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_owner_user_id UUID;
BEGIN
    SELECT id INTO v_owner_user_id FROM auth.users WHERE lower(email) = 'khandagalesuraj48@gmail.com' LIMIT 1;
    IF v_owner_user_id IS NOT NULL THEN
        INSERT INTO public.platform_admins (user_id, email, role, is_active)
        VALUES (v_owner_user_id, 'khandagalesuraj48@gmail.com', 'super_admin', true)
        ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin', is_active = true, updated_at = now();
    END IF;
END $$;

