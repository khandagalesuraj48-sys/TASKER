import { TaskSubtask, TaskDependency } from '../types/task';
import { OfflineSyncService } from './offlineSyncService';

export const getSubtasks = async (taskId: string): Promise<TaskSubtask[]> => {
  const items = await OfflineSyncService.getItems<TaskSubtask>(
    'task_subtasks',
    (s) => s.task_id === taskId
  );
  return items.sort((a, b) => a.position - b.position);
};

export const addSubtask = async (taskId: string, title: string): Promise<TaskSubtask> => {
  const current = await getSubtasks(taskId);
  const newSubtask: TaskSubtask = {
    id: 'sub_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    task_id: taskId,
    title,
    is_completed: false,
    position: current.length,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return await OfflineSyncService.saveItem('task_subtasks', newSubtask);
};

export const toggleSubtask = async (subtaskId: string, isCompleted: boolean): Promise<TaskSubtask | null> => {
  return await OfflineSyncService.updateItem<TaskSubtask>('task_subtasks', subtaskId, {
    is_completed: isCompleted,
  });
};

export const deleteSubtask = async (subtaskId: string): Promise<boolean> => {
  return await OfflineSyncService.deleteItem<TaskSubtask>('task_subtasks', subtaskId);
};

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
