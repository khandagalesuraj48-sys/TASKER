import { supabase } from '../lib/supabase';
import { Task, TaskPriority, TaskAttachment, TaskDependency } from '../types/task';
import { createTask, updateTaskStatus, softDeleteTask } from './taskService';
import { addNote } from './notesService';
import { uploadAttachment } from './attachmentService';
import { createInAppNotification } from './notificationInboxService';
import { DEFAULT_USER_NAME } from '../constants';
import { OfflineSyncService } from './offlineSyncService';

export interface DelegatedSubtask extends Task {
  attachments?: TaskAttachment[];
}

export interface CreateSubtaskInput {
  title: string;
  description?: string;
  assignedToUserId?: string | null;
  assignedEmployeeId?: string | null;
  assignedToName?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
}

/**
 * Fetch all subtasks for a parent task with attached proof files
 */
export const getSubtasks = async (parentTaskId: string): Promise<DelegatedSubtask[]> => {
  if (!parentTaskId) return [];

  try {
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_task_id', parentTaskId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (tasksError) {
      console.warn('Error fetching subtasks from Supabase:', tasksError.message);
      // Fallback to local offline items if any
      const items = await OfflineSyncService.getItems<any>(
        'task_subtasks',
        (s) => s.task_id === parentTaskId
      );
      return items as any;
    }

    const subtasks = (tasksData || []) as DelegatedSubtask[];
    if (subtasks.length === 0) return [];

    // Fetch attachments for all subtasks
    const subtaskIds = subtasks.map((t) => t.id);
    try {
      const { data: attachData, error: attachError } = await supabase
        .from('task_attachments')
        .select('*')
        .in('task_id', subtaskIds)
        .order('uploaded_at', { ascending: false });

      if (!attachError && attachData) {
        const attachMap = new Map<string, TaskAttachment[]>();
        attachData.forEach((a: any) => {
          const list = attachMap.get(a.task_id) || [];
          list.push(a as TaskAttachment);
          attachMap.set(a.task_id, list);
        });

        subtasks.forEach((t) => {
          t.attachments = attachMap.get(t.id) || [];
        });
      }
    } catch (attachEx) {
      console.warn('Could not load subtask attachments:', attachEx);
    }

    return subtasks;
  } catch (err) {
    console.error('Failed to get subtasks:', err);
    return [];
  }
};

/**
 * Create a delegated subtask under a parent task
 */
export const createSubtask = async (
  parentTask: Task,
  input: CreateSubtaskInput,
  creatorName?: string
): Promise<Task> => {
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData?.user?.id || null;
  const currentUserName = creatorName || authData?.user?.email || DEFAULT_USER_NAME;

  const customFields = {
    is_subtask: true,
    parent_task_id: parentTask.id,
    parent_task_title: parentTask.title,
    parent_task_site_id: parentTask.site_id || null,
    parent_task_creator_id: parentTask.user_id || null,
    parent_task_assigned_to: parentTask.assigned_to || null,
    delegated_by_id: currentUserId,
    delegated_by_name: currentUserName,
  };

  const createdTask = await createTask({
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    parent_task_id: parentTask.id,
    org_id: parentTask.org_id || undefined,
    site_id: parentTask.site_id || undefined,
    scope: parentTask.scope || 'workplace',
    status: 'pending',
    priority: input.priority || parentTask.priority || 'medium',
    due_date: input.dueDate || parentTask.due_date || null,
    assigned_to: input.assignedToUserId || null,
    assigned_employee_id: input.assignedEmployeeId || null,
    person_name: input.assignedToName || undefined,
    created_by: currentUserName,
    user_id: currentUserId,
    custom_fields: customFields,
  });

  // Notify assignee C if assigned to an in-app user
  if (input.assignedToUserId && input.assignedToUserId !== currentUserId) {
    try {
      await createInAppNotification({
        recipient_user_id: input.assignedToUserId,
        organization_id: parentTask.org_id,
        type: 'task_assigned',
        title: 'New Subtask Delegated',
        message: `${currentUserName} delegated an action item to you: "${input.title.trim()}" under "${parentTask.title}".`,
        entity_type: 'task',
        entity_id: createdTask.id,
      });
    } catch (notifErr) {
      console.warn('Failed to send subtask delegation notification:', notifErr);
    }
  }

  // Add audit note to parent task
  try {
    await addNote(
      parentTask.id,
      `${currentUserName} delegated subtask "${input.title.trim()}" to ${input.assignedToName || 'team member'}.`,
      currentUserName
    );
  } catch (noteErr) {
    console.warn('Failed to add delegation note to parent task:', noteErr);
  }

  return createdTask;
};

/**
 * Complete a delegated subtask with proof (e.g. Log Book / Photos / Documents)
 */
export const completeSubtaskWithProof = async (
  subtask: Task,
  remarks: string,
  file?: File | null,
  actorName?: string
): Promise<Task> => {
  const { data: authData } = await supabase.auth.getUser();
  const currentUserName = actorName || authData?.user?.email || DEFAULT_USER_NAME;

  // 1. Upload proof file/log book if provided
  if (file) {
    await uploadAttachment(subtask.id, file, currentUserName);
  }

  // 2. Update subtask status to completed
  const updatedSubtask = await updateTaskStatus(
    subtask.id,
    'completed',
    remarks.trim(),
    currentUserName
  );

  return updatedSubtask;
};

/**
 * Quick toggle subtask status
 */
export const toggleSubtask = async (
  subtaskId: string,
  isCompleted: boolean,
  actorName?: string
): Promise<Task> => {
  const newStatus = isCompleted ? 'completed' : 'pending';
  return await updateTaskStatus(
    subtaskId,
    newStatus,
    isCompleted ? 'Marked done from subtasks list' : 'Reopened',
    actorName
  );
};

/**
 * Delete a subtask
 */
export const deleteSubtask = async (subtaskId: string): Promise<boolean> => {
  try {
    await softDeleteTask(subtaskId);
    return true;
  } catch {
    return false;
  }
};

/**
 * Backward-compatible addSubtask for plain string additions
 */
export const addSubtask = async (parentTaskId: string, title: string): Promise<any> => {
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData?.user?.id || null;
  const currentUserName = authData?.user?.email || DEFAULT_USER_NAME;

  return await createTask({
    title: title.trim(),
    parent_task_id: parentTaskId,
    scope: 'workplace',
    status: 'pending',
    priority: 'medium',
    created_by: currentUserName,
    user_id: currentUserId,
    custom_fields: { is_subtask: true, parent_task_id: parentTaskId },
  });
};

/**
 * Task Dependency helpers
 */
export const getTaskDependencies = async (taskId: string): Promise<TaskDependency[]> => {
  return await OfflineSyncService.getItems<TaskDependency>(
    'task_dependencies',
    (d) => d.task_id === taskId || d.depends_on_task_id === taskId
  );
};

export const addTaskDependency = async (
  taskId: string,
  dependsOnTaskId: string,
  type: 'blocks' | 'blocked_by' = 'blocked_by'
): Promise<TaskDependency> => {
  const dep: TaskDependency = {
    id: 'dep_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    task_id: taskId,
    depends_on_task_id: dependsOnTaskId,
    dependency_type: type,
    created_at: new Date().toISOString(),
  };

  return await OfflineSyncService.saveItem('task_dependencies', dep);
};
