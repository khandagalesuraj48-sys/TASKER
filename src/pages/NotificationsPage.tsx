import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notificationInboxService';
import { InAppNotification } from '../types/task';
import { Button } from '../components/common/Button';
import { formatDateTime } from '../lib/dateUtils';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadNotifications = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user?.id]);

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      showToast('All notifications marked as read.', 'info');
    } catch {
      showToast('Could not mark all as read.', 'error');
    }
  };

  const handleItemClick = async (n: InAppNotification) => {
    if (!n.is_read) {
      await markNotificationAsRead(n.id);
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)));
    }
    if (n.entity_type === 'task' && n.entity_id) {
      navigate(`/org/tasks/${n.entity_id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <Bell className="w-4 h-4" />
            <span>Activity Center</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            Notifications
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Assignment alerts, reassignments, task completions, and system messages.
          </p>
        </div>

        {notifications.some((n) => !n.is_read) && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} leftIcon={<CheckCheck className="w-3.5 h-3.5" />}>
            Mark All as Read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-2">
          <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Notifications</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">You are all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                !n.is_read
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{n.title}</h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">{n.message}</p>
              </div>

              <span className="text-[10px] text-slate-400 shrink-0">{formatDateTime(n.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
