import { supabase } from '../lib/supabase';
import { PlatformAdmin, OrgJoinRequest, AdminAuditLog, AdminDashboardMetrics } from '../types/admin';
import { Organization, OrgMembership, ErpEmployee } from '../types/enterprise';

export const adminService = {
  /**
   * Check whether a user is a verified Platform Admin.
   * Securely checked against database table public.platform_admins.
   */
  async isPlatformAdmin(userId: string): Promise<boolean> {
    if (!userId) return false;
    try {
      const { data, error } = await supabase
        .from('platform_admins')
        .select('id, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.warn('Error verifying platform admin status:', error.message);
        return false;
      }
      return Boolean(data?.is_active);
    } catch {
      return false;
    }
  },

  /**
   * Fetch current user's platform admin profile
   */
  async getAdminProfile(userId: string): Promise<PlatformAdmin | null> {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('platform_admins')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) return null;
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Fetch aggregate admin dashboard metrics
   */
  async getDashboardMetrics(): Promise<AdminDashboardMetrics> {
    try {
      // 1. Try server RPC function
      const { data, error } = await supabase.rpc('get_admin_dashboard_metrics');
      if (!error && data && data.success) {
        return {
          total_users: data.total_users || 0,
          active_organizations: data.active_organizations || 0,
          pending_requests: data.pending_requests || 0,
          total_memberships: data.total_memberships || 0,
          platform_admins_count: data.platform_admins_count || 0,
          recent_activity: data.recent_activity || [],
        };
      }

      // Fallback query directly with RLS
      const [orgsRes, requestsRes, membersRes, adminsRes, logsRes] = await Promise.all([
        supabase.from('organizations').select('id, is_active'),
        supabase.from('org_join_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('org_memberships').select('id, user_id'),
        supabase.from('platform_admins').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
      ]);

      const orgs = orgsRes.data || [];
      const activeOrgs = orgs.filter((o) => o.is_active).length;
      const uniqueUsers = new Set((membersRes.data || []).map((m) => m.user_id));

      return {
        total_users: uniqueUsers.size || 1,
        active_organizations: activeOrgs,
        pending_requests: requestsRes.count || 0,
        total_memberships: (membersRes.data || []).length,
        platform_admins_count: adminsRes.count || 1,
        recent_activity: (logsRes.data as AdminAuditLog[]) || [],
      };
    } catch (err) {
      console.error('Failed to get dashboard metrics:', err);
      return {
        total_users: 1,
        active_organizations: 1,
        pending_requests: 0,
        total_memberships: 1,
        platform_admins_count: 1,
        recent_activity: [],
      };
    }
  },

  /**
   * Get all organizations
   */
  async getAllOrganizations(): Promise<Organization[]> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new organization
   */
  async createOrganization(input: {
    legal_name: string;
    trade_name?: string;
    currency?: string;
    is_active?: boolean;
  }): Promise<string> {
    // Try RPC first for safe transactional creation & audit log
    const { data, error } = await supabase.rpc('create_organization_admin', {
      p_legal_name: input.legal_name,
      p_trade_name: input.trade_name || input.legal_name,
      p_currency: input.currency || 'INR',
      p_is_active: input.is_active ?? true,
    });

    if (!error && data?.org_id) {
      return data.org_id;
    }

    // Direct insert fallback
    const { data: inserted, error: insertErr } = await supabase
      .from('organizations')
      .insert({
        legal_name: input.legal_name,
        trade_name: input.trade_name || input.legal_name,
        currency: input.currency || 'INR',
        is_active: input.is_active ?? true,
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;
    return inserted.id;
  },

  /**
   * Update organization details
   */
  async updateOrganization(
    id: string,
    updates: Partial<Organization>
  ): Promise<void> {
    const { error } = await supabase
      .from('organizations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Toggle organization active/inactive status
   */
  async toggleOrganizationStatus(id: string, isActive: boolean): Promise<void> {
    await this.updateOrganization(id, { is_active: isActive });
  },

  /**
   * Get all organization memberships
   */
  async getAllMemberships(): Promise<
    (OrgMembership & {
      organization?: { legal_name: string };
      user_email?: string;
    })[]
  > {
    const { data, error } = await supabase
      .from('org_memberships')
      .select(`
        *,
        organization:organizations(legal_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Update membership role
   */
  async updateMembershipRole(
    membershipId: string,
    newRole: string
  ): Promise<void> {
    const { error } = await supabase
      .from('org_memberships')
      .update({ role: newRole })
      .eq('id', membershipId);

    if (error) throw error;
  },

  /**
   * Revoke/remove membership
   */
  async removeMembership(membershipId: string): Promise<void> {
    const { error } = await supabase
      .from('org_memberships')
      .delete()
      .eq('id', membershipId);

    if (error) throw error;
  },

  /**
   * Get all join requests
   */
  async getAllJoinRequests(): Promise<OrgJoinRequest[]> {
    const { data, error } = await supabase
      .from('org_join_requests')
      .select(`
        *,
        organization:organizations(legal_name, trade_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Approve a join request
   */
  async approveJoinRequest(requestId: string, role = 'team_member'): Promise<void> {
    const { data, error } = await supabase.rpc('approve_join_request', {
      p_request_id: requestId,
      p_role: role,
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error || 'Failed to approve request');
  },

  /**
   * Reject a join request
   */
  async rejectJoinRequest(requestId: string, reason?: string): Promise<void> {
    const { data, error } = await supabase.rpc('reject_join_request', {
      p_request_id: requestId,
      p_reason: reason || null,
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error || 'Failed to reject request');
  },

  /**
   * Get all platform admins
   */
  async getPlatformAdmins(): Promise<PlatformAdmin[]> {
    const { data, error } = await supabase
      .from('platform_admins')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Grant platform admin role
   */
  async grantPlatformAdmin(
    email: string,
    _role: 'super_admin' | 'platform_admin' | 'auditor' = 'super_admin'
  ): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.rpc('claim_or_register_super_admin', {
      p_email: cleanEmail,
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.error || 'Failed to grant admin role');
  },

  /**
   * Revoke platform admin role
   */
  async revokePlatformAdmin(adminId: string): Promise<void> {
    const { error } = await supabase
      .from('platform_admins')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', adminId);

    if (error) throw error;
  },

  /**
   * Get organization employee directory
   */
  async getOrgDirectory(orgId: string): Promise<ErpEmployee[]> {
    const { data, error } = await supabase
      .from('erp_employees')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Add an employee to organization directory (Authorized Admin only)
   */
  async addOrgEmployee(employee: {
    org_id: string;
    first_name: string;
    last_name?: string;
    email?: string;
    designation: string;
    employee_code?: string;
    phone?: string;
    user_id?: string;
  }): Promise<ErpEmployee> {
    const code =
      employee.employee_code?.trim() ||
      `EMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const { data, error } = await supabase
      .from('erp_employees')
      .insert({
        org_id: employee.org_id,
        first_name: employee.first_name.trim(),
        last_name: employee.last_name?.trim() || null,
        email: employee.email?.trim() || null,
        designation: employee.designation.trim(),
        employee_code: code,
        phone: employee.phone?.trim() || null,
        user_id: employee.user_id || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an employee in directory
   */
  async updateOrgEmployee(
    id: string,
    updates: Partial<ErpEmployee>
  ): Promise<void> {
    const { error } = await supabase
      .from('erp_employees')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Fetch admin audit history logs
   */
  async getAuditLogs(limit = 50): Promise<AdminAuditLog[]> {
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};
