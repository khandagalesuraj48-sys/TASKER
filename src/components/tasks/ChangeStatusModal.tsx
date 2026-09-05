import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Task, TaskStatus } from '../../types/task';
import { STATUS_CONFIG, DEFAULT_USER_NAME } from '../../constants';
import { updateTaskStatus } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';
import { useTask } from '../../context/TaskContext';
import { ArrowRight, MessageSquare, UserCheck } from 'lucide-react';

interface ChangeStatusModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged?: (updatedTask: Task) => void;
}

export const ChangeStatusModal: React.FC<ChangeStatusModalProps> = ({
  task,
  isOpen,
  onClose,
  onStatusChanged,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>(task.status);
  const [remarks, setRemarks] = useState<string>('');
  const [changedBy, setChangedBy] = useState<string>(DEFAULT_USER_NAME);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { showToast } = useToast();
  const { triggerRefresh } = useTask();

  const statuses: TaskStatus[] = ['pending', 'in_progress', 'partial', 'completed', 'cancelled'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStatus === task.status && !remarks.trim()) {
      onClose();
      return;
    }

    setIsLoading(true);
    try {
      const updated = await updateTaskStatus(
        task.id,
        selectedStatus,
        remarks.trim() || undefined,
        changedBy.trim() || DEFAULT_USER_NAME
      );
      showToast(
        `Task status updated to ${STATUS_CONFIG[selectedStatus].label}`,
        'success'
      );
      triggerRefresh();
      onStatusChanged?.(updated);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to update task status.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Task Status"
      subtitle={`Task: "${task.title}"`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Status Transition Banner */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div className="text-center flex-1">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">Current</span>
            <span className="text-xs font-semibold text-slate-700">
              {STATUS_CONFIG[task.status].label}
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mx-2" />
          <div className="text-center flex-1">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">New</span>
            <span className="text-xs font-semibold text-blue-600">
              {STATUS_CONFIG[selectedStatus].label}
            </span>
          </div>
        </div>

        {/* Status Selector Radio / Buttons */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Select New Status
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {statuses.map((st) => {
              const cfg = STATUS_CONFIG[st];
              const isSelected = selectedStatus === st;
              const isCurrent = task.status === st;

              return (
                <button
                  type="button"
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`flex flex-col text-left p-3 rounded-lg border transition-all text-xs ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className={isSelected ? 'text-blue-900' : 'text-slate-800'}>
                      {cfg.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-normal">
                        Current
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 leading-tight">
                    {cfg.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Remarks / Reason for status change */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
            <span>Remark / Notes (Recorded in History)</span>
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Waiting on vendor callback, or completed milestone 1..."
            rows={2}
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Changed By Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Changed By</span>
          </label>
          <input
            type="text"
            value={changedBy}
            onChange={(e) => setChangedBy(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button size="sm" type="submit" isLoading={isLoading}>
            Update Status
          </Button>
        </div>
      </form>
    </Modal>
  );
};

