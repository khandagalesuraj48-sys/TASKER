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

  // UUID validation helper to prevent Postgres 'invalid input syntax for type uuid' errors
  const isValidUuid = (id?: string | null): boolean => {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
  };

  const safeEntityId = isValidUuid(payload.entity_id) ? payload.entity_id!.trim() : null;
  const safeOrgId = isValidUuid(payload.organization_id) ? payload.organization_id!.trim() : null;

  try {
    const { error } = await supabase.from('notifications').insert({
      recipient_user_id: payload.recipient_user_id,
      organization_id: safeOrgId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      entity_type: payload.entity_type || 'task',
      entity_id: safeEntityId,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to insert in-app notification in Supabase:', error);
    } else {
      console.log('Notification dispatched successfully to user:', payload.recipient_user_id);
    }
  } catch (err) {
    console.error('Exception inserting in-app notification:', err);
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
  if (!userId) return () => {};

  try {
    const channelId = `user-notif-${userId}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        async (payload) => {
          try {
            if (payload.new) {
              const newNotif = payload.new as InAppNotification;
              onNewNotification(newNotif);

              // 1. Android / Native Platform Status Bar Push
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

              // 2. Web / Desktop OS Notification Support (Chrome, Edge, Electron Windows)
              if (
                typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                try {
                  new Notification(newNotif.title, {
                    body: newNotif.message,
                    icon: '/favicon.ico',
                  });
                } catch (desktopNotifErr) {
                  console.warn('Desktop notification dispatch note:', desktopNotifErr);
                }
              }

              // 3. Dispatch global browser event for instant UI reactive sync
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('tasker:notification_received', {
                    detail: newNotif,
                  })
                );
              }
            }
          } catch (payloadErr) {
            console.warn('Error in notification payload handler:', payloadErr);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  } catch (err) {
    console.warn('Error setting up notification subscription:', err);
    return () => {};
  }
};

