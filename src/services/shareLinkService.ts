import { supabase } from '../lib/supabase';
import { TaskShareLink } from '../types/task';

/**
 * Computes the hexadecimal SHA-256 hash of a string using Web Crypto API.
 */
export const hashTokenSha256 = async (rawToken: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawToken);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Generates a cryptographically secure random url-safe token.
 */
export const generateSecureToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export interface CreateShareLinkOptions {
  taskId: string;
  expiresInDays?: number | null;
  allowAttachments?: boolean;
}

export interface ShareLinkResult {
  shareUrl: string;
  rawToken: string;
  expiresAt: string | null;
  link: TaskShareLink;
}

/**
 * Creates a secure, read-only share link for a task.
 * Note: Only the SHA-256 hash of the token is saved in the database.
 */
export const createTaskShareLink = async (
  options: CreateShareLinkOptions
): Promise<ShareLinkResult> => {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) {
    throw new Error('You must be logged in to share a task.');
  }

  const rawToken = generateSecureToken();
  const tokenHash = await hashTokenSha256(rawToken);

  let expiresAt: string | null = null;
  if (options.expiresInDays && options.expiresInDays > 0) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + options.expiresInDays);
    expiresAt = expDate.toISOString();
  }

  const { data, error } = await supabase
    .from('task_share_links')
    .insert({
      task_id: options.taskId,
      created_by: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      is_active: true,
      allow_attachments: options.allowAttachments ?? false,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Error creating share link:', error);
    throw new Error('Failed to create task share link.');
  }

  const baseUrl = window.location.origin;
  const shareUrl = `${baseUrl}/shared/task/${rawToken}`;

  return {
    shareUrl,
    rawToken,
    expiresAt,
    link: data as TaskShareLink,
  };
};

/**
 * Retrieves the public shared task data using the raw token.
 * Token is hashed before calling the database security definer function.
 */
export const getPublicSharedTask = async (
  rawToken: string
): Promise<{
  task: any;
  attachments: any[];
  allowAttachments: boolean;
  expiresAt: string | null;
}> => {
  const tokenHash = await hashTokenSha256(rawToken.trim());

  const { data, error } = await supabase.rpc('get_shared_task_public', {
    p_token_hash: tokenHash,
  });

  if (error) {
    console.error('Error fetching shared task:', error);
    throw new Error('Unable to load shared task.');
  }

  if (!data || !data.success) {
    throw new Error(data?.error || 'Shared link is invalid or expired.');
  }

  return {
    task: data.task,
    attachments: data.attachments || [],
    allowAttachments: data.allow_attachments || false,
    expiresAt: data.expires_at || null,
  };
};

/**
 * Revokes an existing share link.
 */
export const revokeShareLink = async (linkId: string): Promise<void> => {
  const { error } = await supabase
    .from('task_share_links')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', linkId);

  if (error) {
    console.error('Error revoking share link:', error);
    throw new Error('Failed to revoke share link.');
  }
};

/**
 * Gets all share links created for a specific task.
 */
export const getTaskShareLinks = async (taskId: string): Promise<TaskShareLink[]> => {
  const { data, error } = await supabase
    .from('task_share_links')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching share links:', error);
    return [];
  }

  return (data as TaskShareLink[]) || [];
};

