import { TaskPriority, TaskStatus } from '../types/task';

export const APP_NAME = 'TASKER';
export const DEFAULT_USER_NAME = import.meta.env.VITE_DEFAULT_USER_NAME || 'Pawan';
export const STORAGE_BUCKET = 'task-attachments';
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export interface StatusConfig {
  key: TaskStatus;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  description: string;
}

export const STATUS_CONFIG: Record<TaskStatus, StatusConfig> = {
  pending: {
    key: 'pending',
    label: 'Pending',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-900/50',
    dotColor: 'bg-amber-500',
    description: 'Task is not completed.',
  },
  in_progress: {
    key: 'in_progress',
    label: 'In Progress',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-200 dark:border-blue-900/50',
    dotColor: 'bg-blue-500',
    description: 'Work has started but is not completed.',
  },
  partial: {
    key: 'partial',
    label: 'Partial',
    badgeBg: 'bg-orange-50 dark:bg-orange-950/40',
    badgeText: 'text-orange-700 dark:text-orange-300',
    badgeBorder: 'border-orange-200 dark:border-orange-900/50',
    dotColor: 'bg-orange-500',
    description: 'Part of the task has been completed.',
  },
  completed: {
    key: 'completed',
    label: 'Completed',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-900/50',
    dotColor: 'bg-emerald-500',
    description: 'Task is fully completed.',
  },
  cancelled: {
    key: 'cancelled',
    label: 'Cancelled',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-600 dark:text-slate-400',
    badgeBorder: 'border-slate-200 dark:border-slate-700',
    dotColor: 'bg-slate-400',
    description: 'Task was cancelled.',
  },
};

export interface PriorityConfig {
  key: TaskPriority;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const PRIORITY_CONFIG: Record<TaskPriority, PriorityConfig> = {
  low: {
    key: 'low',
    label: 'Low',
    badgeBg: 'bg-slate-50 dark:bg-slate-800/60',
    badgeText: 'text-slate-600 dark:text-slate-300',
    badgeBorder: 'border-slate-200 dark:border-slate-700',
  },
  medium: {
    key: 'medium',
    label: 'Medium',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
    badgeText: 'text-blue-600 dark:text-blue-400',
    badgeBorder: 'border-blue-200 dark:border-blue-900/50',
  },
  high: {
    key: 'high',
    label: 'High',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-900/50',
  },
  urgent: {
    key: 'urgent',
    label: 'Urgent',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-200 dark:border-rose-900/50',
  },
};

export const ALLOWED_EXTENSIONS = [
  // Documents & Spreadsheets
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'txt',
  'rtf',
  'odt',
  'ods',
  'odp',
  'ppt',
  'pptx',
  // Images
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'svg',
  'bmp',
  'ico',
  // Audio
  'mp3',
  'wav',
  'm4a',
  'ogg',
  'flac',
  'aac',
  // Video
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  // Archives
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
];

export const BLOCKED_EXTENSIONS = ['html', 'htm', 'xhtml'];
export const BLOCKED_MIME_TYPES = ['text/html', 'application/xhtml+xml'];


