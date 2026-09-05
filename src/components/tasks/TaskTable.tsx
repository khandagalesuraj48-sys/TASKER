import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../../types/task';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { formatDateOnly, formatRelativePending, isTaskOverdue } from '../../lib/dateUtils';
import { ChangeStatusModal } from './ChangeStatusModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { softDeleteTask, restoreTask, permanentDeleteTask } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';
import { useTask } from '../../context/TaskContext';
import {
  MoreHorizontal,
  Edit2,
  Trash2,
  RotateCcw,
  CheckCircle2,
  Paperclip,
  MessageSquare,
  Eye,
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
      showToast(`Task moved to Bin.`, 'info');
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
      showToast(`Task restored successfully.`, 'success');
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
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th scope="col" className="px-4 py-3">Task</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Priority</th>
              <th scope="col" className="px-4 py-3">Pending With</th>
              <th scope="col" className="px-4 py-3">Due Date</th>
              <th scope="col" className="px-4 py-3">Pending Since</th>
              <th scope="col" className="px-4 py-3 text-center">Files</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {tasks.map((task) => {
              const overdue = isTaskOverdue(task.due_date, task.status);

              return (
                <tr
                  key={task.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  onClick={() => !isBin && navigate(`/tasks/${task.id}`)}
                >
                  {/* Title & Description */}
                  <td className="px-4 py-3 max-w-xs sm:max-w-sm">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate hover:text-blue-600 dark:hover:text-blue-400">
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {task.description}
                      </p>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={task.status} isOverdue={overdue} size="sm" />
                  </td>

                  {/* Priority */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <PriorityBadge priority={task.priority} size="sm" />
                  </td>

                  {/* Pending With */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {task.person_name ? (
                      <span className="font-medium text-slate-800 dark:text-slate-200">{task.person_name}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </td>

                  {/* Due Date */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {task.due_date ? (
                      <span className={overdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}>
                        {formatDateOnly(task.due_date)}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </td>

                  {/* Pending Since */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {task.status === 'pending' && task.pending_since ? (
                      <span className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded text-[11px]">
                        {formatRelativePending(task.pending_since)}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </td>

                  {/* Attachments / Notes Counter */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                      {(task.attachments_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                          <Paperclip className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          <span>{task.attachments_count}</span>
                        </span>
                      )}
                      {(task.notes_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                          <MessageSquare className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          <span>{task.notes_count}</span>
                        </span>
                      )}
                      {!(task.attachments_count) && !(task.notes_count) && (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </div>
                  </td>

                  {/* Row Actions */}
                  <td
                    className="px-4 py-3 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={() => setOpenActionId(openActionId === task.id ? null : task.id)}
                        className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {openActionId === task.id && (
                        <div
                          className="absolute right-0 top-6 z-20 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 shadow-xl text-xs"
                          onClick={() => setOpenActionId(null)}
                        >
                          {!isBin ? (
                            <>
                              <button
                                onClick={() => navigate(`/tasks/${task.id}`)}
                                className="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                <span>Details</span>
                              </button>
                              <button
                                onClick={() => onEdit?.(task)}
                                className="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => setActiveTaskForStatus(task)}
                                className="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                <span>Change Status</span>
                              </button>
                              <div className="my-1 border-t border-slate-100 dark:border-slate-700/60" />
                              <button
                                onClick={() => setTaskToDelete(task)}
                                className="w-full px-3.5 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Move to Bin</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleRestore(task)}
                                className="w-full px-3.5 py-2 text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-2"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Restore Task</span>
                              </button>
                              <button
                                onClick={() => setTaskToPermDelete(task)}
                                className="w-full px-3.5 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Delete Permanently</span>
                              </button>
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
          task={activeTaskForStatus}
          isOpen={Boolean(activeTaskForStatus)}
          onClose={() => setActiveTaskForStatus(null)}
          onStatusChanged={() => onRefresh?.()}
        />
      )}

      {/* Delete to Bin Dialog */}
      <ConfirmDialog
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleSoftDelete}
        title="Move to Bin"
        message={`Move "${taskToDelete?.title}" to the Bin?`}
        confirmText="Move to Bin"
        variant="warning"
        isLoading={isProcessing}
      />

      {/* Permanent Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(taskToPermDelete)}
        onClose={() => setTaskToPermDelete(null)}
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

