import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../../types/task';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { formatDateTime, formatDateOnly, formatRelativePending, isTaskOverdue } from '../../lib/dateUtils';
import { ChangeStatusModal } from './ChangeStatusModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { softDeleteTask, restoreTask, permanentDeleteTask } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';
import { useTask } from '../../context/TaskContext';
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
        className={`group relative rounded-xl border border-slate-200 bg-white p-4 sm:p-5 transition-all shadow-2xs hover:shadow-md hover:border-blue-200 ${
          isBin ? 'opacity-90 bg-slate-50/70' : 'cursor-pointer'
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
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-7 z-20 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              >
                {!isBin ? (
                  <>
                    <button
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                      <span>Open Details</span>
                    </button>
                    <button
                      onClick={() => onEdit?.(task)}
                      className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit Task</span>
                    </button>
                    <button
                      onClick={() => setStatusModalOpen(true)}
                      className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Change Status</span>
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      onClick={() => setDeleteConfirmOpen(true)}
                      className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Move to Bin</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleRestore}
                      className="w-full px-3 py-2 text-left text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Restore Task</span>
                    </button>
                    <button
                      onClick={() => setPermDeleteConfirmOpen(true)}
                      className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Delete Permanently</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title and description */}
        <div className="mt-3">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">
            {task.title}
          </h3>
          {task.description && (
            <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* Person / Pending With */}
        {task.person_name && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              Pending with: <strong className="text-slate-800">{task.person_name}</strong>
            </span>
          </div>
        )}

        {/* Date Row: Due Date, Pending Since */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            {task.due_date ? (
              <span
                className={`flex items-center gap-1 font-medium ${
                  overdue ? 'text-rose-600 font-semibold' : 'text-slate-600'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Due: {formatDateOnly(task.due_date)}</span>
              </span>
            ) : (
              <span className="text-slate-400 text-[11px]">No due date</span>
            )}

            {task.status === 'pending' && task.pending_since && (
              <span
                className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px]"
                title={`Pending since ${formatDateTime(task.pending_since)}`}
              >
                <Clock className="w-3 h-3 text-amber-500" />
                <span>Pending since: {formatRelativePending(task.pending_since)}</span>
              </span>
            )}
          </div>

          {/* Indicators: Attachments & Notes */}
          <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
            {(task.attachments_count ?? 0) > 0 && (
              <span
                className="flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded"
                title={`${task.attachments_count} attachments`}
              >
                <Paperclip className="w-3 h-3 text-slate-500" />
                <span>{task.attachments_count}</span>
              </span>
            )}

            {(task.notes_count ?? 0) > 0 && (
              <span
                className="flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded"
                title={`${task.notes_count} notes`}
              >
                <MessageSquare className="w-3 h-3 text-slate-500" />
                <span>{task.notes_count}</span>
              </span>
            )}
          </div>
        </div>

        {/* Completion Info if Completed */}
        {task.status === 'completed' && task.completed_at && (
          <div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50/70 px-2.5 py-1 rounded border border-emerald-100 flex items-center justify-between">
            <span>Completed on: {formatDateTime(task.completed_at)}</span>
            <span>By: <strong>{task.completed_by || 'Pawan'}</strong></span>
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

