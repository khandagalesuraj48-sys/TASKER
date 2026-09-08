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
        // Filter tasks created by current user and not deleted
        setTasks(data.filter((t) => t.user_id === user.id && !t.is_deleted));
      } catch (err) {
        console.error('Error fetching created tasks:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCreated();
  }, [currentOrg?.id, isMember, user?.id, refreshKey]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-card border border-border/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Send className="w-4 h-4" />
            <span>Delegated Work</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-1">
            Tasks Created by Me
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
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
            <div key={n} className="h-36 bg-muted rounded-xl"></div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border/80 p-8 space-y-2">
          <Send className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h3 className="text-sm font-bold text-foreground">No Workplace Tasks Created</h3>
          <p className="text-xs text-muted-foreground">
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
                onClick={() => navigate(`/org/tasks/${t.id}`)}
                className="group cursor-pointer p-5 rounded-xl border border-border/80 bg-card hover:border-primary/50 transition-all shadow-2xs hover:shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={t.status} isOverdue={overdue} size="sm" />
                  <PriorityBadge priority={t.priority} size="sm" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{t.title}</h3>
                  {t.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.description}</p>
                  )}
                </div>
                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>Assigned to: <strong className="text-foreground">{t.person_name || 'Unassigned'}</strong></span>
                  </div>
                  {t.due_date && (
                    <span className={overdue ? 'text-destructive font-bold' : ''}>
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
