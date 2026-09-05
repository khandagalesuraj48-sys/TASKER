import React, { useEffect, useState } from 'react';
import { getTasks } from '../services/taskService';
import { Task, TaskFilterOptions } from '../types/task';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskTable } from '../components/tasks/TaskTable';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { FilterPanel } from '../components/tasks/FilterPanel';
import { EmptyState } from '../components/common/EmptyState';
import { CardSkeleton, TableSkeleton } from '../components/common/LoadingSkeleton';
import { Button } from '../components/common/Button';
import { useTask } from '../context/TaskContext';
import { CheckSquare2, LayoutGrid, List, Plus } from 'lucide-react';

export const AllTasksPage: React.FC = () => {
  const { refreshKey, openCreateModal, globalSearch } = useTask();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  const [filters, setFilters] = useState<TaskFilterOptions>({
    status: 'all',
    priority: 'all',
    person: '',
    sortBy: 'newest',
    hasAttachments: false,
  });

  const loadAllTasks = async () => {
    setIsLoading(true);
    try {
      const data = await getTasks({
        ...filters,
        includeDeleted: false,
        search: globalSearch,
      });
      setTasks(data);
    } catch (err) {
      console.error('Failed to load all tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllTasks();
  }, [refreshKey, filters, globalSearch]);

  const handleResetFilters = () => {
    setFilters({
      status: 'all',
      priority: 'all',
      person: '',
      sortBy: 'newest',
      hasAttachments: false,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CheckSquare2 className="w-6 h-6 text-blue-600" />
            <span>All Tasks</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Complete list of all active work items across all status states
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md ${
                viewMode === 'card' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'
              }`}
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md ${
                viewMode === 'table' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'
              }`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <Button onClick={() => openCreateModal()} leftIcon={<Plus className="w-4 h-4" />}>
            + Add Task
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
      />

      {/* Task Content */}
      {isLoading ? (
        viewMode === 'card' ? <CardSkeleton count={4} /> : <TableSkeleton rows={5} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare2 className="w-10 h-10 text-slate-400" />}
          title="No tasks found"
          description="You haven't recorded any tasks matching the current criteria."
          actionText="+ Add First Task"
          onAction={() => openCreateModal()}
        />
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((task: Task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={(t: Task) => setTaskToEdit(t)}
              onRefresh={loadAllTasks}
            />
          ))}
        </div>
      ) : (
        <TaskTable
          tasks={tasks}
          onEdit={(t: Task) => setTaskToEdit(t)}
          onRefresh={loadAllTasks}
        />
      )}

      {/* Edit Task Modal */}
      {taskToEdit && (
        <TaskFormModal
          isOpen={Boolean(taskToEdit)}
          onClose={() => setTaskToEdit(null)}
          taskToEdit={taskToEdit}
          onSuccess={loadAllTasks}
        />
      )}
    </div>
  );
};

