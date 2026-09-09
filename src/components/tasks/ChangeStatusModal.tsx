import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Task, TaskStatus } from '../../types/task';
import { STATUS_CONFIG, DEFAULT_USER_NAME } from '../../constants';
import { updateTaskStatus } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';
import { useTask } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
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
  const { displayName, userEmail } = useAuth();
  const currentUserName = displayName || userEmail || DEFAULT_USER_NAME;

  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>(task.status);
  const [remarks, setRemarks] = useState<string>('');
  const [changedBy, setChangedBy] = useState<string>(currentUserName);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { showToast } = useToast();
  const { triggerRefresh } = useTask();

  const statuses: TaskStatus[] = ['pending', 'in_progress', 'partial', 'completed', 'cancelled'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStatus === 'completed' && !remarks.trim()) {
      showToast('Work completion remarks are mandatory when marking a task complete.', 'error');
      return;
    }

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
        selectedStatus === 'completed'
          ? `🎉 Task marked completed! Work completion remarks recorded.`
          : `Task status updated to ${STATUS_CONFIG[selectedStatus].label}`,
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
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/80">
          <div className="text-center flex-1">
            <span className="text-[10px] font-semibold text-muted-foreground block uppercase tracking-wider">Current</span>
            <span className="text-xs font-bold text-foreground">
              {STATUS_CONFIG[task.status].label}
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mx-2" />
          <div className="text-center flex-1">
            <span className="text-[10px] font-semibold text-muted-foreground block uppercase tracking-wider">New</span>
            <span className="text-xs font-bold text-primary">
              {STATUS_CONFIG[selectedStatus].label}
            </span>
          </div>
        </div>

        {/* Status Selector Radio / Buttons */}
        <div>
          <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider mb-2">
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
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all text-xs ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/20 shadow-xs'
                      : 'border-border/80 bg-card hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className={isSelected ? 'text-primary font-bold' : 'text-foreground'}>
                      {cfg.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1 leading-tight">
                    {cfg.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Remarks / Reason for status change */}
        <div>
          <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
              <span>
                {selectedStatus === 'completed'
                  ? 'Work Done Remarks / Outcome'
                  : selectedStatus === 'partial'
                  ? 'Progress Remarks / Status Update'
                  : 'Remarks / Handover Notes'}
              </span>
            </span>
            {selectedStatus === 'completed' && (
              <span className="text-[10px] text-destructive font-bold tracking-normal bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
                * Mandatory
              </span>
            )}
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={
              selectedStatus === 'completed'
                ? 'e.g. Work completed successfully. All inspection reports and files are attached...'
                : selectedStatus === 'partial'
                ? 'e.g. 3 of 5 action items completed, remaining 2 are in progress...'
                : 'e.g. Work initiated, awaiting client confirmation...'
            }
            rows={3}
            className={`w-full rounded-lg border bg-background p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 resize-y ${
              selectedStatus === 'completed' && !remarks.trim()
                ? 'border-amber-500/50'
                : 'border-input/80'
            }`}
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {selectedStatus === 'completed'
              ? '📢 This remark will be sent directly to the task creator via instant notification.'
              : '💡 This remark will be saved in the activity timeline for transparent handover.'}
          </p>
        </div>

        {/* Changed By Field */}
        <div>
          <label className="block text-xs font-semibold text-foreground/80 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Changed By</span>
          </label>
          <input
            type="text"
            value={changedBy}
            onChange={(e) => setChangedBy(e.target.value)}
            className="w-full rounded-lg border border-input/80 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-border/60">
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

