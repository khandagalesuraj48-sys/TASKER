export interface SavedView {
  id: string;
  workspace_id: string;
  name: string;
  icon?: string;
  filters: Record<string, any>;
  sort_by: string;
  sort_order: 'asc' | 'desc';
  view_mode: 'list' | 'board' | 'calendar';
  is_default: boolean;
  user_id?: string | null;
  created_at: string;
}

export interface UserPreferences {
  user_id: string;
  selected_workspace_id?: string;
  language: string;
  streak_count: number;
  last_active_date?: string;
  theme: 'light' | 'dark' | 'system';
  high_contrast: boolean;
  large_text: boolean;
  screen_reader_friendly: boolean;
  haptic_feedback: boolean;
}
