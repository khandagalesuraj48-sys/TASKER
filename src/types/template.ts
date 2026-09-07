export interface ChecklistTemplateItem {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_minutes?: number;
  offset_days?: number;
}

export interface ChecklistTemplate {
  id: string;
  workspace_id?: string | null;
  title: string;
  category: 'diwali' | 'travel' | 'onboarding' | 'gst' | 'shifting' | 'event' | 'custom';
  description: string;
  icon?: string;
  items: ChecklistTemplateItem[];
  is_preset: boolean;
  user_id?: string | null;
  created_at: string;
}
