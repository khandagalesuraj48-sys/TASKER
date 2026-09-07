import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../../types/task';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { formatDateTime, formatDateOnly, formatRelativePending, isTaskOverdue } from '../../lib/dateUtils';
import { ChangeStatusModal } from './ChangeStatusModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { softDeleteTask, restoreTask, permanentDeleteTask, canUserDeleteTask } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';
import { useTask } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import { useEnterprise } from '../../context/EnterpriseContext';
import {
  Clock,
  Calendar,
  User,
  Paperclip,
  MessageSquare,
  MoreVertical,
  Edit2,
  Trash2,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  isBin?: boolean;
  onEdit?: (task: Task) => void;
  onRefresh?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isBin = false,
  onEdit,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { triggerRefresh } = useTask();
  const { user } = useAuth();
  const { isPlatformAdmin } = useAdmin();
  const { isAdmin: isOrgAdmin, isOwner: isOrgOwner } = useEnterprise();

  const canDelete = canUserDeleteTask(task, user, isPlatformAdmin, isOrgAdmin || isOrgOwner);

  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [statusModalOpen, setStatusModalOpen] = useState<boolean>(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [permDeleteConfirmOpen, setPermDeleteConfirmOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const overdue = isTaskOverdue(task.due_date, task.status);

  const handleCardClick = (e: React.MouseEvent) => {
    // Avoid clicking if clicking action buttons
    if ((e.target as HTMLElement).closest('.no-card-click')) return;
    if (!isBin) {
      navigate(`/tasks/${task.id}`);
    }
  };

  const handleSoftDelete = async () => {
    setIsProcessing(true);
    try {
      await softDeleteTask(task.id);
      showToast(`Task "${task.title}" moved to Bin.`, 'info');
      triggerRefresh();
      onRefresh?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to move task to Bin.', 'error');
    } finally {
      setIsProcessing(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleRestore = async () => {
    setIsProcessing(true);
    try {
      await restoreTask(task.id);
      showToast(`Task "${task.title}" restored successfully.`, 'success');
      triggerRefresh();
      onRefresh?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to restore task.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async () => {
    setIsProcessing(true);
    try {
      await permanentDeleteTask(task.id);
      showToast(`Task "${task.title}" permanently deleted.`, 'info');
      triggerRefresh();
      onRefresh?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to permanently delete task.', 'error');
    } finally {
      setIsProcessing(false);
      setPermDeleteConfirmOpen(false);
    }
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className={`group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 transition-all shadow-sm hover:shadow-md dark:hover:shadow-slate-950/50 hover:border-blue-200 dark:hover:border-blue-900/50 ${
          isBin ? 'opacity-90 bg-slate-50/70 dark:bg-slate-900/40' : 'cursor-pointer'
        }`}
      >
        {/* Top Meta Header: Status, Overdue, Priority, Menu */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} isOverdue={overdue} size="sm" />
            <PriorityBadge priority={task.priority} size="sm" />
          </div>

          {/* Action Menu Button */}
          <div className="relative no-card-click shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-xl min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-9 z-20 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 shadow-xl text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              >
                {!isBin ? (
                  <>
                    <button
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      className="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Open Details</span>
                    </button>
                    <button
                      onClick={() => onEdit?.(task)}
                      className="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Edit Task</span>
                    </button>
                    <button
                      onClick={() => setStatusModalOpen(true)}
                      className="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Change Status</span>
                    </button>
                    {canDelete && (
                      <>
                        <div className="my-1 border-t border-slate-100 dark:border-slate-700/60" />
                        <button
                          onClick={() => setDeleteConfirmOpen(true)}
                          className="w-full px-3.5 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Move to Bin</span>
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleRestore}
                      className="w-full px-3.5 py-2 text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Restore Task</span>
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setPermDeleteConfirmOpen(true)}
                        className="w-full px-3.5 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Delete Permanently</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title and description */}
        <div className="mt-3">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {task.title}
          </h3>
          {task.status !== 'completed' && task.reassigned_by ? (
            <div className="mt-1 text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40 px-2 py-1 rounded-lg border border-blue-100 dark:border-blue-900/40 line-clamp-2">
              🎯 <strong>Next Action:</strong> {task.reassigned_by}
            </div>
          ) : task.description ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          ) : null}
        </div>

        {/* Clear Ownership & Status Banner */}
        {task.status === 'completed' ? (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>पूर्ण केले: {task.completed_by || task.person_name || 'Team Member'}</span>
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                (By: {task.created_by})
              </span>
            </div>
            {task.reassigned_by && (
              <p className="text-[11px] text-emerald-900 dark:text-emerald-200 font-medium bg-white/70 dark:bg-slate-900/50 p-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 line-clamp-2">
                📝 <strong>शेरा:</strong> "{task.reassigned_by}"
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5 min-w-0">
              <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="truncate">
                Pending with: <strong className="text-slate-800 dark:text-slate-200">{task.person_name || 'Unassigned'}</strong>
              </span>
            </div>
            {task.created_by && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                (By: {task.created_by})
              </span>
            )}
          </div>
        )}

        {/* Date Row: Due Date, Pending Since */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            {task.due_date ? (
              <span
                className={`flex items-center gap-1 font-medium ${
                  overdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span>Due: {formatDateOnly(task.due_date)}</span>
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 text-[11px]">No due date</span>
            )}

            {task.status === 'pending' && task.pending_since && (
              <span
                className="flex items-center gap-1 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded text-[11px]"
                title={`Pending since ${formatDateTime(task.pending_since)}`}
              >
                <Clock className="w-3 h-3 text-amber-500" />
                <span>Pending since: {formatRelativePending(task.pending_since)}</span>
              </span>
            )}
          </div>

          {/* Indicators: Attachments & Notes */}
          <div className="flex items-center gap-2.5 text-[11px] text-slate-400 dark:text-slate-500">
            {(task.attachments_count ?? 0) > 0 && (
              <span
                className="flex items-center gap-1 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md"
                title={`${task.attachments_count} attachments`}
              >
                <Paperclip className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                <span>{task.attachments_count}</span>
              </span>
            )}

            {(task.notes_count ?? 0) > 0 && (
              <span
                className="flex items-center gap-1 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md"
                title={`${task.notes_count} notes`}
              >
                <MessageSquare className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                <span>{task.notes_count}</span>
              </span>
            )}
          </div>
        </div>

        {/* Completion Info if Completed */}
        {task.status === 'completed' && task.completed_at && (
          <div className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between">
            <span>Completed on: {formatDateTime(task.completed_at)}</span>
            <span>By: <strong>{task.completed_by || 'User'}</strong></span>
          </div>
        )}
      </div>

      {/* Change Status Modal */}
      {statusModalOpen && (
        <ChangeStatusModal
          task={task}
          isOpen={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          onStatusChanged={() => onRefresh?.()}
        />
      )}

      {/* Move to Bin Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleSoftDelete}
        title="Move Task to Bin"
        message={`Are you sure you want to delete "${task.title}"? It will be moved to the Bin where you can restore it anytime.`}
        confirmText="Move to Bin"
        variant="warning"
        isLoading={isProcessing}
      />

      {/* Permanent Delete Confirmation */}
      <ConfirmDialog
        isOpen={permDeleteConfirmOpen}
        onClose={() => setPermDeleteConfirmOpen(false)}
        onConfirm={handlePermanentDelete}
        title="Delete Permanently"
        message="This will permanently delete the task and its attached files. This action cannot be undone."
        confirmText="Permanently Delete"
        variant="danger"
        isLoading={isProcessing}
      />
    </>
  );
};

