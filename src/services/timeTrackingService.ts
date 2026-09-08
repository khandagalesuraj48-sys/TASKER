// src/services/timeTrackingService.ts

export interface TimeSession {
  id: string;
  taskId: string;
  userId: string;
  startTime: string; // ISO
  endTime: string; // ISO
  durationSeconds: number;
  note?: string;
  isBillable: boolean;
  hourlyRate: number;
}

const STORAGE_KEY = 'tasker_time_tracking_sessions_v1';
const ACTIVE_TIMER_KEY = 'tasker_active_running_timer_v1';

export function getAllTimeSessions(): TimeSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getTaskTimeSessions(taskId: string): TimeSession[] {
  const all = getAllTimeSessions();
  return all.filter((s) => s.taskId === taskId);
}

export function getTotalTaskDurationSeconds(taskId: string): number {
  const sessions = getTaskTimeSessions(taskId);
  return sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
}

export function saveTimeSession(session: Omit<TimeSession, 'id'>): TimeSession {
  const all = getAllTimeSessions();
  const newSession: TimeSession = {
    ...session,
    id: `timer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  all.unshift(newSession);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return newSession;
}

export interface ActiveTimer {
  taskId: string;
  taskTitle: string;
  startTimestamp: number;
  isBillable: boolean;
  hourlyRate: number;
}

export function getActiveTimer(): ActiveTimer | null {
  try {
    const raw = localStorage.getItem(ACTIVE_TIMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function startTimer(taskId: string, taskTitle: string, isBillable = true, hourlyRate = 500): ActiveTimer {
  const active: ActiveTimer = {
    taskId,
    taskTitle,
    startTimestamp: Date.now(),
    isBillable,
    hourlyRate,
  };
  localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(active));
  window.dispatchEvent(new Event('tasker_timer_updated'));
  return active;
}

export function stopTimer(): TimeSession | null {
  const active = getActiveTimer();
  if (!active) return null;

  const now = Date.now();
  const durationSeconds = Math.max(1, Math.floor((now - active.startTimestamp) / 1000));

  const session = saveTimeSession({
    taskId: active.taskId,
    userId: 'current_user',
    startTime: new Date(active.startTimestamp).toISOString(),
    endTime: new Date(now).toISOString(),
    durationSeconds,
    isBillable: active.isBillable,
    hourlyRate: active.hourlyRate,
  });

  localStorage.removeItem(ACTIVE_TIMER_KEY);
  window.dispatchEvent(new Event('tasker_timer_updated'));
  return session;
}

export function discardTimer(): void {
  localStorage.removeItem(ACTIVE_TIMER_KEY);
  window.dispatchEvent(new Event('tasker_timer_updated'));
}
