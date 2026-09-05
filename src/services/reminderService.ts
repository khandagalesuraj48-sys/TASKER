import { supabase } from '../lib/supabase';
import { ReminderInput, ReminderRecurrence, Task, TaskReminder } from '../types/task';
import { scheduleNativeTaskReminder, cancelNativeTaskReminder } from './notificationService';

const LOCAL_STORAGE_KEY = 'tasker_reminders_store';

// Helper to compute next trigger date given recurrence
export const computeNextTrigger = (
  baseTime: string | Date,
  recurrence: ReminderRecurrence,
  customMinutes?: number | null
): string => {
  const d = new Date(baseTime);
  const now = new Date();

  // If initial time is already in future, return it
  if (d.getTime() > now.getTime()) {
    return d.toISOString();
  }

  // If in the past, advance according to recurrence until in future
  switch (recurrence) {
    case 'hourly':
      while (d.getTime() <= now.getTime()) {
        d.setHours(d.getHours() + 1);
      }
      return d.toISOString();
    case 'every_2_hours':
      while (d.getTime() <= now.getTime()) {
        d.setHours(d.getHours() + 2);
      }
      return d.toISOString();
    case 'daily':
      while (d.getTime() <= now.getTime()) {
        d.setDate(d.getDate() + 1);
      }
      return d.toISOString();
    case 'custom': {
      const step = (customMinutes && customMinutes > 0) ? customMinutes : 60;
      while (d.getTime() <= now.getTime()) {
        d.setMinutes(d.getMinutes() + step);
      }
      return d.toISOString();
    }
    case 'once':
    default:
      return new Date(baseTime).toISOString();
  }
};

// Local storage fallback helpers
const getLocalReminders = (): Record<string, TaskReminder> => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const setLocalReminder = (reminder: TaskReminder) => {
  try {
    const all = getLocalReminders();
    all[reminder.task_id] = reminder;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage quota
  }
};

const removeLocalReminder = (taskId: string) => {
  try {
    const all = getLocalReminders();
    delete all[taskId];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore
  }
};

// 1. Get reminder for a specific task
export const getTaskReminder = async (taskId: string): Promise<TaskReminder | null> => {
  try {
    const { data, error } = await supabase
      .from('task_reminders')
      .select('*')
      .eq('task_id', taskId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        // Fallback to local store
        return getLocalReminders()[taskId] || null;
      }
      console.warn('Error fetching task reminder:', error);
      return getLocalReminders()[taskId] || null;
    }

    return (data as TaskReminder) || null;
  } catch {
    return getLocalReminders()[taskId] || null;
  }
};

// Helper to sync local/native notification schedule
const syncNativeReminder = async (taskId: string, reminder: TaskReminder | null): Promise<void> => {
  try {
    if (!reminder || !reminder.is_enabled || reminder.status === 'stopped') {
      await cancelNativeTaskReminder(taskId);
      return;
    }
    const { data: taskData } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
    if (taskData) {
      await scheduleNativeTaskReminder(taskData as Task, reminder);
    }
  } catch (e) {
    console.warn('Sync native reminder error:', e);
  }
};

// 2. Save or update reminder
export const saveTaskReminder = async (
  taskId: string,
  input: ReminderInput
): Promise<TaskReminder> => {
  const nextTrigger = computeNextTrigger(input.remind_at, input.recurrence_type, input.custom_interval_minutes);
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData?.user?.id || null;

  const payload: any = {
    task_id: taskId,
    is_enabled: input.is_enabled,
    remind_at: new Date(input.remind_at).toISOString(),
    recurrence_type: input.recurrence_type,
    custom_interval_minutes: input.custom_interval_minutes || null,
    next_trigger_at: nextTrigger,
    status: input.is_enabled ? 'active' : 'stopped',
    notification_channel: 'system',
    user_id: currentUserId,
    updated_at: new Date().toISOString(),
  };

  let savedRecord: TaskReminder;

  try {
    // Check if exists
    const existing = await getTaskReminder(taskId);

    if (existing && existing.id) {
      const { data, error } = await supabase
        .from('task_reminders')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      savedRecord = data as TaskReminder;
    } else {
      const { data, error } = await supabase
        .from('task_reminders')
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      savedRecord = data as TaskReminder;
    }
    setLocalReminder(savedRecord);
  } catch (err: any) {
    // If Supabase table is not yet migrated, save gracefully in local fallback
    savedRecord = {
      id: 'local_' + Date.now(),
      task_id: taskId,
      is_enabled: input.is_enabled,
      remind_at: new Date(input.remind_at).toISOString(),
      recurrence_type: input.recurrence_type,
      custom_interval_minutes: input.custom_interval_minutes || null,
      next_trigger_at: nextTrigger,
      last_triggered_at: null,
      status: input.is_enabled ? 'active' : 'stopped',
      snooze_until: null,
      notification_channel: 'system',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setLocalReminder(savedRecord);
  }

  // Synchronize native Android notification
  await syncNativeReminder(taskId, savedRecord);
  return savedRecord;
};

// 3. Stop reminder on completion or manual request
export const stopTaskReminder = async (taskId: string): Promise<void> => {
  // Cancel native notification first
  try {
    await cancelNativeTaskReminder(taskId);
  } catch {
    // Ignore
  }

  try {
    await supabase
      .from('task_reminders')
      .update({
        is_enabled: false,
        status: 'stopped',
        updated_at: new Date().toISOString(),
      })
      .eq('task_id', taskId);
  } catch {
    // Ignore
  }

  // Also update local fallback
  const all = getLocalReminders();
  if (all[taskId]) {
    all[taskId].is_enabled = false;
    all[taskId].status = 'stopped';
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
  }
};

// 4. Snooze reminder by X minutes
export const snoozeTaskReminder = async (taskId: string, minutes: number = 15): Promise<void> => {
  const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  try {
    await supabase
      .from('task_reminders')
      .update({
        status: 'snoozed',
        snooze_until: snoozeUntil,
        next_trigger_at: snoozeUntil,
        updated_at: new Date().toISOString(),
      })
      .eq('task_id', taskId);
  } catch {
    // Ignore
  }

  const all = getLocalReminders();
  let updatedRecord: TaskReminder | null = null;
  if (all[taskId]) {
    all[taskId].status = 'snoozed';
    all[taskId].snooze_until = snoozeUntil;
    all[taskId].next_trigger_at = snoozeUntil;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
    updatedRecord = all[taskId];
  }

  await syncNativeReminder(taskId, updatedRecord || ({
    task_id: taskId,
    is_enabled: true,
    status: 'snoozed',
    next_trigger_at: snoozeUntil,
  } as TaskReminder));
};

// 5. Dismiss reminder for current cycle and advance to next recurrence
export const dismissTaskReminder = async (reminder: TaskReminder): Promise<void> => {
  if (reminder.recurrence_type === 'once') {
    await stopTaskReminder(reminder.task_id);
    return;
  }

  const nextTrigger = computeNextTrigger(
    new Date(),
    reminder.recurrence_type,
    reminder.custom_interval_minutes
  );

  try {
    await supabase
      .from('task_reminders')
      .update({
        status: 'active',
        snooze_until: null,
        last_triggered_at: new Date().toISOString(),
        next_trigger_at: nextTrigger,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reminder.id);
  } catch {
    // Ignore
  }

  const all = getLocalReminders();
  if (all[reminder.task_id]) {
    all[reminder.task_id].status = 'active';
    all[reminder.task_id].snooze_until = null;
    all[reminder.task_id].last_triggered_at = new Date().toISOString();
    all[reminder.task_id].next_trigger_at = nextTrigger;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
  }

  await syncNativeReminder(reminder.task_id, {
    ...reminder,
    status: 'active',
    snooze_until: null,
    next_trigger_at: nextTrigger,
  });
};

// 6. Get currently due reminders (for in-app banner/alerts)
export const getActiveDueReminders = async (): Promise<{ reminder: TaskReminder; task: Task }[]> => {
  const nowIso = new Date().toISOString();

  try {
    // Query active reminders from Supabase joining tasks
    const { data, error } = await supabase
      .from('task_reminders')
      .select(`
        *,
        tasks!inner(*)
      `)
      .eq('is_enabled', true)
      .in('status', ['active', 'snoozed'])
      .lte('next_trigger_at', nowIso)
      .eq('tasks.is_deleted', false)
      .neq('tasks.status', 'completed');

    if (!error && data) {
      return data.map((row: any) => ({
        reminder: row as TaskReminder,
        task: row.tasks as Task,
      }));
    }
  } catch {
    // Fallback to local
  }

  // Local fallback check
  const local = getLocalReminders();
  const dueList: { reminder: TaskReminder; task: Task }[] = [];
  const now = Date.now();

  for (const r of Object.values(local)) {
    if (r.is_enabled && (r.status === 'active' || r.status === 'snoozed')) {
      const triggerTime = new Date(r.next_trigger_at).getTime();
      if (triggerTime <= now) {
        // Fetch task details
        try {
          const { data: task } = await supabase.from('tasks').select('*').eq('id', r.task_id).single();
          if (task && !task.is_deleted && task.status !== 'completed') {
            dueList.push({ reminder: r, task });
          } else if (task && (task.is_deleted || task.status === 'completed')) {
            // Auto stop
            removeLocalReminder(r.task_id);
          }
        } catch {
          // Ignore
        }
      }
    }
  }

  return dueList;
};