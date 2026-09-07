import { supabase } from '../lib/supabase';
import { InAppNotification } from '../types/task';

export const getNotifications = async (unreadOnly: boolean = false): Promise<InAppNotification[]> => {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return [];

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return (data as InAppNotification[]) || [];
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error getting notification count:', error);
    return 0;
  }

  return count ?? 0;
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification read:', error);
  }
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return;

  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('recipient_user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications read:', error);
  }
};

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const createInAppNotification = async (payload: {
  recipient_user_id: string;
  organization_id?: string | null;
  type: 'task_assigned' | 'task_reassigned' | 'task_completed' | 'task_comment' | 'system';
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string | null;
}): Promise<void> => {
  if (!payload.recipient_user_id) return;
  try {
    await supabase.from('notifications').insert({
      recipient_user_id: payload.recipient_user_id,
      organization_id: payload.organization_id || null,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      entity_type: payload.entity_type || 'task',
      entity_id: payload.entity_id || null,
      is_read: false,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to insert in-app notification:', err);
  }
};

export const syncUnreadNotificationsToLocal = async (userId: string): Promise<void> => {
  if (!Capacitor.isNativePlatform() || !userId) return;

  try {
    const LAST_NOTIF_SYNC_KEY = `tasker_last_notif_sync_${userId}`;
    const lastSync = localStorage.getItem(LAST_NOTIF_SYNC_KEY);
    // If never synced, check last 12 hours. If synced, check anything after last sync.
    const sinceDate = lastSync
      ? new Date(lastSync).toISOString()
      : new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_user_id', userId)
      .eq('is_read', false)
      .gt('created_at', sinceDate)
      .order('created_at', { ascending: false })
      .limit(5);

    localStorage.setItem(LAST_NOTIF_SYNC_KEY, new Date().toISOString());

    if (error || !data || data.length === 0) return;

    const unreadList = data as InAppNotification[];
    for (const newNotif of unreadList) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 899999) + 1,
              title: newNotif.title,
              body: newNotif.message,
              channelId: 'tasker_alerts',
              smallIcon: 'ic_launcher_foreground',
              iconColor: '#2563eb',
              sound: 'default',
              autoCancel: true,
              extra: {
                taskId: newNotif.entity_id,
                entity_type: newNotif.entity_type,
                entity_id: newNotif.entity_id,
                path: newNotif.entity_id ? `/tasks/${newNotif.entity_id}` : '/notifications',
              },
            },
          ],
        });
      } catch (err) {
        console.warn('Error scheduling unread sync notification:', err);
      }
    }
  } catch (e) {
    console.warn('Failed to sync unread notifications:', e);
  }
};

export const subscribeToNotifications = (
  userId: string,
  onNewNotification: (notification: InAppNotification) => void
) => {
  const channel = supabase
    .channel(`user-notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_user_id=eq.${userId}`,
      },
      async (payload) => {
        if (payload.new) {
          const newNotif = payload.new as InAppNotification;
          onNewNotification(newNotif);

          // If on Android / Native platform, push directly to system status bar with HIGH importance
          if (Capacitor.isNativePlatform()) {
            try {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    id: Math.floor(Math.random() * 899999) + 1,
                    title: newNotif.title,
                    body: newNotif.message,
                    channelId: 'tasker_alerts',
                    smallIcon: 'ic_launcher_foreground',
                    iconColor: '#2563eb',
                    sound: 'default',
                    autoCancel: true,
                    extra: {
                      taskId: newNotif.entity_id,
                      entity_type: newNotif.entity_type,
                      entity_id: newNotif.entity_id,
                      path: newNotif.entity_id ? `/tasks/${newNotif.entity_id}` : '/notifications',
                    },
                  },
                ],
              });
            } catch (e) {
              console.warn('Error scheduling local notification on arrival:', e);
            }
          }
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

