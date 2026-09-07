import { supabase } from '../lib/supabase';
import {
  Organization,
  OrgRole,
  OrgMembership,
  ErpEmployee,
  OrgDepartment,
} from '../types/enterprise';
import { TaskAssignment } from '../types/task';

export const PRIMARY_ORG_NAME = 'SAMAJ RACHANA CONSTRUCTION LIMITED';
export const OWNER_EMAIL = 'khandagalesuraj48@gmail.com';

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
 * Fetch primary organization: SAMAJ RACHANA CONSTRUCTION LIMITED
 */
export const getPrimaryOrg = async (): Promise<Organization | null> => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .ilike('legal_name', `%${PRIMARY_ORG_NAME}%`)
      .maybeSingle();

    if (!error && data) {
      return data as Organization;
    }

    // Fallback to first active organization
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
  userId: string
): Promise<void> => {
  // Find organization owner
  const { data: org } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', orgId)
    .single();

  if (!org?.owner_id) {
    throw new Error('Organization owner not found.');
  }

  // Create a system notification directed to owner
  const { error } = await supabase
    .from('notifications')
    .insert({
      recipient_user_id: org.owner_id,
      organization_id: orgId,
      type: 'system',
      title: `Membership Request: ${userEmail}`,
      message: `User ${userEmail} has requested to join ${PRIMARY_ORG_NAME}.`,
      entity_type: 'org_join_request',
      entity_id: userId,
    });

  if (error) {
    throw new Error(error.message || 'Could not send join request.');
  }
};

/**
 * Fetch pending join requests (for Owner/Admin)
 */
export const getJoinRequests = async (orgId: string): Promise<OrgJoinRequestItem[]> => {
  try {
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
