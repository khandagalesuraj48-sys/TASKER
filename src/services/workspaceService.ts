import { Workspace, WorkspaceMember, WorkspaceType } from '../types/workspace';
import { OfflineSyncService } from './offlineSyncService';
import { supabase } from '../lib/supabase';

const ACTIVE_WORKSPACE_KEY = 'tasker_active_workspace_id';

const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: 'ws-personal-default',
    name: 'Personal',
    slug: 'personal',
    type: 'personal',
    owner_id: 'default-user',
    icon: '👤',
    color: '#3b82f6',
    is_default: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ws-family-default',
    name: 'Family & Home',
    slug: 'family',
    type: 'family',
    owner_id: 'default-user',
    icon: '🏠',
    color: '#10b981',
    is_default: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ws-business-default',
    name: 'Business & Freelance',
    slug: 'business',
    type: 'business',
    owner_id: 'default-user',
    icon: '💼',
    color: '#8b5cf6',
    is_default: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const getWorkspaces = async (): Promise<Workspace[]> => {
  const items = await OfflineSyncService.getItems<Workspace>('workspaces');
  if (items.length === 0) {
    for (const ws of DEFAULT_WORKSPACES) {
      await OfflineSyncService.saveItem('workspaces', ws);
    }
    return DEFAULT_WORKSPACES;
  }
  return items;
};

export const getActiveWorkspaceId = (): string => {
  return localStorage.getItem(ACTIVE_WORKSPACE_KEY) || 'ws-personal-default';
};

export const setActiveWorkspaceId = (id: string): void => {
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
  window.dispatchEvent(new CustomEvent('workspace-changed', { detail: { workspaceId: id } }));
};

export const createWorkspace = async (input: {
  name: string;
  type: WorkspaceType;
  icon?: string;
  color?: string;
}): Promise<Workspace> => {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || 'default-user';

  const newWorkspace: Workspace = {
    id: 'ws_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    name: input.name,
    slug: input.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    type: input.type,
    owner_id: userId,
    icon: input.icon || (input.type === 'personal' ? '👤' : input.type === 'family' ? '🏠' : '💼'),
    color: input.color || '#3b82f6',
    is_default: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return await OfflineSyncService.saveItem('workspaces', newWorkspace);
};

export const updateWorkspace = async (
  id: string,
  patch: Partial<Workspace>
): Promise<Workspace | null> => {
  return await OfflineSyncService.updateItem<Workspace>('workspaces', id, patch);
};

export const getWorkspaceMembers = async (workspaceId: string): Promise<WorkspaceMember[]> => {
  return await OfflineSyncService.getItems<WorkspaceMember>(
    'workspace_members',
    (m) => m.workspace_id === workspaceId
  );
};
