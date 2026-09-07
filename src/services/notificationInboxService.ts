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
      (payload) => {
        if (payload.new) {
          onNewNotification(payload.new as InAppNotification);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

