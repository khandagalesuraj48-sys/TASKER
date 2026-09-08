import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnterprise } from '../context/EnterpriseContext';
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
} from 'lucide-react';

export const OrgPendingTasksPage: React.FC = () => {
  const navigate = useNavigate();
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

  // If user only has 1 site, lock to it; otherwise default to 'all' or selectedSite?.id
  const [activeSiteFilter, setActiveSiteFilter] = useState<string>(() => {
    if (sites.length === 1) return sites[0].id;
    return selectedSite?.id || 'all';
  });

  // Sync when sites load or change
  useEffect(() => {
    if (sites.length === 1) {
      setActiveSiteFilter(sites[0].id);
    } else if (selectedSite?.id && sites.some((s) => s.id === selectedSite.id)) {
      setActiveSiteFilter(selectedSite.id);
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
      showToast('प्रलंबित कामे लोड करताना त्रुटी आली.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPendingTasks();
  }, [currentOrg?.id, isMember, refreshKey]);

  // Strict Site-Wise Pending Tasks Filter
  const pendingTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.is_deleted) return false;

      // 1. MUST BE PENDING ONLY (NOT COMPLETED)
      if (t.status === 'completed') return false;

      // 2. Strict User Site Assignment Access:
      // Regular user cannot see any task outside their assigned sites
      if (!isAdmin && !isOwner && !isPlatformAdmin) {
        if (!t.site_id || !userAssignedSiteIds.includes(t.site_id)) {
          return false;
        }
      }

      // 3. Dropdown / Selected Site Filter
      if (activeSiteFilter !== 'all') {
        if (t.site_id !== activeSiteFilter) return false;
      }

      // 4. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchPerson = (t.person_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchPerson) return false;
      }

      return true;
    });
  }, [tasks, activeSiteFilter, searchQuery, userAssignedSiteIds, isAdmin, isOwner, isPlatformAdmin]);

  // Stats Counters for selected site
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

  // Selected site object
  const currentSelectedSite = sites.find((s) => s.id === activeSiteFilter);

  return (
    <div className="space-y-5 max-w-7xl mx-auto px-2 sm:px-4 py-3">
      {/* Top Header & Workplace Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="w-5 h-5" />
              </span>
              <span>साईटनिहाय प्रलंबित कामे (Site Pending Tasks)</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              {stats.total} कामे पेंडिंग
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {currentOrg?.legal_name} - कोणत्या साईटवर कोणाकडे काय काम प्रलंबित आहे याचा थेट आढावा
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/org/tasks')}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all active:scale-95"
          >
            सर्व कामे (All Tasks)
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
            <span>नवीन टास्क</span>
          </button>
        </div>
      </div>

      {/* 📍 SITE SELECTOR DROPDOWN BAR */}
      <div className="p-4 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-blue-500/10 dark:from-amber-950/30 dark:via-indigo-950/30 dark:to-blue-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 dark:text-slate-100 block">
                कार्य साईट निवडा (Work Site):
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {sites.length === 1
                  ? 'तुमची नियुक्त केलेली साईट'
                  : `${sites.length} साईट्स उपलब्ध`}
              </span>
            </div>
          </div>

          {/* If user has 1 site: show locked badge; If multiple: show dropdown */}
          {sites.length === 1 ? (
            <div className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border-2 border-amber-400 dark:border-amber-600 text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{sites[0].name}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono">
                {sites[0].code}
              </span>
            </div>
          ) : sites.length > 1 || isAdmin || isOwner || isPlatformAdmin ? (
            <div className="relative min-w-[220px]">
              <select
                value={activeSiteFilter}
                onChange={(e) => {
                  setActiveSiteFilter(e.target.value);
                  selectSite(e.target.value === 'all' ? null : e.target.value);
                }}
                className="w-full appearance-none px-4 py-2.5 pr-9 rounded-xl border-2 border-indigo-400 dark:border-indigo-600 bg-white dark:bg-slate-800 text-xs font-black text-slate-900 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                {(isAdmin || isOwner || isPlatformAdmin || sites.length > 1) && (
                  <option value="all">
                    🌐 सर्व नियुक्त साईट्स ({sites.length} Sites)
                  </option>
                )}
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    📍 {s.name} ({s.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-indigo-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <span className="text-xs text-rose-600 dark:text-rose-400 font-bold">
              ⚠️ तुम्हाला अद्याप कोणतीही साईट दिलेली नाही.
            </span>
          )}
        </div>

        {/* Quick Site Summary Badges */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-2xs">
            पेंडिंग कामे: <strong className="text-amber-600 dark:text-amber-400">{stats.total}</strong>
          </div>
          {stats.overdue > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-600 dark:text-rose-400 shadow-2xs">
              मुदत उलटली: <strong>{stats.overdue}</strong>
            </div>
          )}
          {stats.urgent > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs font-bold text-amber-700 dark:text-amber-300 shadow-2xs">
              तातडीची कामे: <strong>{stats.urgent}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
        <input
          type="text"
          placeholder="कामगार / व्यक्तीच्या नावाने किंवा कामाच्या नावाने शोधा (उदा. Rahul, प्लंबिंग)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs bg-transparent border-none text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-[11px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1"
          >
            साफ करा
          </button>
        )}
      </div>

      {/* PENDING TASKS LIST */}
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
        <div className="p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {currentSelectedSite ? `"${currentSelectedSite.name}" साईटवर कोणतेही पेंडिंग काम नाही!` : 'कोणतेही प्रलंबित काम नाही!'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            सर्व कामे वेळेवर पूर्ण झाली आहेत किंवा निवडलेल्या साईटवर अद्याप पेंडिंग कामे उपलब्ध नाहीत.
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
            <span>या साईटवर नवीन टास्क जोडा</span>
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
