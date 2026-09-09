import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  User,
  Calendar,
  Send,
  MapPin,
  X,
  Loader2,
  Trash2,
  Clock,
  LayoutGrid,
  CalendarRange,
} from 'lucide-react';
import { TaskGanttView } from '../components/tasks/TaskGanttView';
import { useTask } from '../context/TaskContext';
import { useEnterprise } from '../context/EnterpriseContext';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useToast } from '../context/ToastContext';
import { getTasks, softDeleteTask, canUserDeleteTask } from '../services/taskService';
import { createOrgSite } from '../services/enterpriseService';
import { Task } from '../types/task';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { Button } from '../components/common/Button';
import { formatDateOnly, isTaskOverdue } from '../lib/dateUtils';

export const OrgTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentOrg,
    isMember,
    requestJoin,
    isJoining,
    hasRequestedJoin,
    sites,
    selectedSite,
    selectSite,
    userAssignedSiteIds,
    isAdmin,
    isOwner,
    refreshSites,
  } = useEnterprise();
  const { user } = useAuth();
  const { isPlatformAdmin } = useAdmin();
  const { openCreateModal, refreshKey, triggerRefresh } = useTask();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'card' | 'gantt'>('card');

  // New Site Modal State
  const [isAddSiteOpen, setIsAddSiteOpen] = useState<boolean>(false);
  const [newSiteName, setNewSiteName] = useState<string>('');
  const [newSiteCode, setNewSiteCode] = useState<string>('');
  const [newSiteAddress, setNewSiteAddress] = useState<string>('');
  const [isCreatingSite, setIsCreatingSite] = useState<boolean>(false);

  useEffect(() => {
    if (!currentOrg?.id || !isMember) {
      setIsLoading(false);
      return;
    }
    const fetchOrgTasks = async () => {
      setIsLoading(true);
      try {
        const data = await getTasks({
          scope: 'workplace',
          orgId: currentOrg.id,
        });
        setTasks(data);
      } catch (err) {
        console.error('Error loading workplace tasks:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrgTasks();
  }, [currentOrg?.id, isMember, refreshKey]);

  const handleDeleteTask = async (e: React.MouseEvent, t: Task) => {
    e.stopPropagation();
    if (!window.confirm(`खरोखर "${t.title}" हा टास्क हटवायचा आहे का?`)) {
      return;
    }
    try {
      await softDeleteTask(t.id);
      showToast(`टास्क "${t.title}" हटवला आहे.`, 'info');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'टास्क हटवण्यात त्रुटी आली.', 'error');
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.is_deleted) return false;

      // Site Assignment Restriction: regular users ONLY see tasks for their assigned sites
      if (!isAdmin && !isOwner && !isPlatformAdmin) {
        if (!t.site_id || !userAssignedSiteIds.includes(t.site_id)) return false;
      }

      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (selectedSite && t.site_id !== selectedSite.id) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchPerson = (t.person_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchPerson) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, selectedSite, searchQuery, userAssignedSiteIds, isAdmin, isOwner, isPlatformAdmin]);

  const handleSendJoinRequest = async () => {
    try {
      await requestJoin();
      showToast('कार्यस्थळ प्रवेश विनंती पाठवली आहे. ॲडमिन मंजुरीची प्रतीक्षा आहे.', 'success');
    } catch {
      showToast('विनंती पाठवण्यात त्रुटी आली.', 'error');
    }
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg?.id || !newSiteName.trim()) {
      showToast('कृपया साईटचे नाव प्रविष्ट करा.', 'error');
      return;
    }
    setIsCreatingSite(true);
    try {
      const created = await createOrgSite(
        currentOrg.id,
        newSiteName.trim(),
        newSiteCode.trim() || newSiteName.trim().toUpperCase().replace(/\s+/g, '_'),
        newSiteAddress.trim()
      );
      if (created) {
        showToast(`'${created.name}' नवीन साईट तयार केली!`, 'success');
        await refreshSites();
        selectSite(created.id);
        setIsAddSiteOpen(false);
        setNewSiteName('');
        setNewSiteCode('');
        setNewSiteAddress('');
      } else {
        showToast('साईट्स तयार करण्यात त्रुटी आली.', 'error');
      }
    } catch {
      showToast('साईट्स तयार करण्यात त्रुटी आली.', 'error');
    } finally {
      setIsCreatingSite(false);
    }
  };

  // Neutral onboarding view when user does not have approved membership in any organization
  if (!isMember || !currentOrg) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-card rounded-2xl border border-border shadow-lg text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
          <Building2 className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {currentOrg?.legal_name || 'कार्यस्थळ कार्यक्षेत्र (Workplace Space)'}
          </h2>
          <p className="text-xs text-primary font-semibold uppercase tracking-wider mt-1">
            Enterprise & Multi-Site Tasks
          </p>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
          तुमचे वैयक्तिक टास्क स्पेस (Personal Space) नेहमीप्रमाणे सुरक्षित आणि सक्रिय आहे. कंपनी किंवा संस्थेच्या कार्यस्थळावर काम करण्यासाठी आणि सहकाऱ्यांसोबत जोडले जाण्यासाठी ॲडमिन मंजुरी आवश्यक आहे.
        </p>

        <div className="pt-2">
          {hasRequestedJoin ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 font-semibold space-y-1">
              <p>⏳ कार्यस्थळ प्रवेश विनंती पाठवली आहे.</p>
              <p className="text-[11px] font-normal text-amber-600 dark:text-amber-400">
                ॲडमिनने मंजुरी देऊन तुम्हाला संस्थेत आणि संबंधित साईटवर समाविष्ट केल्यावर तुम्हाला सर्व कामे दिसतील.
              </p>
            </div>
          ) : (
            <Button
              onClick={handleSendJoinRequest}
              isLoading={isJoining}
              leftIcon={<Send className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              कार्यस्थळ प्रवेशाची विनंती पाठवा (Request Workplace Access)
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Controls Bar: Navigation Tabs + Multi-Site Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border/80 shadow-2xs">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground shadow-xs flex items-center gap-1.5"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>All Tasks</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/org/pending')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted/90 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Pending by Site</span>
          </button>
        </div>

        {/* Multi-Site Switcher Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none w-full md:w-auto">
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground shrink-0 mr-1">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span>Sites:</span>
          </div>

          {(isAdmin || isOwner || isPlatformAdmin || sites.length > 1) && (
            <button
              type="button"
              onClick={() => selectSite('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                !selectedSite
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              All Sites
            </button>
          )}

          {sites.map((s) => {
            const isSelected = selectedSite?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSite(s.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span>{s.name}</span>
                <span
                  className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-background/80 text-muted-foreground'
                  }`}
                >
                  {s.code}
                </span>
              </button>
            );
          })}

          {!isAdmin && !isOwner && !isPlatformAdmin && sites.length === 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium px-2.5 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
              ⚠️ No sites assigned to your account.
            </span>
          )}

          {(isAdmin || isOwner) && (
            <button
              type="button"
              onClick={() => setIsAddSiteOpen(true)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors shrink-0 flex items-center gap-1 cursor-pointer ml-1"
              title="Add New Site"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Site</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3.5 rounded-xl border border-border/80 shadow-2xs">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search workplace tasks or assignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-input/80 bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-input/80 bg-background text-foreground font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-input/80 bg-background text-foreground font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-input/80 bg-muted/40 p-0.5 ml-auto">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'card'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'gantt'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Gantt Timeline view"
            >
              <CalendarRange className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-40 bg-muted rounded-xl"></div>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border/80 p-8 space-y-3">
          <Building2 className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h3 className="text-sm font-bold text-foreground">No Workplace Tasks Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all' || selectedSite
              ? 'No tasks match your current filters.'
              : 'Create a workplace task and assign it to a team member to begin collaborating.'}
          </p>
          <Button
            size="sm"
            onClick={() => openCreateModal({ scope: 'workplace', org_id: currentOrg?.id, site_id: selectedSite?.id })}
            leftIcon={<Plus className="w-4 h-4" />}
            className="mt-2"
          >
            Create Task
          </Button>
        </div>
      ) : viewMode === 'gantt' ? (
        <TaskGanttView
          tasks={filteredTasks}
          onTaskClick={(t) => navigate(`/org/tasks/${t.id}`)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((t) => {
            const overdue = isTaskOverdue(t.due_date, t.status);
            const taskSite = sites.find((s) => s.id === t.site_id);
            return (
              <div
                key={t.id}
                onClick={() => navigate(`/org/tasks/${t.id}`)}
                className="group cursor-pointer p-4 rounded-xl border border-border/80 bg-card hover:border-primary/50 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={t.status} isOverdue={overdue} size="sm" />
                      <PriorityBadge priority={t.priority} size="sm" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {taskSite && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                          📍 {taskSite.name}
                        </span>
                      )}
                      {canUserDeleteTask(t, user, isPlatformAdmin, isAdmin || isOwner) && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTask(e, t)}
                          title="टास्क हटवा (Delete Task)"
                          className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {t.title}
                  </h3>
                  {t.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate font-semibold text-foreground/90">
                      {t.person_name || 'Unassigned'}
                    </span>
                  </div>

                  {t.due_date && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className={overdue ? 'text-destructive font-bold' : ''}>
                        {formatDateOnly(t.due_date)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Site Modal */}
      {isAddSiteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card rounded-2xl border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  नवीन साईट तयार करा
                </h3>
              </div>
              <button
                onClick={() => setIsAddSiteOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSite} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider mb-1.5">
                  साईटचे नाव (Site Name) <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="उदा. VTR Site किंवा 18 B Site"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input/80 bg-background text-foreground text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider mb-1.5">
                  साईट कोड (Site Code)
                </label>
                <input
                  type="text"
                  placeholder="उदा. VTR किंवा 18_B"
                  value={newSiteCode}
                  onChange={(e) => setNewSiteCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input/80 bg-background text-foreground text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider mb-1.5">
                  पत्ता / लोकेशन (Address / Location)
                </label>
                <input
                  type="text"
                  placeholder="साईटचा पत्ता किंवा स्थान"
                  value={newSiteAddress}
                  onChange={(e) => setNewSiteAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input/80 bg-background text-foreground text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddSiteOpen(false)}
                >
                  रद्द करा
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isCreatingSite}
                  leftIcon={isCreatingSite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                >
                  साईट जोडा
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
