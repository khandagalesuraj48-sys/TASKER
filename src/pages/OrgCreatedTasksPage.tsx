import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, User, Plus } from 'lucide-react';
import { useTask } from '../context/TaskContext';
import { useEnterprise } from '../context/EnterpriseContext';
import { useAuth } from '../context/AuthContext';
import { getTasks } from '../services/taskService';
import { Task } from '../types/task';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { Button } from '../components/common/Button';
import { formatDateOnly, isTaskOverdue } from '../lib/dateUtils';

export const OrgCreatedTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrg, isMember } = useEnterprise();
  const { user } = useAuth();
  const { refreshKey, openCreateModal } = useTask();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!currentOrg?.id || !isMember || !user?.id) {
      setIsLoading(false);
      return;
    }
    const fetchCreated = async () => {
      setIsLoading(true);
      try {
        const data = await getTasks({
          scope: 'workplace',
          orgId: currentOrg.id,
        });
        // Filter tasks created by current user
        setTasks(data.filter((t) => t.user_id === user.id));
      } catch (err) {
        console.error('Error fetching created tasks:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCreated();
  }, [currentOrg?.id, isMember, user?.id, refreshKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
        <div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
            <Send className="w-4 h-4 text-blue-500" />
            <span>Delegated Work</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            Tasks Created by Me
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Workplace tasks you have assigned to team members. Monitor execution and reassign as needed.
          </p>
        </div>

        <Button
          onClick={() => openCreateModal({ scope: 'workplace', org_id: currentOrg?.id })}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Workplace Task
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-36 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-2">
          <Send className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Workplace Tasks Created</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Create a task and assign it to an employee from the directory.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((t) => {
            const overdue = isTaskOverdue(t.due_date, t.status);
            return (
              <div
                key={t.id}
                onClick={() => navigate(`/tasks/${t.id}`)}
                className="cursor-pointer p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={t.status} isOverdue={overdue} size="sm" />
                  <PriorityBadge priority={t.priority} size="sm" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.title}</h3>
                  {t.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{t.description}</p>
                  )}
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Assigned to: <strong className="text-slate-800 dark:text-slate-200">{t.person_name || 'Unassigned'}</strong></span>
                  </div>
                  {t.due_date && (
                    <span className={overdue ? 'text-rose-600 font-bold' : ''}>
                      Due: {formatDateOnly(t.due_date)}
                    </span>
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
