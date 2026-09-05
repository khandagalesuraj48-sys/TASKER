export type TaskStatus = 'pending' | 'in_progress' | 'partial' | 'completed' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  person_name: string | null; // Pending with
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  updated_at: string;
  pending_since: string;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  // Computed / joined fields
  attachments_count?: number;
  notes_count?: number;
  reminder?: TaskReminder | null;
}

export interface TaskStatusHistory {
  id: string;
  task_id: string;
  old_status: TaskStatus | null;
  new_status: TaskStatus;
  changed_by: string;
  changed_at: string;
  remarks: string | null;
}

export interface TaskNote {
  id: string;
  task_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  storage_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  uploaded_at: string;
}

export type SortField = 'newest' | 'oldest' | 'due_date' | 'priority' | 'recently_updated' | 'pending_duration';

export type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

export interface TaskFilterOptions {
  status?: TaskStatus | 'all';
  priority?: TaskPriority | 'all';
  person?: string;
  dateFilter?: DateFilter;
  startDate?: string;
  endDate?: string;
  hasAttachments?: boolean;
  search?: string;
  sortBy?: SortField;
  includeDeleted?: boolean;
}

export interface TaskStats {
  pending: number;
  inProgress: number;
  partial: number;
  completed: number;
  overdue: number;
  totalActive: number;
  binCount: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  person_name?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string | null;
  created_by?: string;
  initialNote?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  person_name?: string;
  priority?: TaskPriority;
  due_date?: string | null;
}

export interface BackupMetadata {
  version: string;
  exportDate: string;
  appName: string;
  author: string;
  counts: {
    tasks: number;
    statusHistory: number;
    notes: number;
    attachments: number;
  };
}

export interface BackupData {
  metadata: BackupMetadata;
  tasks: Task[];
  statusHistory: TaskStatusHistory[];
  notes: TaskNote[];
  attachments: TaskAttachment[];
}

export type ReminderRecurrence = 'once' | 'hourly' | 'every_2_hours' | 'daily' | 'custom';
export type ReminderStatus = 'active' | 'completed' | 'dismissed' | 'snoozed' | 'stopped';

export interface TaskReminder {
  id: string;
  task_id: string;
  is_enabled: boolean;
  remind_at: string;
  recurrence_type: ReminderRecurrence;
  custom_interval_minutes: number | null;
  next_trigger_at: string;
  last_triggered_at: string | null;
  status: ReminderStatus;
  snooze_until: string | null;
  notification_channel: 'system' | 'browser' | 'push' | 'all';
  created_at: string;
  updated_at: string;
}

export interface ReminderInput {
  is_enabled: boolean;
  remind_at: string;
  recurrence_type: ReminderRecurrence;
  custom_interval_minutes?: number | null;
}

export type MatchFieldCategory =
  | 'title_exact'
  | 'title'
  | 'description'
  | 'note'
  | 'status_priority'
  | 'person'
  | 'status_history'
  | 'attachment';

export interface UniversalSearchResult {
  task: Task;
  matchedField: MatchFieldCategory;
  snippet: string;
  rankScore: number;
}

export interface TaskReference {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  referencedTasks?: TaskReference[];
  isSearchingDb?: boolean;
}

