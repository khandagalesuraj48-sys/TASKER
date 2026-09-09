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
import { TaskTable } from '../components/tasks/TaskTable';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { isTaskOverdue } from '../lib/dateUtils';
import { cn } from '@/lib/utils';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
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
  LayoutGrid,
  List,
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
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

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
      if (t.is_deleted) return false;
      if (t.status === 'completed' || t.status === 'cancelled') return false;

      // Delegated Subtasks Rule:
      // A delegated subtask (parent_task_id != null) should ONLY be visible in pending view to the user assigned to it.
      // The creator/manager tracks it inside the Main Task on the operations board.
      if (t.parent_task_id && t.assigned_to !== user?.id) return false;

      // User Site Assignment Access
      if (!isAdmin && !isOwner && !isPlatformAdmin) {
        const isAssignedToUser = t.assigned_to === user?.id;
        const isSiteAssigned = t.site_id ? userAssignedSiteIds.includes(t.site_id) : true;
        if (!isAssignedToUser && !isSiteAssigned) return false;
      }

      // Filter by selected site dropdown
      if (activeSiteFilter !== 'all') {
        if (t.site_id !== activeSiteFilter) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q) || false;
        const matchesPerson = t.person_name?.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesDesc && !matchesPerson) return false;
      }

      return true;
    });
  }, [tasks, activeSiteFilter, searchQuery, isAdmin, isOwner, isPlatformAdmin, user?.id, userAssignedSiteIds]);

  // Stats calculation for pending list
  const stats = useMemo(() => {
    let urgent = 0;
    let overdue = 0;
    for (const t of pendingTasks) {
      if (t.priority === 'urgent' || t.priority === 'high') urgent++;
      if (isTaskOverdue(t.due_date, t.status)) overdue++;
    }
    return {
      total: pendingTasks.length,
      urgent,
      overdue,
    };
  }, [pendingTasks]);

  const currentSelectedSite = sites.find((s) => s.id === activeSiteFilter);

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-1 sm:px-2 py-2">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-md bg-card text-card-foreground border border-border shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-sm bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">
              Pending Tasks by Site
            </h1>
            <Badge variant="warning" size="sm">
              {stats.total} Pending
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {currentOrg?.legal_name} • All Site Pending Tasks (View-only for site members; Edit reserved for creator & assignee)
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center rounded-md border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={cn(
                'p-1.5 rounded-sm transition-colors text-xs',
                viewMode === 'card' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Card view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'p-1.5 rounded-sm transition-colors text-xs',
                viewMode === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Table view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/org/tasks')}
          >
            All Tasks
          </Button>
          <Button
            variant="workplace"
            size="sm"
            onClick={() =>
              openCreateModal({
                scope: 'workplace',
                org_id: currentOrg?.id,
                site_id: activeSiteFilter !== 'all' ? activeSiteFilter : sites[0]?.id,
              })
            }
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>New Task</span>
          </Button>
        </div>
      </div>

      {/* Workplace Navigation Toggle Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => navigate('/org/tasks')}
          className="px-3 py-1.5 rounded-sm text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1.5 transition-colors"
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>All Tasks</span>
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded-sm text-xs font-semibold bg-workplace text-white shadow-2xs flex items-center gap-1.5"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending by Site</span>
        </button>
      </div>

      {/* Site Selector Bar */}
      <div className="p-3 bg-muted/40 rounded-md border border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
            <MapPin className="w-3.5 h-3.5 text-workplace" />
            <span>Site Filter:</span>
          </div>

          {/* Single Site Badge or Multi-Site Dropdown */}
          {sites.length === 1 && !isAdmin && !isOwner && !isPlatformAdmin ? (
            <div className="px-2.5 py-1 rounded-sm bg-background border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{sites[0].name}</span>
              <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground font-mono">
                {sites[0].code}
              </span>
            </div>
          ) : (
            <div className="relative min-w-[200px]">
              <select
                value={activeSiteFilter}
                onChange={(e) => {
                  setActiveSiteFilter(e.target.value);
                  selectSite(e.target.value === 'all' ? null : e.target.value);
                }}
                className="w-full appearance-none px-3 py-1.5 pr-8 rounded-sm border border-input bg-background text-xs font-medium text-foreground shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
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
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Quick KPI Counters */}
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-sm bg-background border border-border text-xs font-medium text-muted-foreground shadow-2xs">
            Total: <strong className="text-foreground">{stats.total}</strong>
          </div>
          {stats.urgent > 0 && (
            <div className="px-2.5 py-1 rounded-sm bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1 shadow-2xs">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Urgent: <strong>{stats.urgent}</strong></span>
            </div>
          )}
          {stats.overdue > 0 && (
            <div className="px-2.5 py-1 rounded-sm bg-destructive/15 border border-destructive/30 text-xs font-semibold text-destructive flex items-center gap-1 shadow-2xs">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <span>Overdue: <strong>{stats.overdue}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-md border border-border shadow-2xs">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search by task title, description, or assigned person..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs bg-transparent border-none text-foreground focus:outline-none placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-1.5"
          >
            Clear
          </button>
        )}
      </div>

      {/* Task Content: Grid or Table */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-40 rounded-md bg-muted" />
          ))}
        </div>
      ) : pendingTasks.length > 0 ? (
        viewMode === 'table' ? (
          <TaskTable
            tasks={pendingTasks}
            onEdit={(task) => setTaskToEdit(task)}
            onRefresh={loadPendingTasks}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onEdit={(task) => setTaskToEdit(task)}
                onRefresh={loadPendingTasks}
              />
            ))}
          </div>
        )
      ) : (
        <div className="p-8 text-center bg-card rounded-md border border-border space-y-2.5 shadow-2xs">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            {currentSelectedSite ? `All tasks completed for ${currentSelectedSite.name}` : 'No pending tasks'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            There are currently no incomplete tasks for this selection. All site work items are resolved.
          </p>
          <Button
            size="sm"
            onClick={() =>
              openCreateModal({
                scope: 'workplace',
                org_id: currentOrg?.id,
                site_id: activeSiteFilter !== 'all' ? activeSiteFilter : sites[0]?.id,
              })
            }
          >
            + Create New Task
          </Button>
        </div>
      )}

      {/* Edit Modal */}
      {taskToEdit && (
        <TaskFormModal
          isOpen={Boolean(taskToEdit)}
          onClose={() => setTaskToEdit(null)}
          taskToEdit={taskToEdit}
          onSuccess={loadPendingTasks}
        />
      )}
    </div>
  );
};
