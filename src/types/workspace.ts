export type WorkspaceType = 'personal' | 'family' | 'business';
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  owner_id: string;
  icon?: string | null;
  color?: string | null;
  is_default: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_email?: string | null;
  status: 'active' | 'invited' | 'declined';
  created_at: string;
  updated_at: string;
}
