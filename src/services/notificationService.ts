import { registerPlugin, Capacitor } from '@capacitor/core';
import { LocalNotifications, PermissionStatus } from '@capacitor/local-notifications';
import { Task, TaskReminder } from '../types/task';

export interface NotificationHelperPluginInterface {
  openNotificationSettings(): Promise<void>;
  checkSystemStatus(): Promise<{
    areNotificationsEnabled: boolean;
    canScheduleExactAlarms: boolean;
    isIgnoringBatteryOptimizations: boolean;
  }>;
  openExactAlarmSettings(): Promise<void>;
  requestBatteryOptimization(): Promise<{ promptShown?: boolean; alreadyIgnoring?: boolean }>;
  openAutostartSettings(): Promise<void>;
  startBackgroundSync(options: {
    userId: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  }): Promise<{ success: boolean }>;
  stopBackgroundSync(): Promise<{ success: boolean }>;
}

export const NotificationHelper = registerPlugin<NotificationHelperPluginInterface>('NotificationHelper');

export interface TaskerNotificationSettings {
  masterEnabled: boolean;
  taskRemindersEnabled: boolean;
  pendingRemindersEnabled: boolean;
  pendingReminderIntervalHours: number; // 1, 2, 4, 8, 24
}

const SETTINGS_STORAGE_KEY = 'tasker_notification_settings';
export const PENDING_NOTIFICATION_ID = 999999;

export const DEFAULT_NOTIFICATION_SETTINGS: TaskerNotificationSettings = {
  masterEnabled: true,
  taskRemindersEnabled: true,
  pendingRemindersEnabled: true,
  pendingReminderIntervalHours: 1,
};

export const getNotificationSettings = (): TaskerNotificationSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

export const saveNotificationSettings = (settings: TaskerNotificationSettings): void => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage issues
  }
};

export interface SystemPermissionStatus {
  granted: boolean;
  areNotificationsEnabled: boolean;
  canScheduleExactAlarms: boolean;
  isIgnoringBatteryOptimizations: boolean;
  displayState: 'granted' | 'denied' | 'prompt' | 'blocked';
}

/**
 * Converts a Task ID (UUID) into a deterministic 32-bit positive integer
 * to comply with native Android Notification IDs (between 1 and 899999).
 */
export const taskIdToNotificationId = (taskId: string): number => {
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    const char = taskId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const positive = Math.abs(hash) % 899999;
  return positive === 0 ? 1 : positive;
};

/**
 * Checks system notification permissions and exact alarm status
 */
export const checkNotificationPermissions = async (): Promise<SystemPermissionStatus> => {
  if (!Capacitor.isNativePlatform()) {
    const isGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
    return {
      granted: isGranted,
      areNotificationsEnabled: isGranted,
      canScheduleExactAlarms: true,
      isIgnoringBatteryOptimizations: true,
      displayState: isGranted ? 'granted' : (typeof Notification !== 'undefined' ? (Notification.permission as any) : 'prompt'),
    };
  }

  try {
    let localPerm: PermissionStatus = { display: 'prompt' };
    try {
      localPerm = await LocalNotifications.checkPermissions();
    } catch (e) {
      console.warn('LocalNotifications.checkPermissions failed:', e);
    }

    let systemStatus = { areNotificationsEnabled: true, canScheduleExactAlarms: true, isIgnoringBatteryOptimizations: true };
    try {
      systemStatus = await NotificationHelper.checkSystemStatus();
    } catch (e) {
      console.warn('NotificationHelper.checkSystemStatus failed:', e);
    }

    const granted = localPerm.display === 'granted' && systemStatus.areNotificationsEnabled;
    let displayState: 'granted' | 'denied' | 'prompt' | 'blocked' = 'prompt';

    if (!systemStatus.areNotificationsEnabled) {
      displayState = 'blocked';
    } else if (localPerm.display === 'granted') {
      displayState = 'granted';
    } else if (localPerm.display === 'denied') {
      displayState = 'denied';
    }

    return {
      granted,
      areNotificationsEnabled: systemStatus.areNotificationsEnabled,
      canScheduleExactAlarms: systemStatus.canScheduleExactAlarms,
      isIgnoringBatteryOptimizations: Boolean(systemStatus.isIgnoringBatteryOptimizations),
      displayState,
    };
  } catch (err) {
    console.error('Failed to check notification status:', err);
    return {
      granted: false,
      areNotificationsEnabled: false,
      canScheduleExactAlarms: true,
      isIgnoringBatteryOptimizations: true,
      displayState: 'prompt',
    };
  }
};

/**
 * Request system battery optimization exemption (Unrestricted Battery).
 */
export const requestBatteryOptimizationExemption = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await NotificationHelper.requestBatteryOptimization();
    return Boolean(res?.alreadyIgnoring);
  } catch (e) {
    console.warn('Failed to request battery optimization:', e);
    return false;
  }
};

/**
 * Open OEM-specific Autostart settings (Xiaomi, Vivo, Oppo, OnePlus, Samsung).
 */
export const openAutostartSettings = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await NotificationHelper.openAutostartSettings();
  } catch (e) {
    console.warn('Failed to open autostart settings:', e);
  }
};

/**
 * Starts the 24/7 native Android background sync service for the active user.
 */
export const startNativeBackgroundSync = async (userId: string): Promise<void> => {
  if (!Capacitor.isNativePlatform() || !userId) return;
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    await NotificationHelper.startBackgroundSync({
      userId,
      supabaseUrl,
      supabaseAnonKey,
    });
    console.log('Native background sync service started for user:', userId);
  } catch (e) {
    console.warn('Could not start native background sync:', e);
  }
};

/**
 * Stops native background sync when user logs out.
 */
export const stopNativeBackgroundSync = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await NotificationHelper.stopBackgroundSync();
  } catch (e) {
    console.warn('Could not stop native background sync:', e);
  }
};

/**
 * Ensures all Android notification channels exist with appropriate importance,
 * vibration, and sounds so notifications pop up in the status bar reliably.
 */
export const initNotificationChannels = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: 'tasker_alerts',
      name: 'Task Alerts & Updates',
      description: 'Immediate heads-up alerts for task assignments, reassignments, and completions',
      importance: 5, // IMPORTANCE_HIGH
      visibility: 1, // VISIBILITY_PUBLIC
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#2563eb',
    });

    await LocalNotifications.createChannel({
      id: 'tasker_reminders',
      name: 'Task Reminders',
      description: 'Scheduled task reminders and due date alerts',
      importance: 5, // IMPORTANCE_HIGH
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#e11d48',
    });

    await LocalNotifications.createChannel({
      id: 'tasker_reassign',
      name: 'Task Assignments',
      description: 'Alerts when a task is assigned or reassigned to you',
      importance: 5, // IMPORTANCE_HIGH
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#2563eb',
    });

    await LocalNotifications.createChannel({
      id: 'tasker_pending',
      name: 'Pending Tasks',
      description: 'Periodic reminders and summaries of pending tasks',
      importance: 3, // IMPORTANCE_DEFAULT
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
  } catch (e) {
    console.warn('Error creating notification channels:', e);
  }
};

/**
 * Requests notification permissions from user
 */
export const requestNotificationPermissions = async (): Promise<SystemPermissionStatus> => {
  if (!Capacitor.isNativePlatform()) {
    if (typeof Notification !== 'undefined') {
      await Notification.requestPermission();
    }
    return checkNotificationPermissions();
  }

  try {
    await initNotificationChannels();
    await LocalNotifications.requestPermissions();
  } catch (e) {
    console.warn('Error requesting LocalNotification permissions:', e);
  }

  return checkNotificationPermissions();
};

/**
 * Open native system notification settings for this app
 */
export const openSystemNotificationSettings = async (): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    try {
      await NotificationHelper.openNotificationSettings();
    } catch (e) {
      console.error('Error opening notification settings:', e);
    }
  }
};

/**
 * Open native system exact alarm settings (Android 12+)
 */
export const openSystemExactAlarmSettings = async (): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    try {
      await NotificationHelper.openExactAlarmSettings();
    } catch (e) {
      console.error('Error opening exact alarm settings:', e);
    }
  }
};

/**
 * Schedules a native Android task reminder using AlarmManager via @capacitor/local-notifications.
 * Works when app is backgrounded, fully closed, or screen locked.
 */
export const scheduleNativeTaskReminder = async (
  task: Task,
  reminder: TaskReminder
): Promise<void> => {
  const settings = getNotificationSettings();
  const notifId = taskIdToNotificationId(task.id);

  // If disabled globally, or disabled on reminder, cancel any existing schedule
  if (!settings.masterEnabled || !settings.taskRemindersEnabled || !reminder.is_enabled) {
    await cancelNativeTaskReminder(task.id);
    return;
  }

  const triggerIso = reminder.next_trigger_at || reminder.remind_at;
  if (!triggerIso) return;

  let triggerDate = new Date(triggerIso);
  const now = new Date();

  // If time is in past
  if (triggerDate.getTime() <= now.getTime()) {
    // If it's a one-time reminder in the past (> 10s past), cancel
    if (reminder.recurrence_type === 'once') {
      if (triggerDate.getTime() <= now.getTime() - 10000) {
        await cancelNativeTaskReminder(task.id);
        return;
      }
      // If within 10s or just about to fire, set to 2s from now so it triggers reliably
      triggerDate = new Date(Date.now() + 2000);
    }
  }

  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Cancel prior schedule for this task first to prevent duplicates
    try {
      await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
    } catch {
      // Ignore
    }

    const title = `Task Reminder: ${task.title}`;
    const body = task.description?.trim()
      ? (task.description.length > 90 ? `${task.description.slice(0, 90)}...` : task.description)
      : `Reminder for "${task.title}"`;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title,
          body,
          schedule: {
            at: triggerDate,
            allowWhileIdle: true,
          },
          channelId: 'tasker_reminders',
          autoCancel: true,
          extra: {
            taskId: task.id,
            type: 'task_reminder',
          },
        },
      ],
    });
  } catch (err) {
    console.error(`Failed to schedule native reminder for task ${task.id}:`, err);
  }
};

/**
 * Cancels scheduled native notification for a task
 */
export const cancelNativeTaskReminder = async (taskId: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const notifId = taskIdToNotificationId(taskId);
    await LocalNotifications.cancel({
      notifications: [{ id: notifId }],
    });
  } catch (err) {
    console.warn(`Could not cancel native notification for task ${taskId}:`, err);
  }
};

/**
 * Schedules periodic pending task summary reminder.
 * If pendingCount === 0 or reminders disabled, cancels existing pending reminder.
 */
export const schedulePendingTasksNotification = async (
  pendingCount: number,
  customIntervalHours?: number,
  options?: { isWorkplaceAssigned?: boolean }
): Promise<void> => {
  const settings = getNotificationSettings();
  const intervalHours = customIntervalHours || settings.pendingReminderIntervalHours || 1;

  if (!Capacitor.isNativePlatform()) return;

  try {
    // Always cancel existing pending reminder first
    await LocalNotifications.cancel({
      notifications: [{ id: PENDING_NOTIFICATION_ID }],
    });

    if (!settings.masterEnabled || !settings.pendingRemindersEnabled || pendingCount <= 0) {
      return;
    }

    const triggerDate = new Date(Date.now() + intervalHours * 60 * 60 * 1000);
    const title = options?.isWorkplaceAssigned
      ? '⏰ Action Required: Pending Assigned Tasks'
      : '⏰ Please Complete Pending Tasks';
    const body = options?.isWorkplaceAssigned
      ? `You have ${pendingCount} workplace task${pendingCount > 1 ? 's' : ''} assigned to you that are pending completion. Please complete them.`
      : `You have ${pendingCount} pending task${pendingCount > 1 ? 's' : ''} in TASKER waiting to be completed. Please complete your tasks.`;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: PENDING_NOTIFICATION_ID,
          title,
          body,
          schedule: {
            at: triggerDate,
            every: 'hour', // Hourly repeat reminder!
            allowWhileIdle: true,
          },
          channelId: 'tasker_pending',
          autoCancel: true,
          extra: {
            type: 'pending_tasks',
            path: options?.isWorkplaceAssigned ? '/org/assigned-to-me' : '/pending',
          },
        },
      ],
    });
  } catch (err) {
    console.warn('Could not schedule pending tasks notification:', err);
  }
};


export const notifyTaskReassigned = async (task: Task, _assigneeId: string): Promise<void> => {
  // Immediate native notification for task reassignment
  if (!Capacitor.isNativePlatform()) return;
  try {
    const title = `Task Reassigned: ${task.title}`;
    const body = `${task.title} has been reassigned to you.`;
    const notifId = taskIdToNotificationId(task.id);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title,
          body,
          schedule: { at: new Date(Date.now() + 1000) }, // fire shortly
          channelId: 'tasker_reassign',
          autoCancel: true,
          extra: { taskId: task.id, type: 'task_reassigned' },
        },
      ],
    });
  } catch (err) {
    console.warn('Failed to send reassignment notification:', err);
  }
};

