import React, { useEffect, useState, useMemo } from 'react';
import { getTasks } from '../services/taskService';
import { Task } from '../types/task';
import { StatCard } from '../components/dashboard/StatCard';
import { PendingTodaySection, PendingTab } from '../components/dashboard/PendingTodaySection';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { EmptyState } from '../components/common/EmptyState';
import { CardSkeleton, StatsSkeleton } from '../components/common/LoadingSkeleton';
import { Button } from '../components/common/Button';
import { useTask } from '../context/TaskContext';
import { isTaskDueToday, isTaskOverdue, parseInTimezone } from '../lib/dateUtils';
import {
  Clock,
  PlayCircle,
  PieChart,
  CheckCircle2,
  AlertCircle,
  Plus,
  Sparkles,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { refreshKey, openCreateModal, globalSearch, stats } = useTask();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<PendingTab>('all');
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  const loadDashboardTasks = async () => {
    setIsLoading(true);
    try {
      const data = await getTasks({ includeDeleted: false });
      setTasks(data);
    } catch (err) {
      console.error('Failed to load dashboard tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardTasks();
  }, [refreshKey]);

  // Filter tasks for pending work only (Pending, In Progress, Partial)
  const pendingTasks = useMemo(() => {
    return tasks.filter((t: Task) => ['pending', 'in_progress', 'partial'].includes(t.status));
  }, [tasks]);

  // Tab counts
  const tabCounts = useMemo(() => {
    let dueToday = 0;
    let overdue = 0;
    let upcoming = 0;

    const now = new Date().getTime();

    for (const t of pendingTasks) {
      if (isTaskOverdue(t.due_date, t.status)) {
        overdue++;
      } else if (isTaskDueToday(t.due_date)) {
        dueToday++;
      } else if (t.due_date) {
        const d = parseInTimezone(t.due_date);
        if (d && d.getTime() > now) {
          upcoming++;
        }
      }
    }

    return {
      all: pendingTasks.length,
      dueToday,
      overdue,
      upcoming,
    };
  }, [pendingTasks]);

  // Filtered and Sorted list for the dashboard
  const displayTasks = useMemo(() => {
    let list = pendingTasks;

    // Filter by Tab
    if (activeTab === 'overdue') {
      list = list.filter((t: Task) => isTaskOverdue(t.due_date, t.status));
    } else if (activeTab === 'due_today') {
      list = list.filter((t: Task) => isTaskDueToday(t.due_date));
    } else if (activeTab === 'upcoming') {
      const now = new Date().getTime();
      list = list.filter((t: Task) => {
        if (!t.due_date || isTaskOverdue(t.due_date, t.status) || isTaskDueToday(t.due_date)) return false;
        const d = parseInTimezone(t.due_date);
        return d ? d.getTime() > now : false;
      });
    }

    // Global Search filter
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase().trim();
      list = list.filter(
        (t: Task) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.person_name && t.person_name.toLowerCase().includes(q))
      );
    }

    // Dashboard Priority Sorting
    return [...list].sort((a: Task, b: Task) => {
      const aOverdue = isTaskOverdue(a.due_date, a.status);
      const bOverdue = isTaskOverdue(b.due_date, b.status);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      const statusWeight: Record<string, number> = {
        pending: 1,
        partial: 2,
        in_progress: 3,
      };
      const aWeight = statusWeight[a.status] || 99;
      const bWeight = statusWeight[b.status] || 99;
      if (aWeight !== bWeight) return aWeight - bWeight;

      const priorityWeight: Record<string, number> = {
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      };
      const ap = priorityWeight[a.priority] || 99;
      const bp = priorityWeight[b.priority] || 99;
      if (ap !== bp) return ap - bp;

      return new Date(a.pending_since).getTime() - new Date(b.pending_since).getTime();
    });
  }, [pendingTasks, activeTab, globalSearch]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Add */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time pending work, status tracking, and attention priorities
          </p>
        </div>
        <Button
          onClick={() => openCreateModal()}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shadow-sm"
        >
          + Add Task
        </Button>
      </div>

      {/* Summary Stat Cards */}
      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard
            title="Pending"
            count={stats.pending}
            icon={<Clock className="w-5 h-5" />}
            colorScheme="amber"
          />
          <StatCard
            title="In Progress"
            count={stats.inProgress}
            icon={<PlayCircle className="w-5 h-5" />}
            colorScheme="blue"
          />
          <StatCard
            title="Partial"
            count={stats.partial}
            icon={<PieChart className="w-5 h-5" />}
            colorScheme="orange"
          />
          <StatCard
            title="Completed"
            count={stats.completed}
            icon={<CheckCircle2 className="w-5 h-5" />}
            colorScheme="emerald"
          />
          <StatCard
            title="Overdue"
            count={stats.overdue}
            icon={<AlertCircle className="w-5 h-5" />}
            colorScheme="rose"
            onClick={() => setActiveTab('overdue')}
            isActive={activeTab === 'overdue'}
          />
        </div>
      )}

      {/* Daily Pending Work Focus */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>My Pending Tasks</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                ({displayTasks.length} requiring attention)
              </span>
            </h3>
          </div>

          <PendingTodaySection
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={tabCounts}
          />
        </div>

        {/* Task Cards List */}
        {isLoading ? (
          <CardSkeleton count={4} />
        ) : displayTasks.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="w-10 h-10 text-emerald-500" />}
            title="🎉 No pending tasks"
            description={
              activeTab !== 'all'
                ? `There are no pending tasks under "${activeTab.replace('_', ' ')}".`
                : 'All your work items are completed or cancelled. Enjoy your day!'
            }
            actionText="+ Add New Task"
            onAction={() => openCreateModal()}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayTasks.map((task: Task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={(t: Task) => setTaskToEdit(t)}
                onRefresh={loadDashboardTasks}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Task Modal */}
      {taskToEdit && (
        <TaskFormModal
          isOpen={Boolean(taskToEdit)}
          onClose={() => setTaskToEdit(null)}
          taskToEdit={taskToEdit}
          onSuccess={loadDashboardTasks}
        />
      )}
    </div>
  );
};

