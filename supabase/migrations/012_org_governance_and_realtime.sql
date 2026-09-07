-- ==============================================================================
-- Migration: 012_org_governance_and_realtime.sql
-- Application: TASKER Enterprise Operating System
-- Target: Realtime subscriptions, Org deletion, Target org selection on join
-- ==============================================================================

-- 1. Enable Supabase Realtime Publication on critical collaboration tables
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.org_join_requests;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.org_memberships;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;

-- 2. Enhanced approve_join_request function with Target Org support
CREATE OR REPLACE FUNCTION public.approve_join_request(
    p_request_id UUID, 
    p_role VARCHAR DEFAULT 'team_member',
    p_target_org_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_org_id UUID;
    v_org_name TEXT;
BEGIN
    SELECT * INTO v_req FROM public.org_join_requests WHERE id = p_request_id;
    IF v_req.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request not found');
    END IF;

    -- Use target org if specified by admin, else fallback to request org_id
    v_org_id := COALESCE(p_target_org_id, v_req.org_id);

    -- Verify authorization: Platform Admin OR Org Admin of target org
    IF NOT (public.is_platform_admin(v_admin_id) OR public.is_org_admin(v_org_id)) THEN
        RAISE EXCEPTION 'Access denied. You are not authorized to approve requests for this organization.';
    END IF;

    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;
    SELECT legal_name INTO v_org_name FROM public.organizations WHERE id = v_org_id;

    -- 1. Insert or update org membership (ONE user ID across orgs)
    INSERT INTO public.org_memberships (user_id, org_id, role)
    VALUES (v_req.user_id, v_org_id, COALESCE(p_role, v_req.requested_role, 'team_member'))
    ON CONFLICT (user_id, org_id)
    DO UPDATE SET role = COALESCE(p_role, v_req.requested_role, 'team_member');

    -- 2. Link employee record in erp_employees if not present
    INSERT INTO public.erp_employees (
        org_id, user_id, email, full_name, role_title, is_active
    ) VALUES (
        v_org_id,
        v_req.user_id,
        v_req.user_email,
        COALESCE(v_req.user_name, split_part(v_req.user_email, '@', 1)),
        COALESCE(p_role, 'team_member'),
        true
    )
    ON CONFLICT (org_id, email)
    DO UPDATE SET user_id = v_req.user_id, is_active = true, updated_at = now();

    -- 3. Update request status
    UPDATE public.org_join_requests
    SET status = 'approved',
        org_id = v_org_id,
        reviewed_by = v_admin_id,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_request_id;

    -- 4. Send in-app notification to the approved user
    INSERT INTO public.notifications (
        recipient_user_id, organization_id, type, title, message, entity_type, entity_id
    ) VALUES (
        v_req.user_id,
        v_org_id,
        'system',
        'Organization Access Approved: ' || COALESCE(v_org_name, 'Workplace'),
        'Your request to join "' || COALESCE(v_org_name, 'Workplace') || '" has been approved. You can now access workplace tasks.',
        'organization',
        v_org_id
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
            'target_org_id', v_org_id,
            'org_name', v_org_name,
            'user_id', v_req.user_id,
            'user_email', v_req.user_email,
            'role', COALESCE(p_role, v_req.requested_role)
        )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Request approved into organization: ' || COALESCE(v_org_name, ''));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.approve_join_request(UUID, VARCHAR, UUID) TO authenticated;

-- 3. Safe Organization Deletion RPC for Platform Admins
CREATE OR REPLACE FUNCTION public.delete_organization_admin(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_org_name TEXT;
BEGIN
    IF NOT public.is_platform_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Access denied. Only Platform Admins can delete organizations.';
    END IF;

    SELECT legal_name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
    IF v_org_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
    END IF;

    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;

    -- Cleanup foreign references safely
    DELETE FROM public.org_join_requests WHERE org_id = p_org_id;
    DELETE FROM public.org_memberships WHERE org_id = p_org_id;
    DELETE FROM public.erp_employees WHERE org_id = p_org_id;
    DELETE FROM public.task_assignments WHERE org_id = p_org_id;
    UPDATE public.tasks SET org_id = NULL WHERE org_id = p_org_id;

    -- Delete organization
    DELETE FROM public.organizations WHERE id = p_org_id;

    -- Audit log
    INSERT INTO public.admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
        v_admin_id,
        v_admin_email,
        'delete_organization',
        'organization',
        p_org_id::TEXT,
        jsonb_build_object('deleted_org_name', v_org_name)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Organization deleted successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.delete_organization_admin(UUID) TO authenticated;

-- 4. Delete Demo Organization 'SAMAJ RACHANA CONSTRUCTION LIMITED'
DO $$
DECLARE
    v_demo_org_id UUID;
BEGIN
    SELECT id INTO v_demo_org_id FROM public.organizations 
    WHERE legal_name ILIKE '%SAMAJ RACHANA%' LIMIT 1;

    IF v_demo_org_id IS NOT NULL THEN
        DELETE FROM public.org_join_requests WHERE org_id = v_demo_org_id;
        DELETE FROM public.org_memberships WHERE org_id = v_demo_org_id;
        DELETE FROM public.erp_employees WHERE org_id = v_demo_org_id;
        DELETE FROM public.task_assignments WHERE org_id = v_demo_org_id;
        UPDATE public.tasks SET org_id = NULL WHERE org_id = v_demo_org_id;
        DELETE FROM public.organizations WHERE id = v_demo_org_id;
    END IF;
END $$;
