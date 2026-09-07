import { supabase } from '../lib/supabase';
import {
  Organization,
  OrgRole,
  OrgMembership,
  OrgSite,
  ErpEmployee,
  OrgDepartment,
} from '../types/enterprise';
import { TaskAssignment } from '../types/task';

export const PRIMARY_ORG_NAME = 'Organization';

const ACTIVE_ORG_KEY = 'tasker_active_org_id';

export interface OrgMemberWithDetails {
  id: string;
  user_id: string;
  org_id: string;
  role: OrgRole;
  created_at: string;
  email?: string;
  employee?: ErpEmployee | null;
}

export interface OrgJoinRequestItem {
  id: string;
  user_id: string;
  user_email: string;
  org_id: string;
  created_at: string;
  is_read: boolean;
}

/**
 * Fetch all organizations where the user has an APPROVED membership
 */
export const getUserApprovedOrgs = async (userId: string): Promise<Organization[]> => {
  if (!userId) return [];
  try {
    const { data: memberships, error } = await supabase
      .from('org_memberships')
      .select(`
        org_id,
        organization:organizations(*)
      `)
      .eq('user_id', userId);

    if (error || !memberships) {
      return [];
    }

    const orgList: Organization[] = [];
    memberships.forEach((m: any) => {
      if (m.organization && (m.organization.is_active ?? true)) {
        orgList.push(m.organization as Organization);
      }
    });

    return orgList;
  } catch (err) {
    console.error('Error fetching user approved orgs:', err);
    return [];
  }
};

/**
 * Check whether user has a pending join request for an organization
 */
export const checkUserPendingRequest = async (userId: string, orgId: string): Promise<boolean> => {
  if (!userId || !orgId) return false;
  try {
    const { data, error } = await supabase
      .from('org_join_requests')
      .select('id')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
};

/**
 * Check whether user has ANY pending join request
 */
export const checkAnyPendingRequest = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from('org_join_requests')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .limit(1);

    if (error || !data || data.length === 0) return false;
    return true;
  } catch {
    return false;
  }
};

/**
 * Fetch all organizations accessible to current user
 */
export const getOrganizations = async (): Promise<Organization[]> => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Could not fetch organizations from Supabase:', error);
      return [];
    }

    return (data as Organization[]) || [];
  } catch (err) {
    console.error('Error fetching organizations:', err);
    return [];
  }
};

/**
 * Fetch primary active organization
 */
export const getPrimaryOrg = async (): Promise<Organization | null> => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as Organization;
    }

    // Fallback to any active organization
    const orgs = await getOrganizations();
    return orgs[0] || null;
  } catch (err) {
    console.error('Error getting primary org:', err);
    return null;
  }
};

export const getActiveOrgId = (): string => {
  return localStorage.getItem(ACTIVE_ORG_KEY) || '';
};

export const setActiveOrgId = (id: string): void => {
  localStorage.setItem(ACTIVE_ORG_KEY, id);
  window.dispatchEvent(new CustomEvent('enterprise-context-changed'));
};

/**
 * Check a user's membership and role in an organization
 */
export const getUserMembership = async (
  userId: string,
  orgId: string
): Promise<OrgMembership | null> => {
  if (!userId || !orgId) return null;
  try {
    const { data, error } = await supabase
      .from('org_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !data) return null;
    return data as OrgMembership;
  } catch {
    return null;
  }
};

/**
 * Fetch all approved members for an organization
 */
export const getOrgMembers = async (orgId: string): Promise<OrgMemberWithDetails[]> => {
  if (!orgId) return [];
  try {
    const { data: memberships, error } = await supabase
      .from('org_memberships')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (error || !memberships) {
      console.warn('Could not fetch org members:', error);
      return [];
    }

    // Fetch employee records for linking
    const { data: employees } = await supabase
      .from('erp_employees')
      .select('*')
      .eq('org_id', orgId);

    const empMap = new Map<string, ErpEmployee>();
    employees?.forEach((e: any) => {
      if (e.user_id) empMap.set(e.user_id, e);
    });

    return memberships.map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      org_id: m.org_id,
      role: m.role,
      created_at: m.created_at,
      employee: empMap.get(m.user_id) || null,
    }));
  } catch (err) {
    console.error('Error fetching org members:', err);
    return [];
  }
};

/**
 * Owner/Admin approves a user and adds them to org_memberships
 */
export const addOrgMember = async (
  orgId: string,
  userId: string,
  role: OrgRole = 'team_member',
  employeeId?: string
): Promise<OrgMembership> => {
  const { data, error } = await supabase
    .from('org_memberships')
    .upsert(
      {
        org_id: orgId,
        user_id: userId,
        role: role,
      },
      { onConflict: 'user_id,org_id' }
    )
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to add organization member');
  }

  // If an employee directory record was selected, link user_id
  if (employeeId) {
    await supabase
      .from('erp_employees')
      .update({ user_id: userId })
      .eq('id', employeeId);
  }

  return data as OrgMembership;
};

/**
 * Owner/Admin removes a user from org_memberships
 */
export const removeOrgMember = async (membershipId: string, userId?: string): Promise<void> => {
  const { error } = await supabase
    .from('org_memberships')
    .delete()
    .eq('id', membershipId);

  if (error) {
    throw new Error(error.message || 'Failed to remove organization member');
  }

  // Unlink employee if user provided
  if (userId) {
    await supabase
      .from('erp_employees')
      .update({ user_id: null })
      .eq('user_id', userId);
  }
};

/**
 * Non-member user submits a request to join the organization
 */
export const requestJoinOrg = async (
  orgId: string,
  userEmail: string,
  userId: string,
  userName?: string,
  notes?: string
): Promise<void> => {
  // 1. Try bulletproof RPC first
  try {
    const { data, error } = await supabase.rpc('submit_org_join_request', {
      p_org_id: orgId || null,
      p_notes: notes || 'Requested via TASKER app',
    });

    if (!error && data && data.success) {
      return;
    }
  } catch (rpcErr) {
    console.warn('RPC submit_org_join_request error, trying direct insert:', rpcErr);
  }

  // 2. Direct insert into public.org_join_requests table
  let targetOrgId = orgId;
  if (!targetOrgId) {
    const primary = await getPrimaryOrg();
    targetOrgId = primary?.id || '';
  }

  if (targetOrgId) {
    const { error: reqErr } = await supabase
      .from('org_join_requests')
      .insert({
        org_id: targetOrgId,
        user_id: userId,
        user_email: userEmail,
        user_name: userName || userEmail.split('@')[0],
        requested_role: 'team_member',
        notes: notes || 'Requested via TASKER app',
        status: 'pending',
      });

    if (reqErr) {
      console.warn('Could not insert org_join_request:', reqErr.message);
    }

    // 3. Also send notification to organization owner if found
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', targetOrgId)
        .maybeSingle();

      if (org?.owner_id) {
        await supabase
          .from('notifications')
          .insert({
            recipient_user_id: org.owner_id,
            organization_id: targetOrgId,
            type: 'system',
            title: `Membership Request: ${userEmail}`,
            message: `User ${userEmail} has requested to join ${PRIMARY_ORG_NAME}.`,
            entity_type: 'org_join_request',
            entity_id: userId,
          });
      }
    } catch (notifErr) {
      console.warn('Could not notify org owner:', notifErr);
    }
  }
};

/**
 * Fetch pending join requests (for Owner/Admin)
 */
export const getJoinRequests = async (orgId: string): Promise<OrgJoinRequestItem[]> => {
  try {
    // Check org_join_requests first
    const { data: reqData, error: reqErr } = await supabase
      .from('org_join_requests')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!reqErr && reqData && reqData.length > 0) {
      return reqData.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        user_email: r.user_email,
        org_id: r.org_id,
        created_at: r.created_at,
        is_read: false,
      }));
    }

    // Fallback to notifications table
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('organization_id', orgId)
      .eq('type', 'system')
      .eq('entity_type', 'org_join_request')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((n: any) => {
      const emailMatch = n.title?.replace('Membership Request: ', '').trim() || 'User';
      return {
        id: n.id,
        user_id: n.entity_id,
        user_email: emailMatch,
        org_id: n.organization_id,
        created_at: n.created_at,
        is_read: n.is_read,
      };
    });
  } catch {
    return [];
  }
};

/**
 * Fetch employees from Employee Directory
 */
export const getOrgEmployees = async (orgId: string): Promise<ErpEmployee[]> => {
  if (!orgId) return [];
  try {
    const { data, error } = await supabase
      .from('erp_employees')
      .select('*')
      .eq('org_id', orgId)
      .order('first_name', { ascending: true });

    if (error || !data) return [];
    return data as ErpEmployee[];
  } catch {
    return [];
  }
};

/**
 * Create employee in directory
 */
export const createOrgEmployee = async (
  orgId: string,
  input: {
    first_name: string;
    last_name?: string;
    designation: string;
    department_id?: string | null;
    phone?: string | null;
    email?: string | null;
    user_id?: string | null;
  }
): Promise<ErpEmployee> => {
  const employeeCode = `EMP-${Date.now().toString().slice(-4)}`;
  const { data, error } = await supabase
    .from('erp_employees')
    .insert({
      org_id: orgId,
      first_name: input.first_name.trim(),
      last_name: input.last_name?.trim() || null,
      designation: input.designation.trim(),
      department_id: input.department_id || null,
      phone: input.phone || null,
      email: input.email || null,
      user_id: input.user_id || null,
      employee_code: employeeCode,
      status: 'active',
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create employee record');
  }

  return data as ErpEmployee;
};

/**
 * Update employee in directory
 */
export const updateOrgEmployee = async (
  empId: string,
  input: Partial<ErpEmployee>
): Promise<ErpEmployee> => {
  const { data, error } = await supabase
    .from('erp_employees')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', empId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update employee record');
  }

  return data as ErpEmployee;
};

/**
 * Delete employee from directory
 */
export const deleteOrgEmployee = async (empId: string): Promise<void> => {
  const { error } = await supabase
    .from('erp_employees')
    .delete()
    .eq('id', empId);

  if (error) {
    throw new Error(error.message || 'Failed to delete employee record');
  }
};

/**
 * Fetch departments
 */
export const getOrgDepartments = async (orgId: string): Promise<OrgDepartment[]> => {
  if (!orgId) return [];
  try {
    const { data, error } = await supabase
      .from('org_departments')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (error || !data) return [];
    return data as OrgDepartment[];
  } catch {
    return [];
  }
};

/**
 * Fetch Assignment History across tasks
 */
export const getAssignmentHistory = async (
  orgId: string,
  taskId?: string
): Promise<TaskAssignment[]> => {
  if (!orgId) return [];
  try {
    let query = supabase
      .from('task_assignments')
      .select('*')
      .eq('org_id', orgId)
      .order('assigned_at', { ascending: false });

    if (taskId) {
      query = query.eq('task_id', taskId);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as TaskAssignment[];
  } catch {
    return [];
  }
};

/**
 * Fetch all sites under an organization
 */
export const getOrgSites = async (orgId: string): Promise<OrgSite[]> => {
  if (!orgId) return [];
  try {
    const { data, error } = await supabase
      .from('org_sites')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (error || !data) return [];
    return data as OrgSite[];
  } catch {
    return [];
  }
};

/**
 * Create a new site under an organization (e.g., 'VTR', '18 B')
 */
export const createOrgSite = async (
  orgId: string,
  name: string,
  code: string,
  address?: string
): Promise<OrgSite | null> => {
  if (!orgId || !name) return null;
  try {
    const { data, error } = await supabase
      .from('org_sites')
      .insert({
        org_id: orgId,
        name: name.trim(),
        code: code.trim().toUpperCase() || name.trim().toUpperCase().replace(/\s+/g, '_'),
        address: address ? address.trim() : null,
      })
      .select()
      .single();

    if (error) {
      console.warn('Could not create org site:', error.message);
      return null;
    }
    return data as OrgSite;
  } catch (e) {
    console.error('Error creating site:', e);
    return null;
  }
};

/**
 * Fetch site IDs assigned to a specific user
 */
export const getUserAssignedSites = async (
  userId: string,
  orgId: string
): Promise<string[]> => {
  if (!userId || !orgId) return [];
  try {
    const { data, error } = await supabase
      .from('org_user_sites')
      .select('site_id')
      .eq('user_id', userId)
      .eq('org_id', orgId);

    if (error || !data) return [];
    return data.map((d: any) => d.site_id);
  } catch {
    return [];
  }
};

/**
 * Assign a user to a specific site
 */
export const assignUserToSite = async (
  userId: string,
  orgId: string,
  siteId: string
): Promise<boolean> => {
  if (!userId || !orgId || !siteId) return false;
  try {
    const { error } = await supabase
      .from('org_user_sites')
      .upsert({
        user_id: userId,
        org_id: orgId,
        site_id: siteId,
      }, { onConflict: 'user_id,site_id' });

    return !error;
  } catch {
    return false;
  }
};

/**
 * Remove a user from a site
 */
export const removeUserFromSite = async (
  userId: string,
  siteId: string
): Promise<boolean> => {
  if (!userId || !siteId) return false;
  try {
    const { error } = await supabase
      .from('org_user_sites')
      .delete()
      .eq('user_id', userId)
      .eq('site_id', siteId);

    return !error;
  } catch {
    return false;
  }
};
