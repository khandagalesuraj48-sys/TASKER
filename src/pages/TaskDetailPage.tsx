import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTaskById, softDeleteTask, canUserDeleteTask } from '../services/taskService';
import { getStatusHistory } from '../services/statusHistoryService';
import { getNotes } from '../services/notesService';
import { getAttachments } from '../services/attachmentService';
import { Task, TaskAssignment, TaskAttachment, TaskNote, TaskReminder, TaskStatusHistory } from '../types/task';
import { getTaskReminder, saveTaskReminder, stopTaskReminder, snoozeTaskReminder } from '../services/reminderService';
import { getTaskAssignments } from '../services/taskService';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { Button } from '../components/common/Button';
import { ChangeStatusModal } from '../components/tasks/ChangeStatusModal';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { TaskShareModal } from '../components/tasks/TaskShareModal';
import { TaskAssignmentModal } from '../components/tasks/TaskAssignmentModal';
import { StatusTimeline } from '../components/tasks/StatusTimeline';
import { TaskNotes } from '../components/tasks/TaskNotes';
import { TaskAttachments } from '../components/tasks/TaskAttachments';
import { TaskSubtasks } from '../components/tasks/TaskSubtasks';
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
} from 'lucide-react';

export const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refreshKey, triggerRefresh } = useTask();
  const { user } = useAuth();
  const { isPlatformAdmin } = useAdmin();
  const { isAdmin: isOrgAdmin, isOwner: isOrgOwner } = useEnterprise();

  const [task, setTask] = useState<Task | null>(null);

  const canDelete = task
    ? canUserDeleteTask(task, user, isPlatformAdmin, isOrgAdmin || isOrgOwner)
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

  const loadTaskData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const taskData = await getTaskById(id);
      setTask(taskData);

      const [histData, notesData, attachData, remData, assignData] = await Promise.all([
        getStatusHistory(id),
        getNotes(id),
        getAttachments(id),
        getTaskReminder(id),
        getTaskAssignments(id),
      ]);

      setHistory(histData);
      setNotes(notesData);
      setAttachments(attachData);
      setReminder(remData);
      setAssignments(assignData);
    } catch (err: any) {
      showToast(err.message || 'Unable to load task details.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData, refreshKey]);

  const handleSoftDelete = async () => {
    if (!task) return;
    setIsDeleting(true);
    try {
      await softDeleteTask(task.id);
      showToast(`Task "${task.title}" moved to Bin.`, 'info');
      triggerRefresh();
      navigate('/tasks');
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

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-24"></div>
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-md mx-auto my-12 text-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Task Not Found</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          The task you are trying to view does not exist or has been permanently deleted.
        </p>
        <Button size="sm" className="mt-4" onClick={() => navigate('/tasks')}>
          Back to Tasks
        </Button>
      </div>
    );
  }

  const overdue = isTaskOverdue(task.due_date, task.status);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareModalOpen(true)}
            leftIcon={<Share2 className="w-3.5 h-3.5" />}
          >
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAssignModalOpen(true)}
            leftIcon={<UserPlus className="w-3.5 h-3.5" />}
          >
            Assign
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditModalOpen(true)}
            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
          >
            Edit
          </Button>
          <Button
            size="sm"
            onClick={() => setStatusModalOpen(true)}
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
          >
            Change Status
          </Button>
          {canDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Main Task Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-5">
        {/* Badges & Meta */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={task.status} isOverdue={overdue} size="md" />
            <PriorityBadge priority={task.priority} size="md" />
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
                task.scope === 'workplace'
                  ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {task.scope === 'workplace' ? '🏢 Workplace Task' : '👤 Personal Task'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <span>Created by: <strong className="text-slate-600 dark:text-slate-300">{task.created_by}</strong></span>
            <span>•</span>
            <span>{formatDateTime(task.created_at)}</span>
          </div>
        </div>

        {/* Title & Description */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
            {task.title}
          </h1>
          {task.description ? (
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed bg-slate-50/70 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              {task.description}
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 italic">No description provided.</p>
          )}
        </div>

        {/* Handover & Action Banner or Completed Submission Banner */}
        {task.status === 'completed' ? (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-slate-50 dark:from-emerald-950/40 dark:via-slate-900/40 dark:to-slate-900 p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 dark:border-emerald-900/40 pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 block">
                    Task Completed & Submitted (काम यशस्वीरीत्या पूर्ण झाले)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                      पूर्ण केले: {task.completed_by || task.person_name || 'Team Member'}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                      ✓ Completed
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatusModalOpen(true)}
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  Change Status / Re-open
                </Button>
              </div>
            </div>

            {/* Work Done Remarks */}
            <div>
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>केलेल्या कामाचा शेरा / निकाल (Work Done Remarks):</span>
              </span>
              <div className="p-3.5 bg-white dark:bg-slate-800/90 rounded-xl border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-slate-800 dark:text-slate-100 leading-relaxed shadow-2xs">
                "{task.reassigned_by || (assignments.length > 0 && assignments[0].remark) || 'काम पूर्ण झाले असून अहवाल सादर करण्यात आला आहे.'}"
              </div>
            </div>

            {/* Handover Trail Journey */}
            <div className="pt-2 border-t border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">
                संपूर्ण प्रवास (Handover Trail):
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <div className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{task.created_by}</span>
                  <span className="text-[10px] text-slate-400">(Created)</span>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                <div className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{task.person_name || 'Assignee'}</span>
                  <span className="text-[10px] text-slate-400">(Assigned)</span>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                <div className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] shadow-xs">
                  <span>✓ {task.completed_by || task.person_name || 'Completed'}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 dark:from-blue-950/40 dark:via-slate-900/40 dark:to-slate-900 p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 dark:border-blue-900/40 pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm font-bold">
                  <UserCheck className="w-5 h-5" />
                </span>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400 block">
                    Pending With / Current Assignee
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {task.person_name || 'Unassigned'}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                      ⚡ Action Required
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Handover / Status Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setStatusModalOpen(true)}
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  Submit / Change Status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignModalOpen(true)}
                  leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                >
                  Handover / Reassign
                </Button>
              </div>
            </div>

            {/* Current Specific Action Instruction */}
            <div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Immediate Action Item / Instructions for {task.person_name || 'Assignee'}:</span>
              </span>
              {task.reassigned_by || (assignments.length > 0 && assignments[0].remark) ? (
                <div className="p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-blue-100 dark:border-blue-900/50 text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed shadow-2xs">
                  "{task.reassigned_by || assignments[0].remark}"
                </div>
              ) : (
                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Follow main task description below. Click "Handover / Reassign" above to add specific instructions for team members.
                </div>
              )}
            </div>

            {/* Visual Handover Stepper Journey (A ➔ B ➔ C) */}
            {assignments.length > 0 && (
              <div className="pt-2 border-t border-blue-100/60 dark:border-blue-900/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">
                  Handover Trail (A ➔ B ➔ C)
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <div className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{task.created_by}</span>
                    <span className="text-[10px] text-slate-400">(Created)</span>
                  </div>
                  {assignments.slice().reverse().map((asgn, idx) => (
                    <React.Fragment key={asgn.id || idx}>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <div className={`flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg border text-[11px] ${
                        idx === assignments.length - 1
                          ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}>
                        <span>{asgn.assigned_to_name || 'Member'}</span>
                        <span className={`text-[10px] ${idx === assignments.length - 1 ? 'text-blue-100' : 'text-slate-400'}`}>
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

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Pending With */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Pending With
            </span>
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-medium">
              <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>{task.person_name || 'None'}</span>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Due Date
            </span>
            <div className="flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span className={overdue ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-800 dark:text-slate-200'}>
                {task.due_date ? formatDateOnly(task.due_date) : 'No due date'}
              </span>
            </div>
          </div>

          {/* Pending Since */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Pending Since
            </span>
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {task.status === 'pending'
                  ? formatRelativePending(task.pending_since)
                  : formatDateOnly(task.pending_since)}
              </span>
            </div>
          </div>

          {/* Updated At */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Last Updated
            </span>
            <span className="text-slate-800 dark:text-slate-200 font-medium block">
              {formatDateTime(task.updated_at)}
            </span>
          </div>
        </div>

        {/* Completion Banner if completed */}
        {task.status === 'completed' && task.completed_at && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>
                Completed on <strong>{formatDateTime(task.completed_at)}</strong>
              </span>
            </div>
            <span>
              Completed by: <strong>{task.completed_by || 'User'}</strong>
            </span>
          </div>
        )}

        {/* Smart Reminder Card */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            {reminder && reminder.is_enabled && reminder.status !== 'stopped' && task.status !== 'completed' ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                <Bell className="w-4 h-4" />
              </span>
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                <BellOff className="w-4 h-4" />
              </span>
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-200">Smart Reminder</span>
                {reminder && reminder.is_enabled && reminder.status !== 'stopped' && task.status !== 'completed' ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                    Active
                  </span>
                ) : task.status === 'completed' ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                    Stopped (Task Completed)
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    Inactive
                  </span>
                )}
              </div>

              <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                {reminder && reminder.is_enabled && reminder.status !== 'stopped' && task.status !== 'completed' ? (
                  <span>
                    Next alert at <strong>{formatDateTime(reminder.next_trigger_at)}</strong> (Repeat:{' '}
                    <span className="capitalize">{reminder.recurrence_type.replace('_', ' ')}</span>)
                  </span>
                ) : task.status === 'completed' ? (
                  <span>All future reminders are automatically terminated because this task is marked completed.</span>
                ) : (
                  <span>No active reminder set for this task.</span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {task.status !== 'completed' && (
            <div className="flex items-center gap-2">
              {reminder && reminder.is_enabled && reminder.status !== 'stopped' ? (
                <>
                  <button
                    onClick={() => handleSnoozeReminder(15)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors"
                  >
                    Snooze 15m
                  </button>
                  <button
                    onClick={handleStopReminder}
                    className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 font-medium"
                  >
                    Stop Reminder
                  </button>
                </>
              ) : (
                <button
                  onClick={handleQuickEnableReminder}
                  className="px-3 py-1 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium shadow-sm transition-colors"
                >
                  Enable Reminder
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout: Left (Notes & Attachments) | Right (Status Timeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Subtasks, Notes and Attachments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subtasks Checklist Section */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-blue-500" />
                <span>Checklist & Subtasks</span>
              </h2>
            </div>
            <TaskSubtasks taskId={task.id} />
          </div>

          {/* Notes Section */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Notes & Remarks</span>
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">({notes.length})</span>
              </h2>
            </div>
            <TaskNotes
              taskId={task.id}
              notes={notes}
              onNotesUpdated={loadTaskData}
            />
          </div>

          {/* Attachments Section */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Attached Files</span>
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">({attachments.length})</span>
              </h2>
            </div>
            <TaskAttachments
              taskId={task.id}
              attachments={attachments}
              onAttachmentsUpdated={loadTaskData}
            />
          </div>
        </div>

        {/* Right 1 Col: Status History Timeline & Assignment Log */}
        <div className="space-y-6">
          {/* Assignment History (for workplace tasks) */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" />
                <span>Assignment History</span>
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">({assignments.length})</span>
              </h2>
              <button
                onClick={() => setAssignModalOpen(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                + Assign
              </button>
            </div>

            {assignments.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No formal workplace assignments logged yet. Click "Assign" above to hand over this task.
              </p>
            ) : (
              <div className="space-y-3">
                {assignments.map((asgn) => (
                  <div
                    key={asgn.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {asgn.assigned_to_name || 'Team Member'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                        asgn.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : asgn.status === 'reassigned'
                          ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                      }`}>
                        {asgn.status}
                      </span>
                    </div>
                    {asgn.remark && (
                      <p className="text-slate-600 dark:text-slate-400 italic text-[11px]">
                        "{asgn.remark}"
                      </p>
                    )}
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDateTime(asgn.assigned_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status History Timeline */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Status History</span>
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">({history.length})</span>
              </h2>
            </div>
            <StatusTimeline history={history} />
          </div>
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

      {/* Move to Bin Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleSoftDelete}
        title="Move Task to Bin"
        message={`Move "${task.title}" to the Bin? All history, notes, and attachments will remain accessible in the Bin.`}
        confirmText="Move to Bin"
        variant="warning"
        isLoading={isDeleting}
      />
    </div>
  );
};

