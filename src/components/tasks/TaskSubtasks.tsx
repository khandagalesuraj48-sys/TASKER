import React, { useState, useEffect } from 'react';
import { 
  GitFork, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Download, 
  FileText,
  User,
  Calendar
} from 'lucide-react';
import { Task, TaskAttachment } from '../../types/task';
import { getSubtasks, DelegatedSubtask, deleteSubtask } from '../../services/subtaskService';
import { getAttachmentSignedUrl } from '../../services/attachmentService';
import { formatFileSize } from '../../lib/fileUtils';
import { formatDateOnly, formatDateTime } from '../../lib/dateUtils';
import { DelegateSubtaskModal } from './DelegateSubtaskModal';
import { QuickCompleteModal } from './QuickCompleteModal';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface TaskSubtasksProps {
  taskId: string;
  parentTask?: Task;
  onSubtasksUpdated?: () => void;
}

export const TaskSubtasks: React.FC<TaskSubtasksProps> = ({
  taskId,
  parentTask,
  onSubtasksUpdated,
}) => {
  const [subtasks, setSubtasks] = useState<DelegatedSubtask[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState<boolean>(false);
  const [subtaskToComplete, setSubtaskToComplete] = useState<Task | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { showToast } = useToast();

  const loadSubtasks = async () => {
    if (!taskId) return;
    setIsLoading(true);
    try {
      const list = await getSubtasks(taskId);
      setSubtasks(list);
    } catch (err) {
      console.error('Failed to load subtasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubtasks();
  }, [taskId]);

  const handleDelete = async (subtaskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this delegated subtask?')) return;

    try {
      await deleteSubtask(subtaskId);
      showToast('Subtask removed.', 'info');
      await loadSubtasks();
      onSubtasksUpdated?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove subtask.', 'error');
    }
  };

  const handleDownloadProof = async (attachment: TaskAttachment, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingId(attachment.id);
    try {
      const signedUrl = await getAttachmentSignedUrl(attachment.storage_path, 120);
      const win = window.open(signedUrl, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = signedUrl;
        a.download = attachment.file_name;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to open attached proof.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const completedCount = subtasks.filter((s) => s.status === 'completed').length;
  const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Subtasks Top Header & Progress */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              {completedCount} of {subtasks.length} Completed
            </span>
            {subtasks.length > 0 && (
              <Badge variant="secondary" className="text-[10px] font-mono">
                {progress}%
              </Badge>
            )}
          </div>
          {subtasks.length > 0 && (
            <div className="h-1.5 w-44 bg-muted rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Delegate Subtask Button */}
        {parentTask && (
          <Button
            size="sm"
            onClick={() => setIsDelegateModalOpen(true)}
            className="h-7 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Delegate Deliverable
          </Button>
        )}
      </div>

      {/* Subtasks List */}
      {isLoading ? (
        <div className="py-6 text-center text-xs text-muted-foreground animate-pulse">
          Loading delegated subtasks...
        </div>
      ) : subtasks.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-border text-center space-y-2 bg-muted/20">
          <GitFork className="w-5 h-5 text-muted-foreground mx-auto" />
          <p className="text-xs font-semibold text-foreground">
            No delegated subtasks yet
          </p>
          <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
            You or the assignee can delegate specific deliverables (such as attaching a site log book or photo proof) to any team member.
          </p>
          {parentTask && (
            <button
              type="button"
              onClick={() => setIsDelegateModalOpen(true)}
              className="mt-1 text-xs text-primary hover:underline font-semibold"
            >
              + Delegate First Subtask
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {subtasks.map((sub) => {
            const isCompleted = sub.status === 'completed';
            const assigneeName = sub.assigned_to_name || sub.person_name || 'Unassigned';
            const attachments = sub.attachments || [];

            return (
              <div
                key={sub.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCompleted
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-card border-border shadow-xs'
                }`}
              >
                {/* Subtask Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-semibold leading-snug ${
                            isCompleted
                              ? 'line-through text-muted-foreground'
                              : 'text-foreground'
                          }`}
                        >
                          {sub.title}
                        </span>

                        <Badge
                          variant={isCompleted ? 'success' : 'warning'}
                          className="text-[10px] px-1.5 py-0 uppercase tracking-wider"
                        >
                          {isCompleted ? 'Completed' : 'Pending'}
                        </Badge>
                      </div>

                      {/* Description */}
                      {sub.description && (
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          {sub.description}
                        </p>
                      )}

                      {/* Meta Information: Assignee C, Due Date */}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span>{isCompleted ? `Done by: ${sub.completed_by || assigneeName}` : `Assigned to: ${assigneeName}`}</span>
                        </span>

                        {sub.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span>Due: {formatDateOnly(sub.due_date)}</span>
                          </span>
                        )}

                        {isCompleted && sub.completed_at && (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">
                            <Clock className="w-3 h-3" />
                            <span>{formatDateTime(sub.completed_at)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Complete with Proof or Delete */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isCompleted && (
                      <Button
                        size="sm"
                        onClick={() => setSubtaskToComplete(sub)}
                        className="h-6 px-2 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Complete
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleDelete(sub.id, e)}
                      className="p-1 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                      title="Delete subtask"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Attached Proof / Log Book Box */}
                {attachments.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-border/60 space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Attached Proof & Log Book:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((att) => {
                        return (
                          <button
                            key={att.id}
                            type="button"
                            onClick={(e) => handleDownloadProof(att, e)}
                            disabled={downloadingId === att.id}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-card border border-border hover:border-primary/40 rounded-lg text-xs font-medium text-foreground shadow-2xs transition-all text-left group"
                          >
                            <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate max-w-[140px] sm:max-w-[200px] text-[11px] group-hover:text-primary">
                                {att.file_name}
                              </p>
                              {att.file_size && (
                                <p className="text-[9px] text-muted-foreground font-mono">
                                  {formatFileSize(att.file_size)}
                                </p>
                              )}
                            </div>
                            <Download className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0 ml-1" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delegate Subtask Modal */}
      {parentTask && isDelegateModalOpen && (
        <DelegateSubtaskModal
          isOpen={isDelegateModalOpen}
          parentTask={parentTask}
          onClose={() => setIsDelegateModalOpen(false)}
          onSubtaskCreated={async () => {
            await loadSubtasks();
            onSubtasksUpdated?.();
          }}
        />
      )}

      {/* Quick Complete Modal for Subtask */}
      {subtaskToComplete && (
        <QuickCompleteModal
          isOpen={Boolean(subtaskToComplete)}
          task={subtaskToComplete}
          onClose={() => setSubtaskToComplete(null)}
          onCompleted={async () => {
            setSubtaskToComplete(null);
            await loadSubtasks();
            onSubtasksUpdated?.();
          }}
        />
      )}
    </div>
  );
};
