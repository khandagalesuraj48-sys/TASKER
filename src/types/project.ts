export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  color?: string | null;
  icon?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  budget?: number | null;
  currency?: string;
  created_by?: string;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
  tasks_count?: number;
  completed_tasks_count?: number;
}
