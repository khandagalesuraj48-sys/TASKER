import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock, ArrowRight } from 'lucide-react';
import { getActiveDueReminders, snoozeTaskReminder, dismissTaskReminder } from '../../services/reminderService';
import { Task, TaskReminder } from '../../types/task';
import { formatDateTime } from '../../lib/dateUtils';
import { useTask } from '../../context/TaskContext';

export const ReminderBanner: React.FC = () => {
  const navigate = useNavigate();
  const { refreshKey } = useTask();
  const [dueList, setDueList] = useState<{ reminder: TaskReminder; task: Task }[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const checkDueReminders = async () => {
    try {
      const active = await getActiveDueReminders();
      setDueList(active);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    checkDueReminders();
    const interval = setInterval(checkDueReminders, 20000); // check every 20s
    return () => clearInterval(interval);
  }, [refreshKey]);

  if (dueList.length === 0) return null;

  const current = dueList[0];

  const handleOpenTask = () => {
    navigate(`/tasks/${current.task.id}`);
  };

  const handleSnooze = async () => {
    setIsProcessing(true);
    try {
      await snoozeTaskReminder(current.task.id, 15);
      await checkDueReminders();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = async () => {
    setIsProcessing(true);
    try {
      await dismissTaskReminder(current.reminder);
      await checkDueReminders();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-amber-500 dark:bg-amber-500 text-slate-950 px-4 py-2.5 shadow-md flex items-center justify-between flex-wrap gap-2 animate-in slide-in-from-top">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 dark:bg-amber-300 text-amber-950 animate-bounce shrink-0">
          <Bell className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold leading-none truncate text-slate-950">
            Reminder: {current.task.title}
          </p>
          <p className="text-[11px] text-amber-950/80 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Triggered at {formatDateTime(current.reminder.next_trigger_at)}
            {dueList.length > 1 && (
              <span className="ml-2 font-semibold bg-amber-600/30 px-1.5 py-0.2 rounded text-[10px]">
                +{dueList.length - 1} more
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs font-semibold">
        <button
          onClick={handleOpenTask}
          disabled={isProcessing}
          className="px-2.5 py-1 rounded bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 transition-colors flex items-center gap-1"
        >
          <span>Open Task</span>
          <ArrowRight className="w-3 h-3" />
        </button>

        <button
          onClick={handleSnooze}
          disabled={isProcessing}
          className="px-2.5 py-1 rounded bg-white text-slate-800 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Snooze 15m
        </button>

        <button
          onClick={handleDismiss}
          disabled={isProcessing}
          className="px-2 py-1 text-amber-950 hover:bg-amber-600/20 dark:hover:bg-amber-700/30 rounded transition-colors"
          title="Dismiss this reminder"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};