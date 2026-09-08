import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnterprise } from '../context/EnterpriseContext';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTask } from '../context/TaskContext';
import { useToast } from '../context/ToastContext';
import { getTasks } from '../services/taskService';
import { Task } from '../types/task';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { isTaskOverdue } from '../lib/dateUtils';
import {
  Clock,
  MapPin,
  Search,
  Plus,
  CheckCircle2,
  ChevronDown,
  Building2,
  AlertTriangle,
  Flame,
} from 'lucide-react';

export const OrgPendingTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    currentOrg,
    isMember,
    sites,
    selectedSite,
    selectSite,
    userAssignedSiteIds,
    isAdmin,
    isOwner,
  } = useEnterprise();
  const { isPlatformAdmin } = useAdmin();
  const { openCreateModal, refreshKey } = useTask();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  // Active site filter state
  const [activeSiteFilter, setActiveSiteFilter] = useState<string>(() => {
    if (selectedSite?.id) return selectedSite.id;
    if (sites.length === 1) return sites[0].id;
    return 'all';
  });

  // Keep in sync when sites load
  useEffect(() => {
    if (selectedSite?.id && sites.some((s) => s.id === selectedSite.id)) {
      setActiveSiteFilter(selectedSite.id);
    } else if (sites.length === 1) {
      setActiveSiteFilter(sites[0].id);
    }
  }, [sites, selectedSite]);

  // Load workplace tasks
  const loadPendingTasks = async () => {
    if (!currentOrg?.id || !isMember) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getTasks({
        scope: 'workplace',
        orgId: currentOrg.id,
        includeDeleted: false,
      });
      setTasks(data);
    } catch (err) {
      console.error('Error loading workplace pending tasks:', err);
      showToast('Unable to load pending tasks.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPendingTasks();
  }, [currentOrg?.id, isMember, refreshKey]);

  // Comprehensive Pending Tasks Filter
  const pendingTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Never show deleted tasks
      if (t.is_deleted) return false;

      // 2. Strict Pending Status Only (exclude completed / cancelled)
      if (t.status === 'completed' || t.status === 'cancelled') return false;

      // 3. User Site Assignment Access
      if (!isAdmin && !isOwner && !isPlatformAdmin) {
        const isAssignedToUser = t.assigned_to === user?.id;
        const isUserSite = t.site_id && userAssignedSiteIds.includes(t.site_id);
        const hasNoSiteRestrictions = userAssignedSiteIds.length === 0;

        // User can access if assigned to the task, or site matches user's sites, or user has no site restrictions
        if (!isAssignedToUser && !isUserSite && !hasNoSiteRestrictions) {
          return false;
        }
      }

      // 4. Site Filter Dropdown
      if (activeSiteFilter !== 'all') {
        if (t.site_id !== activeSiteFilter) return false;
      }

      // 5. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchPerson = (t.person_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchPerson) return false;
      }

      return true;
    });
  }, [tasks, activeSiteFilter, searchQuery, userAssignedSiteIds, isAdmin, isOwner, isPlatformAdmin, user?.id]);

  // Statistics Counters for Current View
  const stats = useMemo(() => {
    let overdueCount = 0;
    let urgentCount = 0;
    for (const t of pendingTasks) {
      if (isTaskOverdue(t.due_date, t.status)) overdueCount++;
      if (t.priority === 'urgent' || t.priority === 'high') urgentCount++;
    }
    return {
      total: pendingTasks.length,
      overdue: overdueCount,
      urgent: urgentCount,
    };
  }, [pendingTasks]);

  const currentSelectedSite = sites.find((s) => s.id === activeSiteFilter);

  return (
    <div className="space-y-5 max-w-7xl mx-auto px-2 sm:px-4 py-3">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
              Pending Tasks by Site
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              {stats.total} Pending
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {currentOrg?.legal_name} • Real-time job site backlog and pending delegation
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/org/tasks')}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all active:scale-95"
          >
            All Tasks
          </button>
          <button
            onClick={() =>
              openCreateModal({
                scope: 'workplace',
                org_id: currentOrg?.id,
                site_id: activeSiteFilter !== 'all' ? activeSiteFilter : sites[0]?.id,
              })
            }
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Workplace Navigation Toggle Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => navigate('/org/tasks')}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-2 transition-all cursor-pointer"
        >
          <Building2 className="w-4 h-4" />
          <span>All Tasks</span>
        </button>
        <button
          className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-xs flex items-center gap-2"
        >
          <Clock className="w-4 h-4 text-amber-300" />
          <span>Pending by Site</span>
        </button>
      </div>

      {/* Site Selector Bar */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
            <MapPin className="w-4 h-4 text-indigo-500" />
            <span>Site Filter:</span>
          </div>

          {/* Single Site Badge or Multi-Site Dropdown */}
          {sites.length === 1 && !isAdmin && !isOwner && !isPlatformAdmin ? (
            <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{sites[0].name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                {sites[0].code}
              </span>
            </div>
          ) : (
            <div className="relative min-w-[220px]">
              <select
                value={activeSiteFilter}
                onChange={(e) => {
                  setActiveSiteFilter(e.target.value);
                  selectSite(e.target.value === 'all' ? null : e.target.value);
                }}
                className="w-full appearance-none px-3.5 py-1.5 pr-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="all">
                  All Sites ({sites.length} total)
                </option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Quick KPI Counters */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-2xs">
            Total: <strong className="text-slate-900 dark:text-slate-100">{stats.total}</strong>
          </div>
          {stats.urgent > 0 && (
            <div className="px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1 shadow-2xs">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Urgent: <strong>{stats.urgent}</strong></span>
            </div>
          )}
          {stats.overdue > 0 && (
            <div className="px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1 shadow-2xs">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>Overdue: <strong>{stats.overdue}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1.5" />
        <input
          type="text"
          placeholder="Search by task title, description, or assigned person..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs bg-transparent border-none text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-0.5"
          >
            Clear
          </button>
        )}
      </div>

      {/* Task Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : pendingTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingTasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onEdit={(task) => setTaskToEdit(task)}
              onRefresh={loadPendingTasks}
            />
          ))}
        </div>
      ) : (
        <div className="p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {currentSelectedSite ? `All tasks completed for ${currentSelectedSite.name}` : 'No pending tasks'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            There are currently no incomplete tasks for this selection. All tasks are up to date.
          </p>
          <button
            onClick={() =>
              openCreateModal({
                scope: 'workplace',
                org_id: currentOrg?.id,
                site_id: activeSiteFilter !== 'all' ? activeSiteFilter : sites[0]?.id,
              })
            }
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      )}

      {/* Edit Task Modal */}
      {taskToEdit && (
        <TaskFormModal
          isOpen={Boolean(taskToEdit)}
          onClose={() => setTaskToEdit(null)}
          taskToEdit={taskToEdit}
          onSuccess={() => {
            setTaskToEdit(null);
            loadPendingTasks();
          }}
        />
      )}
    </div>
  );
};
