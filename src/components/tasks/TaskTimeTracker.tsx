// src/components/tasks/TaskTimeTracker.tsx
import React, { useState, useEffect } from 'react';
import { Play, Square, Clock, DollarSign, History } from 'lucide-react';
import {
  getActiveTimer,
  startTimer,
  stopTimer,
  getTaskTimeSessions,
  getTotalTaskDurationSeconds,
  TimeSession,
} from '../../services/timeTrackingService';
import { format } from 'date-fns';

interface TaskTimeTrackerProps {
  taskId: string;
  taskTitle: string;
}

export const TaskTimeTracker: React.FC<TaskTimeTrackerProps> = ({ taskId, taskTitle }) => {
  const [activeTimer, setActiveTimer] = useState(getActiveTimer());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [isBillable, setIsBillable] = useState<boolean>(true);
  const [hourlyRate, setHourlyRate] = useState<number>(500); // Default ₹500/hr

  const isCurrentTaskRunning = activeTimer && activeTimer.taskId === taskId;

  const refreshSessions = () => {
    setSessions(getTaskTimeSessions(taskId));
  };

  useEffect(() => {
    refreshSessions();

    const handleUpdate = () => {
      const active = getActiveTimer();
      setActiveTimer(active);
      refreshSessions();
    };

    window.addEventListener('tasker_timer_updated', handleUpdate);
    return () => window.removeEventListener('tasker_timer_updated', handleUpdate);
  }, [taskId]);

  // Live stopwatch counter
  useEffect(() => {
    if (!isCurrentTaskRunning || !activeTimer) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - activeTimer.startTimestamp) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isCurrentTaskRunning, activeTimer]);

  const handleStart = () => {
    startTimer(taskId, taskTitle, isBillable, hourlyRate);
    setActiveTimer(getActiveTimer());
  };

  const handleStop = () => {
    stopTimer();
    setActiveTimer(null);
    setElapsedSeconds(0);
    refreshSessions();
  };

  const formatDisplay = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalHistoricalSeconds = getTotalTaskDurationSeconds(taskId);
  const totalLoggedHours = (totalHistoricalSeconds / 3600).toFixed(2);
  const totalBillableAmount = sessions
    .filter((s) => s.isBillable)
    .reduce((acc, s) => acc + (s.durationSeconds / 3600) * (s.hourlyRate || 500), 0)
    .toFixed(0);

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Clock className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Work Time & Billable Hours
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            Total Logged: <strong className="text-foreground">{totalLoggedHours}h</strong>
          </span>
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            ₹{totalBillableAmount}
          </span>
        </div>
      </div>

      {/* Stopwatch & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {isCurrentTaskRunning ? formatDisplay(elapsedSeconds) : '00:00:00'}
          </span>
          {isCurrentTaskRunning && (
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Recording Live
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isCurrentTaskRunning ? (
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Timer
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop & Save Log
            </button>
          )}
        </div>
      </div>

      {/* Rate Configuration & Preferences */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isBillable}
            onChange={(e) => setIsBillable(e.target.checked)}
            className="rounded border-border text-primary focus:ring-0"
          />
          <span className="font-medium text-foreground">Billable Work</span>
        </label>

        {isBillable && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Rate:</span>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
              className="w-20 px-2 py-0.5 text-xs rounded border border-border bg-background text-foreground"
            />
            <span>₹/hr</span>
          </div>
        )}
      </div>

      {/* History Log Collapsible */}
      {sessions.length > 0 && (
        <div className="pt-2 border-t border-border/40 space-y-2">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <History className="w-3 h-3" />
            <span>Recent Sessions ({sessions.length})</span>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between text-[11px] p-2 rounded bg-muted/20 border border-border/30"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-foreground">
                    {formatDisplay(s.durationSeconds)}
                  </span>
                  <span className="text-muted-foreground">
                    {format(new Date(s.startTime), 'MMM d, h:mm a')}
                  </span>
                </div>
                {s.isBillable && (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    ₹{((s.durationSeconds / 3600) * (s.hourlyRate || 500)).toFixed(0)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

