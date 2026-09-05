import { supabase } from '../lib/supabase';
import { DEFAULT_USER_NAME } from '../constants';
import {
  CreateTaskInput,
  Task,
  TaskFilterOptions,
  TaskStats,
  TaskStatus,
  UpdateTaskInput,
} from '../types/task';
import { isTaskOverdue } from '../lib/dateUtils';
import { recordStatusChange } from './statusHistoryService';
import { addNote } from './notesService';
import { deleteAllTaskFiles } from './attachmentService';

export const getTasks = async (options: TaskFilterOptions = {}): Promise<Task[]> => {
  const isDeleted = options.includeDeleted ?? false;

  let query = supabase
    .from('tasks')
    .select(`
      *,
      task_attachments(count),
      task_notes(count)
    `)
    .eq('is_deleted', isDeleted);

  // Status Filter
  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status);
  }

  // Priority Filter
  if (options.priority && options.priority !== 'all') {
    query = query.eq('priority', options.priority);
  }

  // Person / Pending With Filter
  if (options.person && options.person.trim() !== '') {
    query = query.ilike('person_name', `%${options.person.trim()}%`);
  }

  // Global Search Filter (title, description, person_name, notes, attachment filenames)
  if (options.search && options.search.trim() !== '') {
    const s = options.search.trim();

    // Query task_notes and task_attachments for matching task IDs
    const [notesRes, attachmentsRes] = await Promise.all([
      supabase.from('task_notes').select('task_id').ilike('note', `%${s}%`),
      supabase.from('task_attachments').select('task_id').ilike('file_name', `%${s}%`),
    ]);

    const matchingTaskIds = new Set<string>();
    if (notesRes.data) {
      notesRes.data.forEach((r: any) => { if (r.task_id) matchingTaskIds.add(r.task_id); });
    }
    if (attachmentsRes.data) {
      attachmentsRes.data.forEach((r: any) => { if (r.task_id) matchingTaskIds.add(r.task_id); });
    }

    if (matchingTaskIds.size > 0) {
      const idListStr = Array.from(matchingTaskIds).join(',');
      query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%,person_name.ilike.%${s}%,id.in.(${idListStr})`);
    } else {
      query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%,person_name.ilike.%${s}%`);
    }
  }

  // Sorting
  switch (options.sortBy) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'due_date':
      query = query.order('due_date', { ascending: true, nullsFirst: false });
      break;
    case 'recently_updated':
      query = query.order('updated_at', { ascending: false });
      break;
    case 'pending_duration':
      query = query.order('pending_since', { ascending: true });
      break;
    case 'priority':
      query = query.order('priority', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading tasks:', error);
    throw new Error('Unable to load tasks.');
  }

  // Transform relational counts
  const tasks: Task[] = ((data as any[]) || []).map((row: any) => ({
    ...row,
    attachments_count: row.task_attachments?.[0]?.count ?? 0,
    notes_count: row.task_notes?.[0]?.count ?? 0,
  }));

  // Client-side post-filter for attachments if specified
  if (options.hasAttachments === true) {
    return tasks.filter((t) => (t.attachments_count ?? 0) > 0);
  }

  return tasks;
};

export const getTaskById = async (id: string): Promise<Task> => {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      task_attachments(count),
      task_notes(count)
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('Error fetching task details:', error);
    throw new Error('Unable to load task details.');
  }

  const row = data as any;
  return {
    ...row,
    attachments_count: row.task_attachments?.[0]?.count ?? 0,
    notes_count: row.task_notes?.[0]?.count ?? 0,
  } as Task;
};

export const createTask = async (input: CreateTaskInput): Promise<Task> => {
  const initialStatus = input.status || 'pending';
  const creator = input.created_by || DEFAULT_USER_NAME;
  const nowIso = new Date().toISOString();

  const insertPayload = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    person_name: input.person_name?.trim() || null,
    priority: input.priority || 'medium',
    status: initialStatus,
    due_date: input.due_date || null,
    created_by: creator,
    created_at: nowIso,
    updated_at: nowIso,
    pending_since: nowIso,
    started_at: initialStatus === 'in_progress' ? nowIso : null,
    completed_at: initialStatus === 'completed' ? nowIso : null,
    completed_by: initialStatus === 'completed' ? creator : null,
    is_deleted: false,
  };

  const { data, error } = await supabase
    .from('tasks')
    .insert(insertPayload as any)
    .select()
    .single();

  if (error || !data) {
    console.error('Error creating task:', error);
    throw new Error('Unable to save task. Please try again.');
  }

  const createdTask = data as Task;

  // Add initial note if provided
  if (input.initialNote && input.initialNote.trim() !== '') {
    try {
      await addNote(createdTask.id, input.initialNote.trim(), creator);
    } catch (noteErr) {
      console.warn('Initial note could not be saved:', noteErr);
    }
  }

  return createdTask;
};

export const updateTask = async (id: string, input: UpdateTaskInput): Promise<Task> => {
  const updatePayload: any = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updatePayload.title = input.title.trim();
  if (input.description !== undefined) updatePayload.description = input.description?.trim() || null;
  if (input.person_name !== undefined) updatePayload.person_name = input.person_name?.trim() || null;
  if (input.priority !== undefined) updatePayload.priority = input.priority;
  if (input.due_date !== undefined) updatePayload.due_date = input.due_date;

  const { data, error } = await supabase
    .from('tasks')
    .update(updatePayload as any)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    console.error('Error updating task:', error);
    throw new Error('Unable to update task. Please try again.');
  }

  return data as Task;
};

export const updateTaskStatus = async (
  id: string,
  newStatus: TaskStatus,
  remarks?: string,
  actor: string = DEFAULT_USER_NAME
): Promise<Task> => {
  // 1. Try transactional RPC first (atomic status update + history entry)
  try {
    const { error: rpcError } = await supabase.rpc(
      'update_task_status_with_history',
      {
        p_task_id: id,
        p_new_status: newStatus,
        p_actor: actor,
        p_remarks: remarks || null,
      }
    );

    if (!rpcError) {
      return await getTaskById(id);
    }
    console.warn('RPC update_task_status_with_history returned error, falling back to client update:', rpcError);
  } catch (rpcEx) {
    console.warn('RPC update_task_status_with_history exception, falling back to client update:', rpcEx);
  }

  // 2. Client-side fallback if RPC is not deployed yet
  const current = await getTaskById(id);
  const oldStatus = current.status;

  if (oldStatus === newStatus) {
    return current;
  }

  const nowIso = new Date().toISOString();
  const updatePayload: any = {
    status: newStatus,
    updated_at: nowIso,
  };

  if (newStatus === 'in_progress' && !current.started_at) {
    updatePayload.started_at = nowIso;
  }

  if (newStatus === 'pending') {
    updatePayload.pending_since = nowIso;
  }

  if (newStatus === 'completed') {
    updatePayload.completed_at = nowIso;
    updatePayload.completed_by = actor;
  } else if (oldStatus === 'completed') {
    updatePayload.completed_at = null;
    updatePayload.completed_by = null;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updatePayload as any)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    console.error('Error updating task status:', error);
    throw new Error('Failed to update task status.');
  }

  try {
    await recordStatusChange(id, oldStatus, newStatus, actor, remarks);
  } catch (histError) {
    console.warn('Status history recording fallback error:', histError);
  }

  return await getTaskById(id);
};

export const softDeleteTask = async (
  id: string,
  actor: string = DEFAULT_USER_NAME
): Promise<void> => {
  const { error } = await supabase
    .from('tasks')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: actor,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id);

  if (error) {
    console.error('Error moving task to bin:', error);
    throw new Error('Unable to move task to Bin.');
  }
};

export const restoreTask = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('tasks')
    .update({
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id);

  if (error) {
    console.error('Error restoring task:', error);
    throw new Error('Unable to restore task.');
  }
};

export const permanentDeleteTask = async (id: string): Promise<void> => {
  // 1. Delete from database first (cascades related DB metadata)
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error permanently deleting task from database:', error);
    throw new Error('Unable to permanently delete task.');
  }

  // 2. Remove all associated files from storage
  try {
    await deleteAllTaskFiles(id);
  } catch (storageErr) {
    console.warn('Task deleted from database, but could not clean up all files from storage:', storageErr);
  }
};

export const getTaskStats = async (): Promise<TaskStats> => {
  const { data: allTasks, error } = await supabase
    .from('tasks')
    .select('id, status, due_date, is_deleted');

  if (error || !allTasks) {
    return {
      pending: 0,
      inProgress: 0,
      partial: 0,
      completed: 0,
      overdue: 0,
      totalActive: 0,
      binCount: 0,
    };
  }

  let pending = 0;
  let inProgress = 0;
  let partial = 0;
  let completed = 0;
  let overdue = 0;
  let totalActive = 0;
  let binCount = 0;

  const tasksList = (allTasks as any[]) || [];

  for (const t of tasksList) {
    if (t.is_deleted) {
      binCount++;
    } else {
      totalActive++;
      if (t.status === 'pending') pending++;
      else if (t.status === 'in_progress') inProgress++;
      else if (t.status === 'partial') partial++;
      else if (t.status === 'completed') completed++;

      if (isTaskOverdue(t.due_date, t.status)) {
        overdue++;
      }
    }
  }

  return {
    pending,
    inProgress,
    partial,
    completed,
    overdue,
    totalActive,
    binCount,
  };
};

