import { supabase } from '../lib/supabase';
import { DEFAULT_USER_NAME } from '../constants';
import {
  CreateTaskInput,
  Task,
  TaskAssignment,
  TaskFilterOptions,
  TaskScope,
  TaskStats,
  TaskStatus,
  UniversalSearchResult,
  UpdateTaskInput,
} from '../types/task';
import { ErpEmployee } from '../types/enterprise';
import { isTaskOverdue } from '../lib/dateUtils';
import { recordStatusChange } from './statusHistoryService';
import { addNote } from './notesService';
import { deleteAllTaskFiles } from './attachmentService';
import { stopTaskReminder } from './reminderService';
import { adminService } from './adminService';

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

  // Scope Filter (Personal vs Workplace)
  if (options.scope) {
    query = query.eq('scope', options.scope);
  }

  // Organization Filter
  if (options.orgId) {
    query = query.eq('org_id', options.orgId);
  }

  // Assigned To Filter
  if (options.assignedTo) {
    query = query.eq('assigned_to', options.assignedTo);
  }

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

  // Workspace Filter
  if (options.workspaceId) {
    query = query.eq('workspace_id', options.workspaceId);
  }

  // Project Filter
  if (options.projectId) {
    query = query.eq('project_id', options.projectId);
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
  let result = tasks;
  if (options.hasAttachments === true) {
    result = result.filter((t) => (t.attachments_count ?? 0) > 0);
  }

  // Strong guarantee: Never return deleted tasks unless explicitly requested
  if (!isDeleted) {
    result = result.filter((t) => t.is_deleted !== true);
  }

  return result;
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
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData?.user?.id || input.user_id || null;
  const creator = authData?.user?.email || input.created_by || DEFAULT_USER_NAME;
  const nowIso = new Date().toISOString();

  // Core essential payload fields that always exist
  const insertPayload: Record<string, any> = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    person_name: input.person_name?.trim() || null,
    priority: input.priority || 'medium',
    status: initialStatus,
    due_date: input.due_date || null,
    created_by: creator,
    user_id: currentUserId,
    created_at: nowIso,
    updated_at: nowIso,
    pending_since: nowIso,
    started_at: initialStatus === 'in_progress' ? nowIso : null,
    completed_at: initialStatus === 'completed' ? nowIso : null,
    completed_by: initialStatus === 'completed' ? creator : null,
    is_deleted: false,
    scope: input.scope || 'personal',
  };

  // Only include optional columns if explicitly defined with non-empty values
  if (input.org_id) insertPayload.org_id = input.org_id;
  if (input.assigned_to) insertPayload.assigned_to = input.assigned_to;
  if (input.assigned_employee_id) insertPayload.assigned_employee_id = input.assigned_employee_id;
  if (input.is_pinned !== undefined) insertPayload.is_pinned = input.is_pinned;
  if (input.tags && input.tags.length > 0) insertPayload.tags = input.tags;
  if (input.custom_fields && Object.keys(input.custom_fields).length > 0) insertPayload.custom_fields = input.custom_fields;
  if (input.estimated_minutes !== undefined && input.estimated_minutes !== null) insertPayload.estimated_minutes = input.estimated_minutes;
  if (input.recurrence_rule) insertPayload.recurrence_rule = input.recurrence_rule;
  if (input.entity_type) insertPayload.entity_type = input.entity_type;
  if (input.entity_id) insertPayload.entity_id = input.entity_id;
  if (input.workspace_id) insertPayload.workspace_id = input.workspace_id;
  if (input.project_id) insertPayload.project_id = input.project_id;
  if (input.parent_task_id) insertPayload.parent_task_id = input.parent_task_id;
  if (input.site_id) insertPayload.site_id = input.site_id;
  if (input.department_id) insertPayload.department_id = input.department_id;

  if (insertPayload.scope === 'workplace' && !insertPayload.org_id) {
    throw new Error('An organization must be selected for workplace tasks.');
  }

  // Schema-resilient insertion with automatic missing column stripping
  let currentPayload = { ...insertPayload };
  let insertResult: any = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    insertResult = await supabase
      .from('tasks')
      .insert(currentPayload as any)
      .select()
      .single();

    if (!insertResult.error) break;

    const errStr = (insertResult.error.message || '') + ' ' + ((insertResult.error as any).details || '') + ' ' + ((insertResult.error as any).hint || '');
    const colMatch = errStr.match(/Could not find (?:the )?'([a-zA-Z0-9_]+)' column/i);

    if (colMatch && colMatch[1] && currentPayload[colMatch[1]] !== undefined) {
      console.warn(`Stripping missing column '${colMatch[1]}' from tasks insert payload and retrying...`);
      delete currentPayload[colMatch[1]];
      continue;
    }

    break;
  }

  if (insertResult.error || !insertResult.data) {
    console.error('Error creating task:', insertResult.error);
    throw new Error(insertResult.error?.message || 'Unable to save task. Please try again.');
  }

  const createdTask = insertResult.data as Task;

  // Add initial note if provided
  if (input.initialNote && input.initialNote.trim() !== '') {
    try {
      await addNote(createdTask.id, input.initialNote.trim(), creator);
    } catch (noteErr) {
      console.warn('Initial note could not be saved:', noteErr);
    }
  }

  // Send in-app and mobile notification to assignee if assigned during creation
  if (createdTask.assigned_to) {
    try {
      const { createInAppNotification } = await import('./notificationInboxService');
      const { data: authData } = await supabase.auth.getUser();
      const assignerName = authData?.user?.user_metadata?.display_name || authData?.user?.email || creator || 'व्यवस्थापक';
      await createInAppNotification({
        recipient_user_id: createdTask.assigned_to,
        organization_id: createdTask.org_id,
        type: 'task_assigned',
        title: 'नवीन टास्क नियुक्त केला (New Task Assigned)',
        message: `${assignerName} ने तुम्हाला "${createdTask.title}" हा नवीन टास्क सोपवला आहे.`,
        entity_type: 'task',
        entity_id: createdTask.id,
      });
    } catch (notifErr) {
      console.warn('Failed to send assignment notification on task creation:', notifErr);
    }
  }

  return createdTask;
};

export const updateTask = async (id: string, input: UpdateTaskInput): Promise<Task> => {
  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updatePayload.title = input.title.trim();
  if (input.description !== undefined) updatePayload.description = input.description?.trim() || null;
  if (input.person_name !== undefined) updatePayload.person_name = input.person_name?.trim() || null;
  if (input.priority !== undefined) updatePayload.priority = input.priority;
  if (input.due_date !== undefined) updatePayload.due_date = input.due_date;
  if (input.is_pinned !== undefined) updatePayload.is_pinned = input.is_pinned;
  if (input.tags !== undefined) updatePayload.tags = input.tags;
  if (input.custom_fields !== undefined && Object.keys(input.custom_fields).length > 0) {
    updatePayload.custom_fields = input.custom_fields;
  }
  if (input.estimated_minutes !== undefined) updatePayload.estimated_minutes = input.estimated_minutes;
  if (input.actual_minutes !== undefined) updatePayload.actual_minutes = input.actual_minutes;
  if (input.recurrence_rule !== undefined) updatePayload.recurrence_rule = input.recurrence_rule;
  if (input.scope !== undefined) updatePayload.scope = input.scope;
  if (input.org_id !== undefined) updatePayload.org_id = input.org_id;
  if (input.assigned_to !== undefined) updatePayload.assigned_to = input.assigned_to;
  if (input.assigned_employee_id !== undefined) updatePayload.assigned_employee_id = input.assigned_employee_id;
  if (input.site_id !== undefined) updatePayload.site_id = input.site_id;
  if (input.department_id !== undefined) updatePayload.department_id = input.department_id;
  if (input.project_id !== undefined) updatePayload.project_id = input.project_id;
  if (input.workspace_id !== undefined) updatePayload.workspace_id = input.workspace_id;
  if (input.parent_task_id !== undefined) updatePayload.parent_task_id = input.parent_task_id;
  if (input.entity_type !== undefined) updatePayload.entity_type = input.entity_type;
  if (input.entity_id !== undefined) updatePayload.entity_id = input.entity_id;

  // Schema-resilient update with automatic missing column stripping
  let currentUpdatePayload = { ...updatePayload };
  let updateResult: any = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    updateResult = await supabase
      .from('tasks')
      .update(currentUpdatePayload as any)
      .eq('id', id)
      .select()
      .single();

    if (!updateResult.error) break;

    const errStr = (updateResult.error.message || '') + ' ' + ((updateResult.error as any).details || '') + ' ' + ((updateResult.error as any).hint || '');
    const colMatch = errStr.match(/Could not find (?:the )?'([a-zA-Z0-9_]+)' column/i);

    if (colMatch && colMatch[1] && currentUpdatePayload[colMatch[1]] !== undefined) {
      console.warn(`Stripping missing column '${colMatch[1]}' from tasks update payload and retrying...`);
      delete currentUpdatePayload[colMatch[1]];
      continue;
    }

    break;
  }

  if (updateResult.error || !updateResult.data) {
    console.error('Error updating task:', updateResult.error);
    throw new Error(updateResult.error?.message || 'Unable to update task. Please try again.');
  }

  const updatedTask = updateResult.data as Task;

  // Send notification if task was assigned/reassigned in update
  if (input.assigned_to && input.assigned_to.trim() !== '') {
    try {
      const { createInAppNotification } = await import('./notificationInboxService');
      const { data: authData } = await supabase.auth.getUser();
      const assignerName = authData?.user?.user_metadata?.display_name || authData?.user?.email || 'व्यवस्थापक';
      await createInAppNotification({
        recipient_user_id: input.assigned_to,
        organization_id: updatedTask.org_id,
        type: 'task_assigned',
        title: 'टास्क वाटप (Task Assigned / Updated)',
        message: `${assignerName} ने तुम्हाला "${updatedTask.title}" हा टास्क सोपवला आहे.`,
        entity_type: 'task',
        entity_id: updatedTask.id,
      });
    } catch (notifErr) {
      console.warn('Failed to send assignment notification on updateTask:', notifErr);
    }
  }

  return updatedTask;
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
    if (remarks && remarks.trim()) {
      updatePayload.reassigned_by = remarks.trim();
    }
    // Automatically stop future reminders when task becomes completed
    try {
      await stopTaskReminder(id);
    } catch {
      // Ignore
    }
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

  // Send targeted in-app & mobile notification
  if (newStatus === 'completed') {
    try {
      const { createInAppNotification } = await import('./notificationInboxService');

      // 1. Direct creator notification
      if (current.user_id) {
        await createInAppNotification({
          recipient_user_id: current.user_id,
          organization_id: current.org_id,
          type: 'task_completed',
          title: 'Task Completed',
          message: `${actor} completed "${current.title}".${remarks ? ` Remark: "${remarks.trim()}"` : ''}`,
          entity_type: 'task',
          entity_id: id,
        });
      }

      // 2. If this is a subtask, notify parent task creator (A) and assignee (B)
      if (current.parent_task_id) {
        const parentCreatorId = current.custom_fields?.parent_task_creator_id;
        const parentAssigneeId = current.custom_fields?.parent_task_assigned_to;
        const parentTitle = current.custom_fields?.parent_task_title || 'parent task';

        const notifyRecipients = new Set<string>();
        if (parentCreatorId) notifyRecipients.add(parentCreatorId);
        if (parentAssigneeId) notifyRecipients.add(parentAssigneeId);

        // Don't notify the person who just completed it
        const authUser = (await supabase.auth.getUser()).data?.user;
        if (authUser?.id) notifyRecipients.delete(authUser.id);
        if (current.user_id) notifyRecipients.delete(current.user_id); // already notified above

        for (const recipientId of notifyRecipients) {
          await createInAppNotification({
            recipient_user_id: recipientId,
            organization_id: current.org_id,
            type: 'task_completed',
            title: 'Subtask Completed',
            message: `${actor} completed subtask "${current.title}" under "${parentTitle}".${remarks ? ` Remark: "${remarks.trim()}"` : ''}`,
            entity_type: 'task',
            entity_id: current.parent_task_id,
          });
        }

        // Add audit note to the parent task
        try {
          await addNote(
            current.parent_task_id,
            `✓ Subtask "${current.title}" completed by ${actor}.${remarks ? ` Remark: "${remarks.trim()}"` : ''}`,
            actor
          );
        } catch (auditErr) {
          console.warn('Could not record subtask completion note on parent:', auditErr);
        }
      }
    } catch (notifErr) {
      console.warn('Could not send completion notification:', notifErr);
    }
  }

  return await getTaskById(id);
};

export const canUserDeleteTask = (
  task: Pick<Task, 'user_id' | 'created_by' | 'org_id'>,
  user?: { id?: string; email?: string; user_metadata?: any } | null,
  isPlatformAdmin?: boolean,
  isOrgAdmin?: boolean
): boolean => {
  if (isPlatformAdmin) return true;
  if (isOrgAdmin) return true;
  if (!user || !user.id) return false;

  // Check creator user_id
  if (task.user_id && task.user_id === user.id) return true;

  // Check creator email / name
  if (task.created_by) {
    if (user.email && task.created_by.toLowerCase() === user.email.toLowerCase()) return true;
    if (user.user_metadata?.full_name && task.created_by.toLowerCase() === user.user_metadata.full_name.toLowerCase()) return true;
    if (task.created_by === user.id) return true;
  }

  return false;
};

export const verifyTaskDeletePermission = async (taskId: string): Promise<Task> => {
  const { data: authData } = await supabase.auth.getUser();
  const currentUser = authData?.user;
  if (!currentUser) {
    throw new Error('कृपया प्रथम लॉगिन करा. (User not logged in)');
  }

  const { data: task, error: fetchErr } = await supabase
    .from('tasks')
    .select('id, user_id, created_by, org_id, title')
    .eq('id', taskId)
    .maybeSingle();

  if (fetchErr || !task) {
    throw new Error('टास्क सापडला नाही. (Task not found)');
  }

  const isPlatformAdmin = await adminService.isPlatformAdmin(currentUser.id);
  let isOrgAdmin = false;
  if (task.org_id) {
    const { data: membership } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', task.org_id)
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (membership && (membership.role === 'org_owner' || membership.role === 'org_admin')) {
      isOrgAdmin = true;
    }
  }

  const allowed = canUserDeleteTask(task as Task, currentUser, isPlatformAdmin, isOrgAdmin);
  if (!allowed) {
    throw new Error('परमिशन नाकारली! फक्त टास्क तयार करणारा किंवा ॲडमिनच हा टास्क डिलीट करू शकतो. (Only the task creator or admin can delete this task.)');
  }

  return task as Task;
};

export const softDeleteTask = async (
  id: string,
  actor: string = DEFAULT_USER_NAME
): Promise<void> => {
  // Enforce delete authorization: Creator or Admin ONLY
  await verifyTaskDeletePermission(id);

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

  // Automatically stop active reminders when task is moved to bin
  try {
    await stopTaskReminder(id);
  } catch {
    // Ignore
  }

  // Clean up any in-app notifications for this task so assigned users no longer see pending alerts
  try {
    await supabase.from('notifications').delete().eq('entity_id', id);
  } catch (notifErr) {
    console.warn('Could not clean up notifications on soft delete:', notifErr);
  }

  // Cancel any active assignment records in task_assignments
  try {
    await supabase
      .from('task_assignments')
      .update({ status: 'cancelled', remark: 'Task moved to bin by creator/admin' })
      .eq('task_id', id);
  } catch (asgnErr) {
    console.warn('Could not cancel task_assignments on soft delete:', asgnErr);
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
  // Enforce delete authorization: Creator or Admin ONLY
  await verifyTaskDeletePermission(id);

  // 1. Delete from database first (cascades related DB metadata)
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error permanently deleting task from database:', error);
    throw new Error('Unable to permanently delete task.');
  }

  try {
    await stopTaskReminder(id);
  } catch {
    // Ignore
  }

  // Clean up notifications and assignment records for permanently deleted task
  try {
    await supabase.from('notifications').delete().eq('entity_id', id);
  } catch {}

  try {
    await supabase.from('task_assignments').delete().eq('task_id', id);
  } catch {}

  // 2. Remove all associated files from storage
  try {
    await deleteAllTaskFiles(id);
  } catch (storageErr) {
    console.warn('Task deleted from database, but could not clean up all files from storage:', storageErr);
  }
};

export const getTaskStats = async (scope?: 'personal' | 'workplace'): Promise<TaskStats> => {
  let query = supabase
    .from('tasks')
    .select('id, status, due_date, is_deleted');

  if (scope) {
    query = query.eq('scope', scope);
  }

  const { data: allTasks, error } = await query;

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

export const universalSearchTasks = async (
  query: string,
  filterScope?: TaskScope,
  filterOrgId?: string
): Promise<UniversalSearchResult[]> => {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return [];

  // 1. Try server RPC first if available
  try {
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('search_tasks_universal', {
      p_query: query.trim(),
    });

    if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
      const taskIds = rpcRows.map((r: any) => r.task_id);
      let rpcTasksQuery = supabase
        .from('tasks')
        .select(`
          *,
          task_attachments(count),
          task_notes(count)
        `)
        .in('id', taskIds)
        .eq('is_deleted', false);

      if (filterScope) {
        rpcTasksQuery = rpcTasksQuery.eq('scope', filterScope);
      }
      if (filterScope === 'workplace' && filterOrgId) {
        rpcTasksQuery = rpcTasksQuery.eq('org_id', filterOrgId);
      }

      const { data: tasksData } = await rpcTasksQuery;

      if (tasksData && tasksData.length > 0) {
        const taskMap = new Map<string, Task>();
        tasksData.forEach((row: any) => {
          taskMap.set(row.id, {
            ...row,
            attachments_count: row.task_attachments?.[0]?.count ?? 0,
            notes_count: row.task_notes?.[0]?.count ?? 0,
          });
        });

        const results: UniversalSearchResult[] = [];
        for (const r of rpcRows) {
          const t = taskMap.get(r.task_id);
          if (t) {
            results.push({
              task: t,
              matchedField: r.matched_field,
              snippet: r.snippet || '',
              rankScore: r.rank_score,
            });
          }
        }
        return results;
      }
    }
  } catch {
    // RPC not present yet, use client-side search below
  }

  // 2. Comprehensive client-side multi-table search across all task fields
  let clientQuery = supabase
    .from('tasks')
    .select(`
      *,
      task_attachments(count),
      task_notes(count)
    `)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (filterScope) {
    clientQuery = clientQuery.eq('scope', filterScope);
  }
  if (filterScope === 'workplace' && filterOrgId) {
    clientQuery = clientQuery.eq('org_id', filterOrgId);
  }

  const { data: rawTasks } = await clientQuery;

  if (!rawTasks || rawTasks.length === 0) return [];

  const tasks: Task[] = rawTasks.map((row: any) => ({
    ...row,
    attachments_count: row.task_attachments?.[0]?.count ?? 0,
    notes_count: row.task_notes?.[0]?.count ?? 0,
  }));

  const taskIds = tasks.map((t) => t.id);

  // Fetch notes, attachments metadata, history, subtasks, and organization sites for deep multi-entity search
  const [notesRes, attachmentsRes, historyRes, subtasksRes, sitesRes] = await Promise.all([
    supabase.from('task_notes').select('task_id, note').in('task_id', taskIds),
    supabase.from('task_attachments').select('task_id, file_name, file_type').in('task_id', taskIds),
    supabase.from('task_status_history').select('task_id, remarks, old_status, new_status').in('task_id', taskIds),
    supabase.from('task_subtasks').select('task_id, title').in('task_id', taskIds),
    filterOrgId
      ? supabase.from('org_sites').select('id, name, code, address').eq('org_id', filterOrgId)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const notesByTask = new Map<string, string[]>();
  notesRes.data?.forEach((n: any) => {
    const list = notesByTask.get(n.task_id) || [];
    list.push(n.note);
    notesByTask.set(n.task_id, list);
  });

  const attachmentsByTask = new Map<string, { file_name: string; file_type?: string }[]>();
  attachmentsRes.data?.forEach((a: any) => {
    const list = attachmentsByTask.get(a.task_id) || [];
    list.push({ file_name: a.file_name, file_type: a.file_type });
    attachmentsByTask.set(a.task_id, list);
  });

  const historyByTask = new Map<string, string[]>();
  historyRes.data?.forEach((h: any) => {
    const list = historyByTask.get(h.task_id) || [];
    if (h.remarks) list.push(h.remarks);
    if (h.new_status) list.push(h.new_status);
    if (h.old_status) list.push(h.old_status);
    historyByTask.set(h.task_id, list);
  });

  const subtasksByTask = new Map<string, string[]>();
  subtasksRes.data?.forEach((st: any) => {
    const list = subtasksByTask.get(st.task_id) || [];
    list.push(st.title);
    subtasksByTask.set(st.task_id, list);
  });

  const sitesById = new Map<string, { name: string; code: string; address?: string }>();
  sitesRes.data?.forEach((s: any) => {
    sitesById.set(s.id, { name: s.name, code: s.code, address: s.address });
  });

  const words = cleanQ.split(/\s+/).filter(Boolean);
  const results: UniversalSearchResult[] = [];

  for (const t of tasks) {
    const titleLower = t.title.toLowerCase();
    const descLower = (t.description || '').toLowerCase();
    const personLower = (t.person_name || '').toLowerCase();
    const assignedLower = (t.assigned_to_name || '').toLowerCase();
    const statusLower = t.status.toLowerCase();
    const priorityLower = t.priority.toLowerCase();
    const idLower = t.id.toLowerCase();
    const taskNotes = notesByTask.get(t.id) || [];
    const taskAttachments = attachmentsByTask.get(t.id) || [];
    const taskHistory = historyByTask.get(t.id) || [];
    const taskSubtasks = subtasksByTask.get(t.id) || [];
    const site = t.site_id ? sitesById.get(t.site_id) : undefined;
    const siteNameLower = (site?.name || '').toLowerCase();
    const siteCodeLower = (site?.code || '').toLowerCase();

    // 1. Exact task title
    if (titleLower === cleanQ) {
      results.push({ task: t, matchedField: 'title_exact', snippet: t.title, rankScore: 1 });
      continue;
    }

    // 2. Partial task title (or all words match in title)
    if (titleLower.includes(cleanQ) || (words.length > 1 && words.every((w) => titleLower.includes(w)))) {
      results.push({ task: t, matchedField: 'title', snippet: t.title, rankScore: 2 });
      continue;
    }

    // 3. Task ID / Code match (numbers or UUID part)
    if (idLower.includes(cleanQ) || t.id.slice(0, 8).toLowerCase() === cleanQ.replace('#', '')) {
      results.push({
        task: t,
        matchedField: 'id',
        snippet: `Task #${t.id.slice(0, 8)} • ${t.title}`,
        rankScore: 2.2,
      });
      continue;
    }

    // 4. Site Name or Site Code match (e.g. "18 B", "VTR")
    if (
      site &&
      (siteNameLower.includes(cleanQ) ||
        siteCodeLower.includes(cleanQ) ||
        (words.length > 1 && words.every((w) => siteNameLower.includes(w) || siteCodeLower.includes(w))))
    ) {
      results.push({
        task: t,
        matchedField: 'site',
        snippet: `Site: ${site.name} (${site.code}) • ${t.title}`,
        rankScore: 2.5,
      });
      continue;
    }

    // 5. Subtask / Checklist item match
    const matchingSubtask = taskSubtasks.find(
      (st) => st.toLowerCase().includes(cleanQ) || (words.length > 1 && words.every((w) => st.toLowerCase().includes(w)))
    );
    if (matchingSubtask) {
      results.push({
        task: t,
        matchedField: 'subtask',
        snippet: `Checklist item: ${matchingSubtask}`,
        rankScore: 3,
      });
      continue;
    }

    // 6. Description match
    if (descLower.includes(cleanQ) || (words.length > 1 && words.every((w) => descLower.includes(w)))) {
      results.push({
        task: t,
        matchedField: 'description',
        snippet: t.description?.slice(0, 120) || '',
        rankScore: 3.5,
      });
      continue;
    }

    // 7. Notes & Remarks match
    const matchingNote = taskNotes.find(
      (n) => n.toLowerCase().includes(cleanQ) || (words.length > 1 && words.every((w) => n.toLowerCase().includes(w)))
    );
    if (matchingNote) {
      results.push({
        task: t,
        matchedField: 'note',
        snippet: matchingNote.slice(0, 120),
        rankScore: 4,
      });
      continue;
    }

    // 8. Person / Assignee match
    if (
      personLower.includes(cleanQ) ||
      assignedLower.includes(cleanQ) ||
      (words.length > 1 && words.every((w) => personLower.includes(w) || assignedLower.includes(w)))
    ) {
      const contactInfo = [t.person_name, t.assigned_to_name ? `Assigned: ${t.assigned_to_name}` : ''].filter(Boolean).join(' • ');
      results.push({
        task: t,
        matchedField: 'person',
        snippet: contactInfo || t.person_name || '',
        rankScore: 4.5,
      });
      continue;
    }

    // 9. Status / Priority match
    if (statusLower.includes(cleanQ) || priorityLower.includes(cleanQ)) {
      results.push({
        task: t,
        matchedField: 'status_priority',
        snippet: `Status: ${t.status.toUpperCase()} | Priority: ${t.priority.toUpperCase()}`,
        rankScore: 5,
      });
      continue;
    }

    // 10. History match
    const matchingHist = taskHistory.find(
      (h) => h.toLowerCase().includes(cleanQ) || (words.length > 1 && words.every((w) => h.toLowerCase().includes(w)))
    );
    if (matchingHist) {
      results.push({
        task: t,
        matchedField: 'status_history',
        snippet: matchingHist.slice(0, 120),
        rankScore: 6,
      });
      continue;
    }

    // 11. Attachment filename / metadata match (STRICTLY NO PDF / FILE CONTENT SEARCH)
    const matchingAttach = taskAttachments.find(
      (a) =>
        a.file_name.toLowerCase().includes(cleanQ) ||
        (words.length > 1 && words.every((w) => a.file_name.toLowerCase().includes(w))) ||
        (a.file_type && a.file_type.toLowerCase().includes(cleanQ))
    );
    if (matchingAttach) {
      results.push({
        task: t,
        matchedField: 'attachment',
        snippet: `Attachment: ${matchingAttach.file_name}`,
        rankScore: 7,
      });
      continue;
    }
  }

  // Sort by rankScore ascending, then created_at descending
  results.sort((a, b) => {
    if (a.rankScore !== b.rankScore) return a.rankScore - b.rankScore;
    return new Date(b.task.created_at).getTime() - new Date(a.task.created_at).getTime();
  });

  return results;
};

// ------------------------------------------------------------------------------
// Enterprise Task Assignments & Directory Services
// ------------------------------------------------------------------------------

export const getTaskAssignments = async (taskId: string): Promise<TaskAssignment[]> => {
  const { data, error } = await supabase
    .from('task_assignments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching task assignments:', error);
    return [];
  }
  return (data as TaskAssignment[]) || [];
};

export const assignTask = async (
  taskId: string,
  params: {
    orgId: string;
    assignedTo?: string | null;
    assignedEmployeeId?: string | null;
    assignedToName?: string | null;
    remark?: string;
  }
): Promise<void> => {
  // Update assignment and audit fields
  await updateTask(taskId, {
    scope: 'workplace',
    org_id: params.orgId,
    assigned_to: params.assignedTo || null,
    assigned_employee_id: params.assignedEmployeeId || null,
    person_name: params.assignedToName || undefined,
    // Audit columns for reassignment
    reassigned_by: params.remark ? params.remark : undefined,
    reassigned_at: new Date().toISOString(),
  });

  // Record into task_assignments table for explicit history trail
  try {
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;
    if (currentUserId) {
      await supabase.from('task_assignments').insert({
        task_id: taskId,
        org_id: params.orgId,
        assigned_by: currentUserId,
        assigned_to: params.assignedTo || null,
        assigned_employee_id: params.assignedEmployeeId || null,
        assigned_to_name: params.assignedToName || null,
        remark: params.remark || null,
        status: 'assigned',
      });
    }
  } catch (asgnErr) {
    console.warn('Direct task_assignments insert fallback:', asgnErr);
  }

  // If remark provided, also save as note for full transparency
  if (params.remark && params.remark.trim()) {
    try {
      const { addNote } = await import('./notesService');
      const author = params.assignedToName ? `Handover to ${params.assignedToName}` : 'Task Assignment';
      await addNote(taskId, `📌 [Action Required] ${params.remark.trim()}`, author);
    } catch {
      // non-blocking
    }
  }

  // Send targeted notification to new assignee
  try {
    const task = await getTaskById(taskId);
    if (params.assignedTo) {
      const { createInAppNotification } = await import('./notificationInboxService');
      const { data: authData } = await supabase.auth.getUser();
      const assignerName = authData?.user?.user_metadata?.display_name || authData?.user?.email || 'व्यवस्थापक (Admin)';
      await createInAppNotification({
        recipient_user_id: params.assignedTo,
        organization_id: params.orgId,
        type: 'task_assigned',
        title: 'नवीन टास्क नियुक्त केला (New Task Assigned)',
        message: `${assignerName} ने तुम्हाला "${task ? task.title : 'Task'}" हा टास्क सोपवला आहे.${params.remark ? ` सूचना: "${params.remark.trim()}"` : ''}`,
        entity_type: 'task',
        entity_id: taskId,
      });
    }

    if (task && task.assigned_to) {
      const assignedTarget = task.assigned_to;
      await import('./notificationService').then(async (mod) => {
        await mod.notifyTaskReassigned(task, assignedTarget);
      });
    }
  } catch (e) {
    console.warn('Notification after reassignment failed:', e);
  }
};

export const getOrgEmployees = async (orgId: string): Promise<ErpEmployee[]> => {
  const { data, error } = await supabase
    .from('erp_employees')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .order('first_name', { ascending: true });

  if (error) {
    console.error('Error fetching org employees:', error);
    return [];
  }
  return (data as ErpEmployee[]) || [];
};

export const quickCreateEmployee = async (
  orgId: string,
  name: string,
  designation: string = 'Team Member',
  phone?: string,
  email?: string
): Promise<ErpEmployee> => {
  const parts = name.trim().split(' ');
  const firstName = parts[0] || 'Employee';
  const lastName = parts.slice(1).join(' ') || '';
  const employeeCode = `EMP-${Date.now().toString().slice(-4)}`;

  const { data, error } = await supabase
    .from('erp_employees')
    .insert({
      org_id: orgId,
      first_name: firstName,
      last_name: lastName,
      employee_code: employeeCode,
      designation: designation,
      phone: phone || null,
      email: email || null,
      status: 'active',
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Error creating employee:', error);
    throw new Error('Could not create employee.');
  }

  return data as ErpEmployee;
};

