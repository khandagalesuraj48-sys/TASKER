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
import { CheckSquare2, LayoutGrid, List, Plus, CalendarRange } from 'lucide-react';
import { TaskGanttView } from '../components/tasks/TaskGanttView';

export const AllTasksPage: React.FC = () => {
  const { refreshKey, openCreateModal, globalSearch } = useTask();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'card' | 'table' | 'gantt'>('card');
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
        scope: 'personal',
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <CheckSquare2 className="w-5 h-5 text-primary" />
            <span>All Tasks Register</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complete database of work items across all status states and scopes
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-md border border-border bg-card p-0.5">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-sm transition-colors ${
                viewMode === 'card' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-sm transition-colors ${
                viewMode === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`p-1.5 rounded-sm transition-colors ${
                viewMode === 'gantt' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Interactive Gantt Timeline view"
            >
              <CalendarRange className="w-4 h-4" />
            </button>
          </div>

          <Button onClick={() => openCreateModal()} leftIcon={<Plus className="w-4 h-4" />} className="shadow-2xs">
            + Add Task
          </Button>
        </div>
      </div>

      {/* Scope Segmented Control */}
      <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-md border border-border max-w-md">
        <button
          onClick={() => setFilters((prev) => ({ ...prev, scope: undefined }))}
          className={`flex-1 py-1 px-3 rounded-sm text-xs font-medium transition-colors ${
            !filters.scope
              ? 'bg-background text-foreground font-semibold shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All Scopes
        </button>
        <button
          onClick={() => setFilters((prev) => ({ ...prev, scope: 'personal' }))}
          className={`flex-1 py-1 px-3 rounded-sm text-xs font-medium transition-colors ${
            filters.scope === 'personal'
              ? 'bg-background text-primary font-semibold shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Personal
        </button>
        <button
          onClick={() => setFilters((prev) => ({ ...prev, scope: 'workplace' }))}
          className={`flex-1 py-1 px-3 rounded-sm text-xs font-medium transition-colors ${
            filters.scope === 'workplace'
              ? 'bg-background text-workplace font-semibold shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Workplace
        </button>
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
      ) : viewMode === 'table' ? (
        <TaskTable
          tasks={tasks}
          onEdit={(t: Task) => setTaskToEdit(t)}
          onRefresh={loadAllTasks}
        />
      ) : (
        <TaskGanttView
          tasks={tasks}
          onTaskClick={(t: Task) => setTaskToEdit(t)}
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

