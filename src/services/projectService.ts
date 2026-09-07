import { Project } from '../types/project';
import { OfflineSyncService } from './offlineSyncService';
import { supabase } from '../lib/supabase';

export const getProjects = async (workspaceId: string): Promise<Project[]> => {
  return await OfflineSyncService.getItems<Project>(
    'projects',
    (p) => p.workspace_id === workspaceId
  );
};

export const createProject = async (input: Partial<Project> & { name: string; workspace_id: string }): Promise<Project> => {
  const { data: userData } = await supabase.auth.getUser();
  const project: Project = {
    id: 'proj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    workspace_id: input.workspace_id,
    name: input.name,
    description: input.description || null,
    status: input.status || 'active',
    color: input.color || '#3b82f6',
    icon: input.icon || '📁',
    start_date: input.start_date || null,
    target_date: input.target_date || null,
    budget: input.budget || null,
    currency: input.currency || 'INR',
    user_id: userData?.user?.id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return await OfflineSyncService.saveItem('projects', project);
};

export const updateProject = async (id: string, patch: Partial<Project>): Promise<Project | null> => {
  return await OfflineSyncService.updateItem<Project>('projects', id, patch);
};

export const deleteProject = async (id: string): Promise<boolean> => {
  return await OfflineSyncService.deleteItem<Project>('projects', id);
};
