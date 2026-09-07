import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { InAppNotification } from '../../types/task';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToNotifications,
} from '../../services/notificationInboxService';
import { useAuth } from '../../context/AuthContext';
import { Bell, CheckCheck, Clock, CheckCircle2 } from 'lucide-react';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    if (!user) return;
    const count = await getUnreadNotificationCount();
    setUnreadCount(count);
  };

  const fetchAllNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();

    const unsubscribe = subscribeToNotifications(user.id, (newNotif) => {
      setUnreadCount((prev) => prev + 1);
      setNotifications((prev) => [newNotif, ...prev]);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      fetchAllNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleItemClick = async (notif: InAppNotification) => {
    if (!notif.is_read) {
      await markNotificationAsRead(notif.id);
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }
    setIsOpen(false);
    if (notif.entity_type === 'task' && notif.entity_id) {
      navigate(`/tasks/${notif.entity_id}`);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden text-xs">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <div className="p-6 text-center text-slate-400">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="font-medium text-slate-600 dark:text-slate-400">All caught up!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">No new notifications.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                    notif.is_read
                      ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50 opacity-75'
                      : 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/80 dark:hover:bg-blue-950/40'
                  }`}
                >
                  <span
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      notif.is_read ? 'bg-transparent' : 'bg-blue-600 dark:bg-blue-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold text-slate-900 dark:text-slate-100 ${notif.is_read ? 'font-normal' : ''}`}>
                      {notif.title}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5 line-clamp-2">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

