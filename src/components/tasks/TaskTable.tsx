import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../../types/task';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { formatDateOnly, formatRelativePending, isTaskOverdue } from '../../lib/dateUtils';
import { ChangeStatusModal } from './ChangeStatusModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { softDeleteTask, restoreTask, permanentDeleteTask, canUserDeleteTask } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';
import { useTask } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import { useEnterprise } from '../../context/EnterpriseContext';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import {
  MoreHorizontal,
  Edit2,
  Trash2,
  RotateCcw,
  CheckCircle2,
  Paperclip,
  MessageSquare,
  Eye,
  Building2,
  Calendar,
  Clock,
  User,
} from 'lucide-react';

interface TaskTableProps {
  tasks: Task[];
  isBin?: boolean;
  onEdit?: (task: Task) => void;
  onRefresh?: () => void;
}

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  isBin = false,
  onEdit,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { triggerRefresh } = useTask();
  const { user } = useAuth();
  const { isPlatformAdmin } = useAdmin();
  const { isAdmin: isOrgAdmin, isOwner: isOrgOwner, sites } = useEnterprise();

  const [activeTaskForStatus, setActiveTaskForStatus] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [taskToPermDelete, setTaskToPermDelete] = useState<Task | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const handleSoftDelete = async () => {
    if (!taskToDelete) return;
    setIsProcessing(true);
    try {
      await softDeleteTask(taskToDelete.id);
      showToast('Task moved to Bin.', 'info');
      triggerRefresh();
      onRefresh?.();
      setTaskToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Error moving to Bin', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async (task: Task) => {
    setIsProcessing(true);
    try {
      await restoreTask(task.id);
      showToast('Task restored successfully.', 'success');
      triggerRefresh();
      onRefresh?.();
    } catch (err: any) {
      showToast(err.message || 'Error restoring task', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!taskToPermDelete) return;
    setIsProcessing(true);
    try {
      await permanentDeleteTask(taskToPermDelete.id);
      showToast('Task permanently deleted.', 'info');
      triggerRefresh();
      onRefresh?.();
      setTaskToPermDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Error permanently deleting task', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-border bg-card text-card-foreground shadow-2xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Priority</th>
              <th className="py-2.5 px-3 min-w-[220px]">Task Description</th>
              <th className="py-2.5 px-3 min-w-[120px]">Assignee</th>
              <th className="py-2.5 px-3">Site</th>
              <th className="py-2.5 px-3 min-w-[100px]">Due Date</th>
              <th className="py-2.5 px-3">Pending</th>
              <th className="py-2.5 px-2 text-center">Files</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tasks.map((task) => {
              const overdue = isTaskOverdue(task.due_date, task.status);
              const taskSite = sites?.find((s) => s.id === task.site_id);
              const canDelete = canUserDeleteTask(task, user, isPlatformAdmin, isOrgAdmin || isOrgOwner);
              const isOpen = openActionId === task.id;

              return (
                <tr
                  key={task.id}
                  onClick={() => !isBin && navigate(`/tasks/${task.id}`)}
                  className={cn(
                    'hover:bg-muted/40 transition-colors group cursor-pointer',
                    isBin && 'opacity-80 cursor-default'
                  )}
                >
                  {/* Status */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <StatusBadge status={task.status} isOverdue={overdue} size="sm" />
                  </td>

                  {/* Priority */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <PriorityBadge priority={task.priority} size="sm" />
                  </td>

                  {/* Title & Description */}
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors truncate max-w-sm">
                      {task.title}
                    </div>
                    {task.description && (
                      <div className="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5">
                        {task.description}
                      </div>
                    )}
                  </td>

                  {/* Assignee */}
                  <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                    {task.person_name ? (
                      <span className="font-medium text-foreground flex items-center gap-1">
                        <User className="w-3 h-3 text-muted-foreground/70" />
                        <span className="truncate max-w-[110px]">{task.person_name}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 italic">Unassigned</span>
                    )}
                  </td>

                  {/* Site */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {taskSite ? (
                      <Badge variant="workplace" size="sm" className="font-medium">
                        <Building2 className="w-3 h-3 mr-1 shrink-0" />
                        <span className="truncate max-w-[90px]">{taskSite.name}</span>
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/50 text-[11px]">—</span>
                    )}
                  </td>

                  {/* Due Date */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {task.due_date ? (
                      <span
                        className={cn(
                          'flex items-center gap-1 font-medium text-[11px]',
                          overdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
                        )}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>{formatDateOnly(task.due_date)}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-[11px]">—</span>
                    )}
                  </td>

                  {/* Pending Duration */}
                  <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-[11px]">
                    {task.status === 'pending' && task.pending_since ? (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativePending(task.pending_since)}</span>
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </td>

                  {/* Attachments / Notes counts */}
                  <td className="py-2.5 px-2 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-[11px]">
                      {(task.attachments_count ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5" title={`${task.attachments_count} attachments`}>
                          <Paperclip className="w-3 h-3" />
                          <span>{task.attachments_count}</span>
                        </span>
                      )}
                      {(task.notes_count ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5" title={`${task.notes_count} notes`}>
                          <MessageSquare className="w-3 h-3" />
                          <span>{task.notes_count}</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Actions Dropdown */}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={() => setOpenActionId(isOpen ? null : task.id)}
                        className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="More"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {isOpen && (
                        <div
                          className="absolute right-0 top-7 z-20 w-44 rounded-md border border-border bg-card p-1 shadow-lg text-xs"
                          onClick={() => setOpenActionId(null)}
                        >
                          {!isBin ? (
                            <>
                              <button
                                onClick={() => navigate(`/tasks/${task.id}`)}
                                className="w-full px-2.5 py-1.5 text-left text-foreground hover:bg-muted rounded-sm flex items-center gap-2"
                              >
                                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>View Details</span>
                              </button>
                              <button
                                onClick={() => onEdit?.(task)}
                                className="w-full px-2.5 py-1.5 text-left text-foreground hover:bg-muted rounded-sm flex items-center gap-2"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>Edit Task</span>
                              </button>
                              <button
                                onClick={() => setActiveTaskForStatus(task)}
                                className="w-full px-2.5 py-1.5 text-left text-foreground hover:bg-muted rounded-sm flex items-center gap-2"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                                <span>Change Status</span>
                              </button>
                              {canDelete && (
                                <>
                                  <div className="my-1 border-t border-border" />
                                  <button
                                    onClick={() => setTaskToDelete(task)}
                                    className="w-full px-2.5 py-1.5 text-left text-destructive hover:bg-destructive/10 rounded-sm flex items-center gap-2"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Move to Bin</span>
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleRestore(task)}
                                className="w-full px-2.5 py-1.5 text-left text-emerald-600 hover:bg-emerald-500/10 rounded-sm flex items-center gap-2"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Restore Task</span>
                              </button>
                              {canDelete && (
                                <button
                                  onClick={() => setTaskToPermDelete(task)}
                                  className="w-full px-2.5 py-1.5 text-left text-destructive hover:bg-destructive/10 rounded-sm flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete Permanently</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Change Status Modal */}
      {activeTaskForStatus && (
        <ChangeStatusModal
          isOpen={Boolean(activeTaskForStatus)}
          onClose={() => setActiveTaskForStatus(null)}
          task={activeTaskForStatus}
          onStatusChanged={() => {
            triggerRefresh();
            onRefresh?.();
          }}
        />
      )}

      {/* Move to Bin Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(taskToDelete)}
        title="Move Task to Bin?"
        message={`Are you sure you want to move "${taskToDelete?.title}" to the Recycle Bin?`}
        confirmText="Move to Bin"
        variant="danger"
        isLoading={isProcessing}
        onConfirm={handleSoftDelete}
        onClose={() => setTaskToDelete(null)}
      />

      {/* Permanent Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(taskToPermDelete)}
        title="Permanently Delete Task?"
        message={`This will permanently delete "${taskToPermDelete?.title}". This cannot be undone.`}
        confirmText="Delete Forever"
        variant="danger"
        isLoading={isProcessing}
        onConfirm={handlePermanentDelete}
        onClose={() => setTaskToPermDelete(null)}
      />
    </>
  );
};
