import React, { useEffect, useState } from 'react';
import { getTasks } from '../services/taskService';
import { Task } from '../types/task';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskTable } from '../components/tasks/TaskTable';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { EmptyState } from '../components/common/EmptyState';
import { CardSkeleton, TableSkeleton } from '../components/common/LoadingSkeleton';
import { useTask } from '../context/TaskContext';
import { CheckCircle2, LayoutGrid, List } from 'lucide-react';

export const CompletedTasksPage: React.FC = () => {
  const { refreshKey, globalSearch } = useTask();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  const loadCompletedTasks = async () => {
    setIsLoading(true);
    try {
      const data = await getTasks({
        status: 'completed',
        includeDeleted: false,
        scope: 'personal',
        search: globalSearch,
        sortBy: 'recently_updated',
      });
      setTasks(data);
    } catch (err) {
      console.error('Failed to load completed tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCompletedTasks();
  }, [refreshKey, globalSearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Completed Tasks</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Archived record of all successfully completed work with timestamps and accountability
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'card' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Task List */}
      {isLoading ? (
        viewMode === 'card' ? <CardSkeleton count={4} /> : <TableSkeleton rows={5} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-10 h-10 text-emerald-400" />}
          title="No completed tasks yet."
          description="Tasks marked as completed will be recorded here with full completion date, time, and actor history."
        />
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((task: Task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={(t: Task) => setTaskToEdit(t)}
              onRefresh={loadCompletedTasks}
            />
          ))}
        </div>
      ) : (
        <TaskTable
          tasks={tasks}
          onEdit={(t: Task) => setTaskToEdit(t)}
          onRefresh={loadCompletedTasks}
        />
      )}

      {/* Edit Task Modal */}
      {taskToEdit && (
        <TaskFormModal
          isOpen={Boolean(taskToEdit)}
          onClose={() => setTaskToEdit(null)}
          taskToEdit={taskToEdit}
          onSuccess={loadCompletedTasks}
        />
      )}
    </div>
  );
};

