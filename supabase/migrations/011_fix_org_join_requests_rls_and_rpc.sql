-- ==============================================================================
-- Migration: 011_fix_org_join_requests_rls_and_rpc.sql
-- Application: TASKER Enterprise Operating System
-- Target: Enable non-members to view active organizations & submit join requests reliably
-- ==============================================================================

-- 1. Ensure khandagalesuraj48@gmail.com is in public.platform_admins as super_admin
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

-- 2. Allow all authenticated users to view active organizations (so non-members can see org to join)
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can view active organizations" ON public.organizations;
CREATE POLICY "Users can view active organizations"
    ON public.organizations FOR SELECT
    TO authenticated
    USING (
        is_active = true 
        OR public.is_org_member(id) 
        OR owner_id = auth.uid() 
        OR public.is_platform_admin(auth.uid())
    );

-- 3. Bulletproof RPC to submit join requests (bypasses RLS friction safely)
CREATE OR REPLACE FUNCTION public.submit_org_join_request(
    p_org_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_email TEXT;
    v_user_name TEXT;
    v_target_org_id UUID := p_org_id;
    v_org_owner_id UUID;
    v_org_name TEXT;
    v_request_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Retrieve user details
    SELECT email, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name')
    INTO v_user_email, v_user_name 
    FROM auth.users 
    WHERE id = v_user_id;

    IF v_user_name IS NULL OR trim(v_user_name) = '' THEN
        v_user_name := split_part(v_user_email, '@', 1);
    END IF;

    -- If org_id is not provided, pick first active org
    IF v_target_org_id IS NULL THEN
        SELECT id INTO v_target_org_id FROM public.organizations WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
    END IF;

    IF v_target_org_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active organization found to join');
    END IF;

    SELECT legal_name, owner_id INTO v_org_name, v_org_owner_id 
    FROM public.organizations 
    WHERE id = v_target_org_id;

    -- Check if already an approved member
    IF EXISTS (SELECT 1 FROM public.org_memberships WHERE user_id = v_user_id AND org_id = v_target_org_id) THEN
        RETURN jsonb_build_object('success', true, 'message', 'You are already a member of this organization');
    END IF;

    -- Insert into org_join_requests
    INSERT INTO public.org_join_requests (
        org_id, user_id, user_email, user_name, requested_role, notes, status
    ) VALUES (
        v_target_org_id, v_user_id, v_user_email, v_user_name, 'team_member', COALESCE(p_notes, 'Requested via TASKER app'), 'pending'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_request_id;

    IF v_request_id IS NULL THEN
        SELECT id INTO v_request_id FROM public.org_join_requests 
        WHERE user_id = v_user_id AND org_id = v_target_org_id AND status = 'pending' LIMIT 1;
    END IF;

    -- Notify organization owner
    IF v_org_owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            recipient_user_id, organization_id, type, title, message, entity_type, entity_id
        ) VALUES (
            v_org_owner_id,
            v_target_org_id,
            'system',
            'Membership Request: ' || v_user_email,
            'User ' || v_user_email || ' has requested to join ' || COALESCE(v_org_name, 'Organization') || '.',
            'org_join_request',
            v_user_id::TEXT
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'request_id', v_request_id, 'message', 'Join request submitted successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.submit_org_join_request(UUID, TEXT) TO authenticated;

-- 4. Ensure RLS policies on public.org_join_requests are fully permissive for Admins and Requesters
ALTER TABLE public.org_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own join requests" ON public.org_join_requests;
CREATE POLICY "Users can view own join requests"
    ON public.org_join_requests FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_platform_admin(auth.uid())
        OR public.is_org_admin(org_id)
        OR EXISTS (
            SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid()
        )
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
        OR EXISTS (
            SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR public.is_org_admin(org_id)
        OR EXISTS (
            SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid()
        )
    );
