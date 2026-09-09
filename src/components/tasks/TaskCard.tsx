import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../../types/task';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { formatDateOnly, formatRelativePending, isTaskOverdue, formatDateTime } from '../../lib/dateUtils';
import { ChangeStatusModal } from './ChangeStatusModal';
import { QuickCompleteModal } from './QuickCompleteModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { softDeleteTask, restoreTask, permanentDeleteTask, canUserDeleteTask, canUserEditTask } from '../../services/taskService';
import { shareTaskOnWhatsApp, speakTaskDetails, stopSpeaking } from '../../utils/taskSharingUtils';
import { useToast } from '../../context/ToastContext';
import { useTask } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import { useEnterprise } from '../../context/EnterpriseContext';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
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
  Share2,
  Volume2,
  VolumeX,
  Building2,
  GitFork,
  ArrowRight,
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
  const { isAdmin: isOrgAdmin, isOwner: isOrgOwner, sites } = useEnterprise();

  const canDelete = canUserDeleteTask(task, user, isPlatformAdmin, isOrgAdmin || isOrgOwner);
  const canEdit = canUserEditTask(task, user, isPlatformAdmin, isOrgAdmin || isOrgOwner);

  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [statusModalOpen, setStatusModalOpen] = useState<boolean>(false);
  const [quickDoneOpen, setQuickDoneOpen] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [permDeleteConfirmOpen, setPermDeleteConfirmOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Resolve site name if assigned
  const taskSite = sites?.find((s) => s.id === task.site_id);
  const siteName = taskSite ? taskSite.name : undefined;

  const overdue = isTaskOverdue(task.due_date, task.status);

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-card-click')) return;
    if (!isBin) {
      navigate(`/tasks/${task.id}`);
    }
  };

  const handleToggleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      speakTaskDetails(task.title, task.description || undefined, siteName);
      setIsSpeaking(true);
      setTimeout(() => setIsSpeaking(false), 12000);
    }
  };

  const handleWhatsAppShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    shareTaskOnWhatsApp(task, siteName);
    showToast('WhatsApp message generated!', 'success');
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
        className={cn(
          'group relative rounded-md border border-border bg-card text-card-foreground p-3.5 sm:p-4 transition-all shadow-2xs hover:border-primary/40',
          'group relative rounded-xl border border-border bg-card text-card-foreground p-4 transition-all shadow-xs hover:shadow-md hover:border-primary/40',
          isBin ? 'opacity-85 bg-muted/30' : 'cursor-pointer'
        )}
      >
        {/* Top Header Row: Status, Overdue, Priority, Site, Menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={task.status} isOverdue={overdue} size="sm" />
            <PriorityBadge priority={task.priority} size="sm" />
            {siteName && (
              <Badge variant="workplace" size="sm" className="flex items-center gap-1">
                <Building2 className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[120px]">{siteName}</span>
              </Badge>
            )}
          </div>

          {/* Action Menu */}
          <div className="relative no-card-click shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
              aria-label="Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-7 z-20 w-44 rounded-md border border-border bg-card p-1 shadow-lg text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              >
                {!isBin ? (
                  <>
                    <button
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      className="w-full px-2.5 py-1.5 text-left text-foreground hover:bg-muted rounded-sm flex items-center gap-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Open Record</span>
                    </button>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => onEdit?.(task)}
                          className="w-full px-2.5 py-1.5 text-left text-foreground hover:bg-muted rounded-sm flex items-center gap-2"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Edit Task</span>
                        </button>
                        <button
                          onClick={() => setStatusModalOpen(true)}
                          className="w-full px-2.5 py-1.5 text-left text-foreground hover:bg-muted rounded-sm flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                          <span>Change Status</span>
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <>
                        <div className="my-1 border-t border-border" />
                        <button
                          onClick={() => setDeleteConfirmOpen(true)}
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
                      onClick={handleRestore}
                      className="w-full px-2.5 py-1.5 text-left text-emerald-600 hover:bg-emerald-500/10 rounded-sm flex items-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore Task</span>
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setPermDeleteConfirmOpen(true)}
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
        </div>

        {/* Title and Subtask Hierarchy */}
        <div className="mt-2.5">
          {(task.parent_task_id || task.custom_fields?.is_subtask) && (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.2 mb-1 rounded-sm text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <GitFork className="w-3 h-3" />
              <span>Subtask • {task.custom_fields?.parent_task_title || 'Action Item'}</span>
            </div>
          )}
          <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
            {task.title}
          </h3>
          {task.status !== 'completed' && task.reassigned_by ? (
            <div className="mt-1 text-[11px] text-primary font-medium bg-primary/5 px-2 py-0.5 rounded-sm border border-primary/15 line-clamp-1">
              Next Action: {task.reassigned_by}
            </div>
          ) : task.description ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          ) : null}
        </div>

        {/* Ownership / Pending with row */}
        {task.status === 'completed' ? (
          <div className="mt-2.5 p-2 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Completed by {task.completed_by || task.person_name || 'Team Member'}</span>
            </span>
            {task.reassigned_by && (
              <p className="text-[11px] text-foreground/80 mt-1 pl-4 border-l border-emerald-500/30 line-clamp-1">
                "{task.reassigned_by}"
              </p>
            )}
          </div>
        ) : (
          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 min-w-0">
              <User className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
              <span className="truncate">
                Pending: <strong className="text-foreground font-medium">{task.person_name || 'Unassigned'}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Metadata row: Due date, Pending duration, Attachments count */}
        <div className="mt-2.5 pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2.5">
            {task.due_date ? (
              <span
                className={cn(
                  'flex items-center gap-1 text-[11px] font-medium',
                  overdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
                )}
              >
                <Calendar className="w-3 h-3 shrink-0" />
                <span>Due: {formatDateOnly(task.due_date)}</span>
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground/60">No due date</span>
            )}

            {task.status === 'pending' && task.pending_since && (
              <span
                className="flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded-sm text-[10px] font-medium"
                title={`Pending since ${formatDateTime(task.pending_since)}`}
              >
                <Clock className="w-2.5 h-2.5" />
                <span>{formatRelativePending(task.pending_since)}</span>
              </span>
            )}
          </div>

          {/* Attachments and Notes badges */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {(task.attachments_count ?? 0) > 0 && (
              <span className="flex items-center gap-1 bg-muted px-1.5 py-0.2 rounded-sm" title={`${task.attachments_count} files`}>
                <Paperclip className="w-3 h-3" />
                <span>{task.attachments_count}</span>
              </span>
            )}

            {(task.notes_count ?? 0) > 0 && (
              <span className="flex items-center gap-1 bg-muted px-1.5 py-0.2 rounded-sm" title={`${task.notes_count} notes`}>
                <MessageSquare className="w-3 h-3" />
                <span>{task.notes_count}</span>
              </span>
            )}
          </div>
        </div>

        {/* Tactile Action Bar */}
        {!isBin && (
          <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between gap-2 no-card-click">
            <div className="flex items-center gap-1">
              {/* WhatsApp Share Button */}
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Share via WhatsApp"
              >
                <Share2 className="w-3 h-3" />
                <span>WhatsApp</span>
              </button>

              {/* Audio Listen Button */}
              <button
                type="button"
                onClick={handleToggleSpeak}
                className={cn(
                  'px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer',
                  isSpeaking
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 animate-pulse'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground border-border/80'
                )}
                title="Listen to task"
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="w-3 h-3 text-amber-600" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3" />
                    <span>Listen</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Complete Action */}
            <div>
              {task.status !== 'completed' ? (
                canEdit ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickDoneOpen(true);
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </button>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-muted text-[11px] font-medium text-muted-foreground flex items-center gap-1 border border-border/60">
                    <span>👁️ View Only</span>
                  </span>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>View</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status Modal */}
      {statusModalOpen && (
        <ChangeStatusModal
          isOpen={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          task={task}
          onStatusChanged={() => {
            triggerRefresh();
            onRefresh?.();
          }}
        />
      )}

      {/* Quick Done Modal */}
      {quickDoneOpen && (
        <QuickCompleteModal
          isOpen={quickDoneOpen}
          onClose={() => setQuickDoneOpen(false)}
          task={task}
          siteName={siteName}
          onCompleted={() => {
            triggerRefresh();
            onRefresh?.();
          }}
        />
      )}

      {/* Soft Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Move Task to Bin?"
        message={`Are you sure you want to move "${task.title}" to the Recycle Bin? You can restore it later.`}
        confirmText="Move to Bin"
        variant="danger"
        isLoading={isProcessing}
        onConfirm={handleSoftDelete}
        onClose={() => setDeleteConfirmOpen(false)}
      />

      {/* Permanent Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={permDeleteConfirmOpen}
        title="Permanently Delete Task?"
        message={`This will permanently delete "${task.title}" and all its attachments and notes. This cannot be undone.`}
        confirmText="Delete Forever"
        variant="danger"
        isLoading={isProcessing}
        onConfirm={handlePermanentDelete}
        onClose={() => setPermDeleteConfirmOpen(false)}
      />
    </>
  );
};
