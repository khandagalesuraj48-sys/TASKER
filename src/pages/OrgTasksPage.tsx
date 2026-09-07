import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  User,
  Calendar,
  Send,
} from 'lucide-react';
import { useTask } from '../context/TaskContext';
import { useEnterprise } from '../context/EnterpriseContext';
import { useToast } from '../context/ToastContext';
import { getTasks } from '../services/taskService';
import { Task } from '../types/task';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { Button } from '../components/common/Button';
import { formatDateOnly, isTaskOverdue } from '../lib/dateUtils';

export const OrgTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrg, isMember, requestJoin, isJoining, hasRequestedJoin } = useEnterprise();
  const { openCreateModal, refreshKey } = useTask();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

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

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchPerson = (t.person_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchPerson) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, searchQuery]);

  const handleSendJoinRequest = async () => {
    try {
      await requestJoin();
      showToast('Join request sent to Organization Owner. Awaiting approval.', 'success');
    } catch {
      showToast('Failed to send join request.', 'error');
    }
  };

  if (!isMember) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
          <Building2 className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {currentOrg?.legal_name || 'SAMAJ RACHANA CONSTRUCTION LIMITED'}
          </h2>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider mt-1">
            Workplace Task Space
          </p>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
          Your Personal Task Space is completely private and active. To view and collaborate on Workplace Tasks in{' '}
          <strong>{currentOrg?.legal_name || 'this Organization'}</strong>, your account must be approved by the Organization Owner.
        </p>

        <div className="pt-2">
          {hasRequestedJoin ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-semibold">
              ⏳ Join request submitted. You will gain access once the Owner approves your account.
            </div>
          ) : (
            <Button
              onClick={handleSendJoinRequest}
              isLoading={isJoining}
              leftIcon={<Send className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Request to Join Organization
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-300" />
            <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Workplace Collaboration</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black">{currentOrg?.legal_name || 'Organization Tasks'}</h1>
          <p className="text-xs text-indigo-200/80">
            Assigned tasks, delegated work, and real-time team collaboration with strict multi-user privacy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => openCreateModal({ scope: 'workplace', org_id: currentOrg?.id })}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Workplace Task
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search workplace tasks or assignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Workplace Tasks Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all'
              ? 'No tasks match your current filters.'
              : 'Create a workplace task and assign it to a team member to begin collaborating.'}
          </p>
          <Button
            size="sm"
            onClick={() => openCreateModal({ scope: 'workplace', org_id: currentOrg?.id })}
            leftIcon={<Plus className="w-4 h-4" />}
            className="mt-2"
          >
            Create Task
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((t) => {
            const overdue = isTaskOverdue(t.due_date, t.status);
            return (
              <div
                key={t.id}
                onClick={() => navigate(`/tasks/${t.id}`)}
                className="group cursor-pointer p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={t.status} isOverdue={overdue} size="sm" />
                    <PriorityBadge priority={t.priority} size="sm" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {t.title}
                  </h3>
                  {t.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{t.description}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate font-semibold text-slate-700 dark:text-slate-300">
                      {t.person_name || 'Unassigned'}
                    </span>
                  </div>

                  {t.due_date && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className={overdue ? 'text-rose-600 font-bold' : ''}>
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
    </div>
  );
};
