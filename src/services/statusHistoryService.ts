import { supabase } from '../lib/supabase';
import { TaskStatus, TaskStatusHistory } from '../types/task';

export const getStatusHistory = async (taskId: string): Promise<TaskStatusHistory[]> => {
  const { data, error } = await supabase
    .from('task_status_history')
    .select('*')
    .eq('task_id', taskId)
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('Error fetching status history:', error);
    throw new Error('Unable to load status history.');
  }

  return (data || []) as TaskStatusHistory[];
};

export const recordStatusChange = async (
  taskId: string,
  oldStatus: TaskStatus | null,
  newStatus: TaskStatus,
  actor: string,
  remarks?: string | null
): Promise<TaskStatusHistory> => {
  const payload = {
    task_id: taskId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: actor,
    remarks: remarks || null,
    changed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('task_status_history')
    .insert(payload as any)
    .select()
    .single();

  if (error) {
    console.error('Error recording status change:', error);
    throw new Error('Failed to record status change history.');
  }

  return data as TaskStatusHistory;
};

