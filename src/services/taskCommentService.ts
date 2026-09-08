// src/services/taskCommentService.ts
import { supabase } from '../lib/supabase';

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  content: string;
  mentions: string[]; // List of user names or IDs
  audio_url?: string;
  created_at: string;
}

const LOCAL_COMMENTS_KEY = 'tasker_task_comments_cache_v1';

function getLocalComments(taskId: string): TaskComment[] {
  try {
    const raw = localStorage.getItem(LOCAL_COMMENTS_KEY);
    const all: TaskComment[] = raw ? JSON.parse(raw) : [];
    return all.filter((c) => c.task_id === taskId);
  } catch {
    return [];
  }
}

function saveLocalComment(comment: TaskComment): void {
  try {
    const raw = localStorage.getItem(LOCAL_COMMENTS_KEY);
    const all: TaskComment[] = raw ? JSON.parse(raw) : [];
    all.push(comment);
    localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('Failed to save local comment:', e);
  }
}

export async function fetchTaskComments(taskId: string): Promise<TaskComment[]> {
  try {
    const { data, error } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error || !data) {
      // Fallback to locally persisted comments
      return getLocalComments(taskId);
    }

    return data as TaskComment[];
  } catch {
    return getLocalComments(taskId);
  }
}

export async function addCommentToTask({
  taskId,
  userId,
  userName,
  userEmail,
  content,
  mentions = [],
  audioUrl,
}: {
  taskId: string;
  userId: string;
  userName: string;
  userEmail: string;
  content: string;
  mentions?: string[];
  audioUrl?: string;
}): Promise<TaskComment> {
  const newComment: TaskComment = {
    id: `comm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    task_id: taskId,
    user_id: userId,
    user_name: userName || 'Operative',
    user_email: userEmail || '',
    content,
    mentions,
    audio_url: audioUrl,
    created_at: new Date().toISOString(),
  };

  // 1. Save locally for instant optimistic UI
  saveLocalComment(newComment);

  // 2. Persist to Supabase if available
  try {
    await supabase.from('task_comments').insert([
      {
        id: newComment.id,
        task_id: taskId,
        user_id: userId,
        user_name: newComment.user_name,
        user_email: newComment.user_email,
        content: newComment.content,
        mentions: newComment.mentions,
        audio_url: newComment.audio_url,
        created_at: newComment.created_at,
      },
    ]);
  } catch (e) {
    // Fallback: Also mirror comment to existing task_notes table for Supabase cloud sync
    try {
      await supabase.from('task_notes').insert([
        {
          task_id: taskId,
          note: `💬 [Discussion] ${newComment.user_name}: ${content}`,
          created_by: newComment.user_name,
          user_id: userId || null,
          created_at: newComment.created_at,
        },
      ]);
    } catch (noteErr) {
      console.warn('Note mirror warning:', noteErr);
    }
  }

  // 3. Dispatch window event for realtime sync across components
  window.dispatchEvent(new CustomEvent('tasker_comment_added', { detail: newComment }));

  return newComment;
}
