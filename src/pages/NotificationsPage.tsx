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
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
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
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Bell className="w-4 h-4" />
            <span>Activity Center</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mt-1">
            Notifications
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assignment alerts, reassignments, task completions, and system messages.
          </p>
        </div>

        {notifications.some((n) => !n.is_read) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="h-8 text-xs font-medium"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
            Mark All as Read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2.5 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-16 bg-muted rounded-xl"></div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="text-center py-16 border border-border bg-card shadow-xs">
          <CardContent className="space-y-2">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto" />
            <h3 className="text-sm font-bold text-foreground">No Notifications</h3>
            <p className="text-xs text-muted-foreground">You are all caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={`cursor-pointer p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                !n.is_read
                  ? 'bg-primary/5 border-primary/20 shadow-xs'
                  : 'bg-card border-border hover:border-primary/40'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>}
                  <h4 className="text-xs font-semibold text-foreground">{n.title}</h4>
                </div>
                <p className="text-xs text-muted-foreground">{n.message}</p>
              </div>

              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                {formatDateTime(n.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
