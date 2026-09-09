import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  UserCheck,
  Copy,
  MessageCircle,
  FileText,
  MoreVertical,
  Timer,
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

  // Active Tab state: 'deliverables' | 'discussion' | 'history'
  const [activeTab, setActiveTab] = useState<'deliverables' | 'discussion' | 'history'>('deliverables');

  // Modals & Menus state
  const [moreMenuOpen, setMoreMenuOpen] = useState<boolean>(false);
  const [showTimeTracker, setShowTimeTracker] = useState<boolean>(false);
  const [statusModalOpen, setStatusModalOpen] = useState<boolean>(false);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [assignModalOpen, setAssignModalOpen] = useState<boolean>(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [quickCompleteOpen, setQuickCompleteOpen] = useState<boolean>(false);
  const [subtasks, setSubtasks] = useState<DelegatedSubtask[]>([]);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [moreMenuOpen]);

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
    setMoreMenuOpen(false);
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
    setMoreMenuOpen(false);
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
      const defaultRemindAt = !task.due_date || isPast
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
        <div className="h-8 bg-muted rounded-lg w-48"></div>
        <div className="h-44 bg-muted rounded-xl"></div>
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
      <div className="max-w-md mx-auto my-12 text-center p-8 bg-card rounded-2xl border border-border shadow-xs space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <h3 className="text-lg font-bold text-foreground">
          {task?.is_deleted ? 'Task Moved to Bin' : 'Task Not Found'}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
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
    <div className="max-w-6xl mx-auto space-y-5 pb-16">
      {/* 1. Breadcrumb & Clean Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        {/* Left: Breadcrumbs and ID pill */}
        <div className="flex items-center gap-2 flex-wrap">
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
            className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-semibold">Back</span>
          </Button>

          <span className="text-muted-foreground/40 hidden sm:inline">•</span>

          <Badge
            variant={task.scope === 'workplace' ? 'workplace' : 'secondary'}
            className="text-[11px] font-semibold h-6"
          >
            {task.scope === 'workplace' ? 'Workplace' : 'Personal'}
          </Badge>

          {task.custom_fields?.site_name && (
            <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground h-6">
              Site: {task.custom_fields.site_name}
            </Badge>
          )}

          <button
            type="button"
            onClick={handleCopyId}
            title="Click to copy full Task ID"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-[11px] font-mono font-medium text-muted-foreground transition-colors border border-border/60 cursor-pointer"
          >
            <span>#{task.id.slice(0, 8).toUpperCase()}</span>
            <Copy className="w-3 h-3 opacity-60" />
          </button>
        </div>

        {/* Right: Consolidated Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Button (Quick change) */}
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatusModalOpen(true)}
              className="h-8 text-xs font-semibold border-border/80 hover:bg-muted cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 mr-1.5 text-primary" />
              <span>Status</span>
            </Button>
          )}

          {/* Edit Task */}
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditModalOpen(true)}
              className="h-8 text-xs font-semibold border-border/80 hover:bg-muted cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <span>Edit</span>
            </Button>
          )}

          {/* Primary Action Button */}
          {canEdit && task.status !== 'completed' ? (
            <Button
              size="sm"
              className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs px-3 cursor-pointer"
              onClick={() => setQuickCompleteOpen(true)}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              <span>{task.parent_task_id ? 'Attach Log Book' : 'Done with Proof'}</span>
            </Button>
          ) : !canEdit ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/80 text-xs font-medium text-muted-foreground border border-border/60">
              👁️ View Only
            </span>
          ) : null}

          {/* More Actions Dropdown */}
          <div className="relative" ref={moreMenuRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="h-8 px-2.5 text-xs font-medium border-border/80 hover:bg-muted cursor-pointer"
              title="More Actions"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>

            {moreMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-border bg-popover p-1.5 shadow-xl z-50 animate-in fade-in-50 zoom-in-95 text-xs space-y-0.5">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      setAssignModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-foreground hover:bg-muted transition-colors font-medium cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-primary" />
                    <span>Assign / Handover</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors font-medium cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>Send on WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-foreground hover:bg-muted transition-colors font-medium cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-primary" />
                  <span>{isExportingPdf ? 'Exporting PDF...' : 'Download PDF Work Order'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setShareModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-foreground hover:bg-muted transition-colors font-medium cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-muted-foreground" />
                  <span>Share Web Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setShowTimeTracker((prev) => !prev);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-foreground hover:bg-muted transition-colors font-medium cursor-pointer"
                >
                  <Timer className="w-4 h-4 text-indigo-500" />
                  <span>{showTimeTracker ? 'Hide Time Tracker' : 'Time Tracker & Hours'}</span>
                </button>

                {canDelete && (
                  <>
                    <div className="h-px bg-border my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setDeleteConfirmOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-destructive hover:bg-destructive/10 transition-colors font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Move to Recycle Bin</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delegated Subtask Banner (If applicable) */}
      {task.parent_task_id && (
        <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <GitFork className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                Delegated Deliverable
              </span>
              <span className="font-bold text-foreground">
                Parent Task: {task.custom_fields?.parent_task_title || 'Workplace Task'}
              </span>
            </div>
          </div>
          {task.custom_fields?.delegated_by_name && (
            <span className="text-muted-foreground text-[11px]">
              Assigned by: <strong className="text-foreground">{task.custom_fields.delegated_by_name}</strong>
            </span>
          )}
        </div>
      )}

      {/* 2. Executive Hero Card */}
      <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        <CardContent className="p-5 sm:p-6 space-y-4">
          {/* Badges & Meta Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-border/60 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={task.status} isOverdue={overdue} size="md" />
              <PriorityBadge priority={task.priority} size="md" />
              {overdue && (
                <span className="px-2 py-0.5 rounded-md bg-destructive/15 text-destructive font-bold text-[11px]">
                  ⚠️ OVERDUE
                </span>
              )}
            </div>

            <div className="text-muted-foreground text-xs flex items-center gap-1.5">
              <span>Created by:</span>
              <strong className="text-foreground font-medium">{task.created_by}</strong>
              <span>•</span>
              <span className="font-mono text-[11px]">{formatDateOnly(task.created_at)}</span>
            </div>
          </div>

          {/* Title & Description */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-snug">
              {task.title}
            </h1>
            {task.description ? (
              <div className="mt-3 text-xs sm:text-sm text-foreground/90 whitespace-pre-line leading-relaxed bg-muted/30 p-3.5 sm:p-4 rounded-xl border border-border/50">
                {task.description}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground italic">No detailed description provided.</p>
            )}
          </div>

          {/* Compact Ownership / Handover Banner */}
          {task.status === 'completed' ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold shrink-0 shadow-xs">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 block">
                    Completed & Verified
                  </span>
                  <span className="font-semibold text-foreground text-xs">
                    By: {task.completed_by || task.person_name || 'Team Member'}
                  </span>
                  {task.completed_at && (
                    <span className="text-[11px] text-muted-foreground ml-2">
                      ({formatDateTime(task.completed_at)})
                    </span>
                  )}
                </div>
              </div>
              <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 italic">
                "{task.reassigned_by || (assignments.length > 0 && assignments[0].remark) || 'Work completed successfully.'}"
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shrink-0 shadow-xs">
                  <UserCheck className="w-4 h-4" />
                </span>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-primary block">
                    Current Assignee
                  </span>
                  <span className="font-bold text-foreground text-sm">
                    {task.person_name || 'Unassigned'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {task.reassigned_by || (assignments.length > 0 && assignments[0].remark) ? (
                  <span className="text-[11px] text-muted-foreground italic max-w-xs truncate">
                    Note: "{task.reassigned_by || assignments[0].remark}"
                  </span>
                ) : null}
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-card cursor-pointer"
                    onClick={() => setAssignModalOpen(true)}
                  >
                    Handover
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optional Collapsible Time Tracker (if toggled) */}
      {showTimeTracker && (
        <div className="animate-in fade-in-50 duration-200">
          <TaskTimeTracker taskId={task.id} taskTitle={task.title} />
        </div>
      )}

      {/* 3. Main Workspace: Tabs (Left 2-cols) + Key Metadata Sidebar (Right 1-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Structured Tabbed Workspace */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs Navigation Header */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab('deliverables')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'deliverables'
                  ? 'bg-background text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5 text-primary" />
              <span>कार्ये व पुरावे (Tasks & Proofs)</span>
              {(subtasks.length > 0 || attachments.length > 0) && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono">
                  {subtasks.length + attachments.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('discussion')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'discussion'
                  ? 'bg-background text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
              <span>नोंदी व चर्चा (Discussion & Notes)</span>
              {notes.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-500 font-mono">
                  {notes.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-background text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>इतिहास व ट्रेल (Audit & Trail)</span>
              {history.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-500/10 text-slate-500 font-mono">
                  {history.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: Deliverables & Proofs */}
          {activeTab === 'deliverables' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* Delegated Subtasks Card */}
              <Card className="rounded-2xl border border-border bg-card shadow-xs">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/80 pb-3">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <ListTodo className="w-4 h-4 text-primary" />
                      <span>Delegated Subtasks & Action Items</span>
                    </h2>
                  </div>
                  <TaskSubtasks taskId={task.id} parentTask={task} onSubtasksUpdated={loadTaskData} />
                </CardContent>
              </Card>

              {/* Attachments & Proofs Card */}
              <Card className="rounded-2xl border border-border bg-card shadow-xs">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/80 pb-3">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-primary" />
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
          )}

          {/* TAB 2: Discussion & Notes */}
          {activeTab === 'discussion' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* Activity Notes & Remarks */}
              <Card className="rounded-2xl border border-border bg-card shadow-xs">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/80 pb-3">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-indigo-500" />
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

              {/* Live Team Discussion */}
              <TaskDiscussion
                taskId={task.id}
                teamMembers={assignments.map((a) => ({
                  id: a.assigned_to,
                  full_name: a.assigned_to_name || 'Member',
                  email: a.assigned_to_name || 'Member',
                }))}
              />
            </div>
          )}

          {/* TAB 3: History & Audit */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* Assignment Delegation Chain */}
              <Card className="rounded-2xl border border-border bg-card shadow-xs">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/80 pb-3">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span>Assignment Handover Journey</span>
                      <span className="text-xs font-normal text-muted-foreground">({assignments.length})</span>
                    </h2>
                    {canEdit && (
                      <button
                        onClick={() => setAssignModalOpen(true)}
                        className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                      >
                        + Handover
                      </button>
                    )}
                  </div>

                  {assignments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-3 text-center">
                      No formal handover history logged yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {assignments.map((asgn) => (
                        <div
                          key={asgn.id}
                          className="p-3 rounded-xl border border-border bg-muted/20 text-xs space-y-1.5"
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
              <Card className="rounded-2xl border border-border bg-card shadow-xs">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/80 pb-3">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <History className="w-4 h-4 text-muted-foreground" />
                      <span>Status Change Timeline</span>
                      <span className="text-xs font-normal text-muted-foreground">({history.length})</span>
                    </h2>
                  </div>
                  <StatusTimeline history={history} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right 1 Column: Clean Executive Metadata & Reminder Controls */}
        <div className="space-y-4">
          {/* Key Facts Card */}
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardContent className="p-5 space-y-3.5 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 pb-2 border-b border-border/60">
                Task Parameters
              </h3>

              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Pending With
                </span>
                <div className="flex items-center gap-1.5 text-foreground font-semibold">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span className="truncate">{task.person_name || 'None'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Due Date
                </span>
                <div className="flex items-center gap-1.5 font-semibold">
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
                <div className="flex items-center gap-1.5 text-foreground font-semibold">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    {task.status === 'pending'
                      ? formatRelativePending(task.pending_since)
                      : formatDateOnly(task.pending_since)}
                  </span>
                </div>
              </div>

              {task.custom_fields?.site_name && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Assigned Site
                  </span>
                  <span className="text-foreground font-semibold block truncate">
                    {task.custom_fields.site_name}
                  </span>
                </div>
              )}

              <div className="space-y-1 pt-2 border-t border-border/60">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Last Updated
                </span>
                <span className="text-muted-foreground font-mono text-[11px] block">
                  {formatDateTime(task.updated_at)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Operational Push Reminder Card */}
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardContent className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {reminder && reminder.is_enabled && reminder.status !== 'stopped' && task.status !== 'completed' ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                      <Bell className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                      <BellOff className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <span className="font-bold text-foreground">Operational Alert</span>
                </div>

                {reminder && reminder.is_enabled && reminder.status !== 'stopped' && task.status !== 'completed' ? (
                  <Badge variant="default" className="text-[10px] h-4 px-1.5 py-0">Active</Badge>
                ) : task.status === 'completed' ? (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 text-emerald-600 border-emerald-500/30">Auto Stopped</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 text-muted-foreground">Off</Badge>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-normal">
                {reminder && reminder.is_enabled && reminder.status !== 'stopped' && task.status !== 'completed' ? (
                  <span>Alert set for <strong className="text-foreground">{formatDateTime(reminder.next_trigger_at)}</strong></span>
                ) : (
                  <span>Enable reminders to get push notifications before deadlines.</span>
                )}
              </p>

              {task.status !== 'completed' && (
                <div className="pt-1 flex items-center gap-1.5">
                  {reminder && reminder.is_enabled && reminder.status !== 'stopped' ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSnoozeReminder(15)}
                        className="h-7 text-xs flex-1 cursor-pointer"
                      >
                        Snooze 15m
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleStopReminder}
                        className="h-7 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        Stop
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleQuickEnableReminder}
                      className="h-7 text-xs w-full cursor-pointer"
                    >
                      Enable Alert
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {shareModalOpen && (
        <TaskShareModal
          task={task}
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {assignModalOpen && (
        <TaskAssignmentModal
          task={task}
          isOpen={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          onAssigned={loadTaskData}
        />
      )}

      {statusModalOpen && (
        <ChangeStatusModal
          task={task}
          isOpen={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          onStatusChanged={loadTaskData}
        />
      )}

      {editModalOpen && (
        <TaskFormModal
          taskToEdit={task}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={loadTaskData}
        />
      )}

      {quickCompleteOpen && task && (
        <QuickCompleteModal
          task={task}
          isOpen={quickCompleteOpen}
          onClose={() => setQuickCompleteOpen(false)}
          onCompleted={loadTaskData}
        />
      )}

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
