import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, CheckCircle2 } from 'lucide-react';
import { useTask } from '../context/TaskContext';
import { useEnterprise } from '../context/EnterpriseContext';
import { useAuth } from '../context/AuthContext';
import { getTasks } from '../services/taskService';
import { Task } from '../types/task';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { formatDateOnly, isTaskOverdue } from '../lib/dateUtils';

export const OrgAssignedTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrg, isMember } = useEnterprise();
  const { user } = useAuth();
  const { refreshKey } = useTask();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!currentOrg?.id || !isMember || !user?.id) {
      setIsLoading(false);
      return;
    }
    const fetchAssigned = async () => {
      setIsLoading(true);
      try {
        // Fetch workplace tasks assigned to current user
        const data = await getTasks({
          scope: 'workplace',
          orgId: currentOrg.id,
          assignedTo: user.id,
        });
        setTasks(data.filter((t) => !t.is_deleted));
      } catch (err) {
        console.error('Error fetching assigned tasks:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAssigned();
  }, [currentOrg?.id, isMember, user?.id, refreshKey]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      <div className="p-5 rounded-xl bg-card border border-border/80 shadow-2xs">
        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
          <UserCheck className="w-4 h-4" />
          <span>Pending With Me</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-1">
          My Assigned Tasks
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Workplace tasks assigned directly to you. Open any task to submit completion details or status updates.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-36 bg-muted rounded-xl"></div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border/80 p-8 space-y-2">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-bold text-foreground">All Clear! No Pending Assigned Tasks</h3>
          <p className="text-xs text-muted-foreground">
            You currently have no tasks assigned to you in {currentOrg?.legal_name || 'this organization'}.
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
                  <span>Assigned by: <strong className="text-foreground">{t.created_by}</strong></span>
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
