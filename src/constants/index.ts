import { TaskPriority, TaskStatus } from '../types/task';

export const APP_NAME = 'My Work Tracker';
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
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    dotColor: 'bg-amber-500',
    description: 'Task is not completed.',
  },
  in_progress: {
    key: 'in_progress',
    label: 'In Progress',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    dotColor: 'bg-blue-500',
    description: 'Work has started but is not completed.',
  },
  partial: {
    key: 'partial',
    label: 'Partial',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-700',
    badgeBorder: 'border-orange-200',
    dotColor: 'bg-orange-500',
    description: 'Part of the task has been completed.',
  },
  completed: {
    key: 'completed',
    label: 'Completed',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
    description: 'Task is fully completed.',
  },
  cancelled: {
    key: 'cancelled',
    label: 'Cancelled',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-200',
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
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-200',
  },
  medium: {
    key: 'medium',
    label: 'Medium',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-600',
    badgeBorder: 'border-blue-200',
  },
  high: {
    key: 'high',
    label: 'High',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
  },
  urgent: {
    key: 'urgent',
    label: 'Urgent',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
  },
};

export const ALLOWED_EXTENSIONS = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'xls',
  'xlsx',
  'doc',
  'docx',
  'csv',
  'zip',
  'txt',
];

