-- ==============================================================================
-- Migration: 015_background_sync_rpc.sql
-- Application: TASKER Enterprise Operating System
-- Target: Native Android Background Notification Polling & Sync
-- ==============================================================================

-- 1. Create a secure, highly-performant function for native Android background sync
CREATE OR REPLACE FUNCTION public.get_unread_notifications_background(
    p_user_id UUID,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    recipient_user_id UUID,
    title TEXT,
    message TEXT,
    type TEXT,
    entity_type TEXT,
    entity_id UUID,
    created_at TIMESTAMPTZ,
    is_read BOOLEAN
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.recipient_user_id,
        n.title,
        n.message,
        n.type,
        n.entity_type,
        n.entity_id,
        n.created_at,
        n.is_read
    FROM public.notifications n
    WHERE n.recipient_user_id = p_user_id
      AND n.is_read = false
    ORDER BY n.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 2. Allow execute permissions for anon and authenticated clients
GRANT EXECUTE ON FUNCTION public.get_unread_notifications_background(UUID, INT) TO anon, authenticated;

-- 3. Helpful index for ultra-fast unread notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
    ON public.notifications (recipient_user_id, is_read, created_at DESC);

