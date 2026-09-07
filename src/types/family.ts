export type FamilyEntityType = 'chore' | 'grocery' | 'homework' | 'event' | 'medicine' | 'maintenance';
export type FamilyEntityStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface FamilyEntity {
  id: string;
  workspace_id: string;
  title: string;
  entity_type: FamilyEntityType;
  assigned_to?: string | null;
  due_date?: string | null;
  status: FamilyEntityStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  quantity?: string | null;
  category?: string | null;
  notes?: string | null;
  is_recurring?: boolean;
  recurrence_rule?: Record<string, any> | null;
  task_id?: string | null;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}
