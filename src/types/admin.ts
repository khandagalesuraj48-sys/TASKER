export interface PlatformAdmin {
  id: string;
  user_id: string;
  email: string | null;
  role: 'super_admin' | 'platform_admin' | 'auditor';
  is_active: boolean;
  granted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgJoinRequest {
  id: string;
  org_id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  requested_role: 'org_admin' | 'project_manager' | 'team_member' | 'viewer';
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined organization info
  organization?: {
    legal_name: string;
    trade_name: string | null;
  };
}

export interface AdminAuditLog {
  id: string;
  admin_id: string | null;
  admin_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

export interface AdminDashboardMetrics {
  total_users: number;
  active_organizations: number;
  pending_requests: number;
  total_memberships: number;
  platform_admins_count: number;
  recent_activity: AdminAuditLog[];
}

