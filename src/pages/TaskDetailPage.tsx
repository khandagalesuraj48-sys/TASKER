import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTaskById, softDeleteTask } from '../services/taskService';
import { getStatusHistory } from '../services/statusHistoryService';
import { getNotes } from '../services/notesService';
import { getAttachments } from '../services/attachmentService';
import { Task, TaskAttachment, TaskNote, TaskStatusHistory } from '../types/task';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { Button } from '../components/common/Button';
import { ChangeStatusModal } from '../components/tasks/ChangeStatusModal';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { StatusTimeline } from '../components/tasks/StatusTimeline';
import { TaskNotes } from '../components/tasks/TaskNotes';
import { TaskAttachments } from '../components/tasks/TaskAttachments';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { formatDateTime, formatDateOnly, formatRelativePending, isTaskOverdue } from '../lib/dateUtils';
import { useToast } from '../context/ToastContext';
import { useTask } from '../context/TaskContext';
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
} from 'lucide-react';

export const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { triggerRefresh } = useTask();

  const [task, setTask] = useState<Task | null>(null);
  const [history, setHistory] = useState<TaskStatusHistory[]>([]);
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals state
  const [statusModalOpen, setStatusModalOpen] = useState<boolean>(false);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const loadTaskData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const taskData = await getTaskById(id);
      setTask(taskData);

      const [histData, notesData, attachData] = await Promise.all([
        getStatusHistory(id),
        getNotes(id),
        getAttachments(id),
      ]);

      setHistory(histData);
      setNotes(notesData);
      setAttachments(attachData);
    } catch (err: any) {
      showToast(err.message || 'Unable to load task details.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData]);

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

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-24"></div>
        <div className="h-10 bg-slate-200 rounded w-2/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-64 bg-slate-200 rounded-xl"></div>
          <div className="h-64 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-md mx-auto my-12 text-center p-8 bg-white rounded-xl border border-slate-200 shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Task Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">
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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
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
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeleteConfirmOpen(true)}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Main Task Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        {/* Badges & Meta */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={task.status} isOverdue={overdue} size="md" />
            <PriorityBadge priority={task.priority} size="md" />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Created by: <strong className="text-slate-600">{task.created_by}</strong></span>
            <span>•</span>
            <span>{formatDateTime(task.created_at)}</span>
          </div>
        </div>

        {/* Title & Description */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
            {task.title}
          </h1>
          {task.description ? (
            <p className="mt-3 text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50/70 p-4 rounded-lg border border-slate-100">
              {task.description}
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-400 italic">No description provided.</p>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
          {/* Pending With */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Pending With
            </span>
            <div className="flex items-center gap-1.5 text-slate-800 font-medium">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{task.person_name || 'None'}</span>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Due Date
            </span>
            <div className="flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className={overdue ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                {task.due_date ? formatDateOnly(task.due_date) : 'No due date'}
              </span>
            </div>
          </div>

          {/* Pending Since */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Pending Since
            </span>
            <div className="flex items-center gap-1.5 text-slate-800 font-medium">
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
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Last Updated
            </span>
            <span className="text-slate-800 font-medium block">
              {formatDateTime(task.updated_at)}
            </span>
          </div>
        </div>

        {/* Completion Banner if completed */}
        {task.status === 'completed' && task.completed_at && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                Completed on <strong>{formatDateTime(task.completed_at)}</strong>
              </span>
            </div>
            <span>
              Completed by: <strong>{task.completed_by || 'Pawan'}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Two Column Layout: Left (Notes & Attachments) | Right (Status Timeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Notes and Attachments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notes Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-500" />
                <span>Notes & Remarks</span>
                <span className="text-xs font-normal text-slate-400">({notes.length})</span>
              </h2>
            </div>
            <TaskNotes
              taskId={task.id}
              notes={notes}
              onNotesUpdated={loadTaskData}
            />
          </div>

          {/* Attachments Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-slate-500" />
                <span>Attached Files</span>
                <span className="text-xs font-normal text-slate-400">({attachments.length})</span>
              </h2>
            </div>
            <TaskAttachments
              taskId={task.id}
              attachments={attachments}
              onAttachmentsUpdated={loadTaskData}
            />
          </div>
        </div>

        {/* Right 1 Col: Status History Timeline */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <span>Status History</span>
                <span className="text-xs font-normal text-slate-400">({history.length})</span>
              </h2>
            </div>
            <StatusTimeline history={history} />
          </div>
        </div>
      </div>

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

