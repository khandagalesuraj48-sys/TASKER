import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTaskById, softDeleteTask, canUserDeleteTask, canUserEditTask } from '../services/taskService';
import { getStatusHistory } from '../services/statusHistoryService';
import { getNotes } from '../services/notesService';
import { getAttachments } from '../services/attachmentService';
import { Task, TaskAssignment, TaskAttachment, TaskNote, TaskReminder, TaskStatusHistory } from '../types/task';
import { getTaskReminder, saveTaskReminder, stopTaskReminder, snoozeTaskReminder } from '../services/reminderService';
import { getTaskAssignments } from '../services/taskService';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { ChangeStatusModal } from '../components/tasks/ChangeStatusModal';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { TaskShareModal } from '../components/tasks/TaskShareModal';
import { TaskAssignmentModal } from '../components/tasks/TaskAssignmentModal';
import { StatusTimeline } from '../components/tasks/StatusTimeline';
import { TaskNotes } from '../components/tasks/TaskNotes';
import { TaskAttachments } from '../components/tasks/TaskAttachments';
import { TaskSubtasks } from '../components/tasks/TaskSubtasks';
import { QuickCompleteModal } from '../components/tasks/QuickCompleteModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { formatDateTime, formatDateOnly, formatRelativePending, isTaskOverdue } from '../lib/dateUtils';
import { useToast } from '../context/ToastContext';
import { useTask } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useEnterprise } from '../context/EnterpriseContext';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Edit2,
  Trash2,
  CheckCircle2,
  GitFork,
  FileUp,
  Paperclip,
  MessageSquare,
  History,
  AlertCircle,
  Bell,
  BellOff,
  ListTodo,
  Share2,
  UserPlus,
  Users,
  ArrowRight,
  Sparkles,
  UserCheck,
  Copy,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { shareTaskViaWhatsApp } from '../services/whatsappService';
import { exportTaskToPdf } from '../services/pdfExportService';
import { TaskTimeTracker } from '../components/tasks/TaskTimeTracker';
import { TaskDiscussion } from '../components/tasks/TaskDiscussion';
import { getSubtasks, DelegatedSubtask } from '../services/subtaskService';
import { getTotalTaskDurationSeconds } from '../services/timeTrackingService';

export const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refreshKey, triggerRefresh } = useTask();
  const { user } = useAuth();
  const { isPlatformAdmin } = useAdmin();
  const { isAdmin: isOrgAdmin, isOwner: isOrgOwner, isEnterpriseMode } = useEnterprise();

  const [task, setTask] = useState<Task | null>(null);

  const canDelete = task
    ? canUserDeleteTask(task, user, isPlatformAdmin, isOrgAdmin || isOrgOwner)
    : false;
  const canEdit = task
    ? canUserEditTask(task, user, isPlatformAdmin, isOrgAdmin || isOrgOwner)
    : false;
  const [history, setHistory] = useState<TaskStatusHistory[]>([]);
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [reminder, setReminder] = useState<TaskReminder | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals state
  const [statusModalOpen, setStatusModalOpen] = useState<boolean>(false);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [assignModalOpen, setAssignModalOpen] = useState<boolean>(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [quickCompleteOpen, setQuickCompleteOpen] = useState<boolean>(false);

  const [subtasks, setSubtasks] = useState<DelegatedSubtask[]>([]);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const loadTaskData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const taskData = await getTaskById(id);
      setTask(taskData);

      const [histData, notesData, attachData, remData, assignData, subData] = await Promise.all([
        getStatusHistory(id),
        getNotes(id),
        getAttachments(id),
        getTaskReminder(id),
        getTaskAssignments(id),
        getSubtasks(id),
      ]);

      setHistory(histData);
      setNotes(notesData);
      setAttachments(attachData);
      setReminder(remData);
      setAssignments(assignData);
      setSubtasks(subData || []);
    } catch (err: any) {
      showToast(err.message || 'Unable to load task details.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [id, showToast]);

  const handleExportPdf = () => {
    if (!task) return;
    setIsExportingPdf(true);
    try {
      const totalDuration = getTotalTaskDurationSeconds(task.id);
      exportTaskToPdf({
        task,
        subtasks,
        notes,
        assignments,
        history,
        totalDurationSeconds: totalDuration,
        companyName: 'TASKER Enterprise',
      });
      showToast('Work order PDF exported successfully.', 'success');
    } catch (err: any) {
      showToast('Failed to export PDF: ' + err.message, 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleWhatsAppShare = () => {
    if (!task) return;
    shareTaskViaWhatsApp(task, subtasks);
    showToast('WhatsApp work order prepared.', 'success');
  };

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData, refreshKey]);

  const handleSoftDelete = async () => {
    if (!task) return;
    setIsDeleting(true);
    try {
      const isWorkplace = task.scope === 'workplace' || isEnterpriseMode;
      await softDeleteTask(task.id);
      showToast(`Task "${task.title}" moved to Bin.`, 'info');
      triggerRefresh();
      if (isWorkplace) {
        navigate('/org/tasks');
      } else {
        navigate('/tasks');
      }
    } catch (err: any) {
      showToast(err.message || 'Error moving to Bin', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleStopReminder = async () => {
    if (!task) return;
    try {
      await stopTaskReminder(task.id);
      showToast('Reminder stopped.', 'info');
      setReminder((prev) => (prev ? { ...prev, is_enabled: false, status: 'stopped' } : null));
    } catch {
      showToast('Could not stop reminder.', 'error');
    }
  };

  const handleSnoozeReminder = async (mins: number = 15) => {
    if (!task) return;
    try {
      await snoozeTaskReminder(task.id, mins);
      showToast(`Reminder snoozed for ${mins} minutes.`, 'success');
      loadTaskData();
    } catch {
      showToast('Could not snooze reminder.', 'error');
    }
  };

  const handleQuickEnableReminder = async () => {
    if (!task) return;
    try {
      const isPast = task.due_date && new Date(task.due_date).getTime() <= Date.now();
      const defaultRemindAt = (!task.due_date || isPast)
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : new Date(task.due_date).toISOString();
      const updatedRem = await saveTaskReminder(task.id, {
        is_enabled: true,
        remind_at: defaultRemindAt,
        recurrence_type: 'once',
      });
      setReminder(updatedRem);
      showToast('Reminder enabled.', 'success');
    } catch {
      showToast('Could not enable reminder.', 'error');
    }
  };

  const handleCopyId = () => {
    if (!task) return;
    navigator.clipboard.writeText(task.id);
    showToast('Task ID copied to clipboard.', 'success');
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-5 animate-pulse">
        <div className="h-6 bg-muted rounded w-24"></div>
        <div className="h-12 bg-muted rounded-lg w-2/3"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!task || task.is_deleted) {
    const isWorkplace = isEnterpriseMode || task?.scope === 'workplace';
    return (
      <div className="max-w-md mx-auto my-12 text-center p-8 bg-card rounded-xl border border-border shadow-xs space-y-3">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-1" />
        <h3 className="text-lg font-bold text-foreground">
          {task?.is_deleted ? 'Task Moved to Bin' : 'Task Not Found'}
        </h3>
        <p className="text-xs text-muted-foreground">
          {task?.is_deleted
            ? 'This task has been archived or moved to the Recycle Bin.'
            : 'The task you are trying to view does not exist or has been permanently deleted.'}
        </p>
        <Button
          size="sm"
          className="mt-2"
          onClick={() => navigate(isWorkplace ? '/org/tasks' : '/tasks')}
        >
          {isWorkplace ? 'Back to Workplace Tasks' : 'Back to Tasks'}
        </Button>
      </div>
    );
  }

  const overdue = isTaskOverdue(task.due_date, task.status);

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      {/* Top Navigation & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(task.scope === 'workplace' || isEnterpriseMode ? '/org/tasks' : '/tasks');
              }
            }}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold">Back</span>
          </Button>

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Task ID Monospace Reference Pill */}
          <button
            type="button"
            onClick={handleCopyId}
            title="Click to copy full Task ID"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/70 hover:bg-muted text-[11px] font-mono font-medium text-muted-foreground transition-colors border border-border/50"
          >
            <span>#{task.id.slice(0, 8).toUpperCase()}</span>
            <Copy className="w-3 h-3 opacity-60" />
          </button>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareModalOpen(true)}
            className="h-8 text-xs font-medium"
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            Share
          </Button>
          {canEdit ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignModalOpen(true)}
                className="h-8 text-xs font-medium"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                Assign
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditModalOpen(true)}
                className="h-8 text-xs font-medium"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                Edit
              </Button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs font-medium text-muted-foreground border border-border/80">
              <span>👁️ View Only (फक्त वाचनासाठी)</span>
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleWhatsAppShare}
            className="h-8 text-xs font-medium text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400"
            title="Share Work Order on WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="h-8 text-xs font-medium text-primary border-primary/30 hover:bg-primary/10"
            title="Download Official Branded PDF Work Order & Audit Report"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            {isExportingPdf ? 'Exporting...' : 'PDF Work-Order'}
          </Button>

          {canEdit && task.status !== 'completed' && (
            <Button
              size="sm"
              className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              onClick={() => setQuickCompleteOpen(true)}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              {task.parent_task_id ? 'Attach Log Book' : 'Done with Proof'}
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            className="h-8 text-xs font-semibold"
            onClick={() => setStatusModalOpen(true)}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
            Status
          </Button>

          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              className="h-8 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive border-border"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Delegated Subtask Banner (User C action item) */}
      {task.parent_task_id && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <GitFork className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                  Delegated Action Item
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-foreground">
                  Parent Project: {task.custom_fields?.parent_task_title || 'Workplace Task'}
                </h3>
              </div>
            </div>
            {task.custom_fields?.delegated_by_name && (
              <span className="text-xs font-medium text-muted-foreground bg-card px-2.5 py-1 rounded-md border border-border">
                Delegated by: <strong className="text-foreground">{task.custom_fields.delegated_by_name}</strong>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-primary/15 text-xs">
            <div className="text-muted-foreground">
              Deliverable assigned to you: <strong className="text-foreground">{task.title}</strong>
            </div>
            {task.status !== 'completed' && (
              <Button
                size="sm"
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                onClick={() => setQuickCompleteOpen(true)}
              >
                <FileUp className="w-3.5 h-3.5 mr-1" />
                Attach Log Book & Complete
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Main Task Record Card */}
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardContent className="p-5 sm:p-6 space-y-5">
          {/* Status & Classification Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={task.status} isOverdue={overdue} size="md" />
              <PriorityBadge priority={task.priority} size="md" />
              <Badge
                variant={task.scope === 'workplace' ? 'workplace' : 'secondary'}
                className="text-[11px] font-semibold"
              >
                {task.scope === 'workplace' ? 'Workplace Task' : 'Personal Task'}
              </Badge>
              {task.custom_fields?.site_name && (
                <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
                  Site: {task.custom_fields.site_name}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Created by: <strong className="text-foreground font-medium">{task.created_by}</strong></span>
              <span>•</span>
              <span className="font-mono text-[11px]">{formatDateTime(task.created_at)}</span>
            </div>
          </div>

          {/* Title & Description */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-tight">
              {task.title}
            </h1>
            {task.description ? (
              <div className="mt-3 text-sm text-foreground/90 whitespace-pre-line leading-relaxed bg-muted/30 p-4 rounded-lg border border-border/60">
                {task.description}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground italic">No detailed description provided.</p>
            )}
          </div>

          {/* Handover & Action Banner or Completed Submission Banner */}
          {task.status === 'completed' ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/15 pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs font-bold shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 block">
                      Task Completed & Verified
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-foreground">
                        Completed by: {task.completed_by || task.person_name || 'Team Member'}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {task.completed_at ? formatDateTime(task.completed_at) : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-card hover:bg-muted"
                    onClick={() => setStatusModalOpen(true)}
                  >
                    Change Status / Re-open
                  </Button>
                </div>
              </div>

              {/* Work Done Remarks */}
              <div>
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Work Done Remarks & Outcome:</span>
                </span>
                <div className="p-3 bg-card rounded-lg border border-emerald-500/20 text-xs font-medium text-foreground leading-relaxed shadow-2xs">
                  "{task.reassigned_by || (assignments.length > 0 && assignments[0].remark) || 'Work completed successfully.'}"
                </div>
              </div>

              {/* Handover Trail Journey */}
              <div className="pt-2 border-t border-emerald-500/15">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Lifecycle Trail
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-md bg-card border border-border text-[11px]">
                    <span className="text-muted-foreground font-medium">{task.created_by}</span>
                    <span className="text-[10px] text-muted-foreground/60">(Created)</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-md bg-card border border-border text-[11px]">
                    <span className="text-foreground font-medium">{task.person_name || 'Assignee'}</span>
                    <span className="text-[10px] text-muted-foreground/60">(Assigned)</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <div className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-md bg-emerald-600 text-white font-semibold text-[11px] shadow-xs">
                    <span>✓ {task.completed_by || task.person_name || 'Completed'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-primary/15 pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs font-bold shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </span>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-primary block">
                      Current Assignee & Ownership
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-foreground">
                        {task.person_name || 'Unassigned'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary">
                        Action Required
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs font-semibold"
                    onClick={() => setStatusModalOpen(true)}
                  >
                    Submit / Status
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-medium bg-card hover:bg-muted"
                    onClick={() => setAssignModalOpen(true)}
                  >
                    Handover / Reassign
                  </Button>
                </div>
              </div>

              {/* Immediate Action Instruction */}
              <div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Immediate Instructions for {task.person_name || 'Assignee'}:</span>
                </span>
                {task.reassigned_by || (assignments.length > 0 && assignments[0].remark) ? (
                  <div className="p-3 bg-card rounded-lg border border-border text-xs font-medium text-foreground leading-relaxed shadow-2xs">
                    "{task.reassigned_by || assignments[0].remark}"
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    Follow project description above. Use "Handover / Reassign" to dispatch specific deliverables.
                  </div>
                )}
              </div>

              {/* Visual Handover Rail (A ➔ B ➔ C) */}
              {assignments.length > 0 && (
                <div className="pt-2 border-t border-primary/15">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Delegation Chain (A ➔ B ➔ C)
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-md bg-card border border-border text-[11px]">
                      <span className="text-muted-foreground font-medium">{task.created_by}</span>
                      <span className="text-[10px] text-muted-foreground/60">(Created)</span>
                    </div>
                    {assignments.slice().reverse().map((asgn, idx) => (
                      <React.Fragment key={asgn.id || idx}>
                        <ArrowRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                        <div
                          className={`flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-md border text-[11px] ${
                            idx === assignments.length - 1
                              ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
                              : 'bg-card text-foreground border-border'
                          }`}
                        >
                          <span>{asgn.assigned_to_name || 'Member'}</span>
                          <span
                            className={`text-[10px] ${
                              idx === assignments.length - 1 ? 'text-primary-foreground/80' : 'text-muted-foreground'
                            }`}
                          >
                            ({asgn.status})
                          </span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Pending With
              </span>
              <div className="flex items-center gap-1.5 text-foreground font-medium">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="truncate">{task.person_name || 'None'}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Due Date
              </span>
              <div className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className={overdue ? 'text-destructive font-bold' : 'text-foreground'}>
                  {task.due_date ? formatDateOnly(task.due_date) : 'No due date'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Pending Since
              </span>
              <div className="flex items-center gap-1.5 text-foreground font-medium">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {task.status === 'pending'
                    ? formatRelativePending(task.pending_since)
                    : formatDateOnly(task.pending_since)}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Last Updated
              </span>
              <span className="text-foreground font-mono text-[11px] block">
                {formatDateTime(task.updated_at)}
              </span>
            </div>
          </div>

          {/* Smart Reminder Bar */}
          <div className="p-3.5 bg-muted/40 border border-border/80 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              {reminder && reminder.is_enabled && reminder.status !== 'stopped' && task.status !== 'completed' ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                  <Bell className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                  <BellOff className="w-3.5 h-3.5" />
                </span>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Operational Reminder</span>
                  {reminder && reminder.is_enabled && reminder.status !== 'stopped' && task.status !== 'completed' ? (
                    <Badge variant="default" className="text-[10px] h-4 px-1.5 py-0">Active</Badge>
                  ) : task.status === 'completed' ? (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 text-emerald-600 border-emerald-500/30">Auto Stopped</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 text-muted-foreground">Inactive</Badge>
                  )}
                </div>

                <div className="text-muted-foreground text-[11px] mt-0.5">
                  {reminder && reminder.is_enabled && reminder.status !== 'stopped' && task.status !== 'completed' ? (
                    <span>
                      Alert scheduled: <strong className="text-foreground">{formatDateTime(reminder.next_trigger_at)}</strong> ({reminder.recurrence_type})
                    </span>
                  ) : task.status === 'completed' ? (
                    <span>All recurring reminders terminated upon task completion.</span>
                  ) : (
                    <span>No active push alert configured for this task.</span>
                  )}
                </div>
              </div>
            </div>

            {task.status !== 'completed' && (
              <div className="flex items-center gap-2">
                {reminder && reminder.is_enabled && reminder.status !== 'stopped' ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSnoozeReminder(15)}
                      className="h-7 text-xs bg-card"
                    >
                      Snooze 15m
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleStopReminder}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Stop
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleQuickEnableReminder}
                    className="h-7 text-xs"
                  >
                    Enable Alert
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout: Left (Subtasks, Notes, Files) | Right (Assignments & Audit Trail) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subtasks Checklist Section */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-primary" />
                  <span>Delegated Subtasks & Action Items</span>
                </h2>
              </div>
              <TaskSubtasks taskId={task.id} parentTask={task} onSubtasksUpdated={loadTaskData} />
            </CardContent>
          </Card>

          {/* Notes Section */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span>Activity Notes & Remarks</span>
                  <span className="text-xs font-normal text-muted-foreground">({notes.length})</span>
                </h2>
              </div>
              <TaskNotes
                taskId={task.id}
                notes={notes}
                onNotesUpdated={loadTaskData}
              />
            </CardContent>
          </Card>

          {/* Attachments Section */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-muted-foreground" />
                  <span>Verification Proofs & Log Books</span>
                  <span className="text-xs font-normal text-muted-foreground">({attachments.length})</span>
                </h2>
              </div>
              <TaskAttachments
                taskId={task.id}
                attachments={attachments}
                onAttachmentsUpdated={loadTaskData}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col */}
        <div className="space-y-6">
          {/* Live Time Tracker & Billable Hours */}
          <TaskTimeTracker taskId={task.id} taskTitle={task.title} />

          {/* Task-Specific Live Discussion & @Mentions */}
          <TaskDiscussion
            taskId={task.id}
            teamMembers={assignments.map((a) => ({
              id: a.assigned_to,
              full_name: a.assigned_to_name || 'Member',
              email: a.assigned_to_name || 'Member',
            }))}
          />

          {/* Assignment History */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>Assignment History</span>
                  <span className="text-xs font-normal text-muted-foreground">({assignments.length})</span>
                </h2>
                <button
                  onClick={() => setAssignModalOpen(true)}
                  className="text-xs text-primary hover:underline font-semibold"
                >
                  + Assign
                </button>
              </div>

              {assignments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  No formal workplace assignments logged yet. Click "Assign" above to hand over this task.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {assignments.map((asgn) => (
                    <div
                      key={asgn.id}
                      className="p-3 rounded-lg border border-border bg-muted/30 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">
                          {asgn.assigned_to_name || 'Team Member'}
                        </span>
                        <Badge
                          variant={asgn.status === 'completed' ? 'success' : 'secondary'}
                          className="text-[10px] capitalize px-1.5 py-0"
                        >
                          {asgn.status}
                        </Badge>
                      </div>
                      {asgn.remark && (
                        <p className="text-muted-foreground italic text-[11px]">
                          "{asgn.remark}"
                        </p>
                      )}
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono pt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{formatDateTime(asgn.assigned_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status History Timeline */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <span>Audit Trail & Status History</span>
                  <span className="text-xs font-normal text-muted-foreground">({history.length})</span>
                </h2>
              </div>
              <StatusTimeline history={history} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Share Task Modal */}
      {shareModalOpen && (
        <TaskShareModal
          task={task}
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {/* Assign Task Modal */}
      {assignModalOpen && (
        <TaskAssignmentModal
          task={task}
          isOpen={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          onAssigned={loadTaskData}
        />
      )}

      {/* Change Status Modal */}
      {statusModalOpen && (
        <ChangeStatusModal
          task={task}
          isOpen={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          onStatusChanged={loadTaskData}
        />
      )}

      {/* Edit Task Modal */}
      {editModalOpen && (
        <TaskFormModal
          taskToEdit={task}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={loadTaskData}
        />
      )}

      {/* Quick Complete Modal */}
      {quickCompleteOpen && task && (
        <QuickCompleteModal
          task={task}
          isOpen={quickCompleteOpen}
          onClose={() => setQuickCompleteOpen(false)}
          onCompleted={loadTaskData}
        />
      )}

      {/* Move to Bin Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleSoftDelete}
        title="Move Task to Bin"
        message={`Move "${task.title}" to the Recycle Bin? All history, notes, and attachments will remain accessible in the Bin.`}
        confirmText="Move to Bin"
        variant="warning"
        isLoading={isDeleting}
      />
    </div>
  );
};
