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
      showToast('टास्क पूर्ण करताना केलेल्या कामाचा शेरा (Work Done Remarks) लिहिणे अनिवार्य आहे.', 'error');
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
          ? `🎉 टास्क पूर्ण झाले! कामाचा शेरा नोंदवला गेला.`
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
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
          <div className="text-center flex-1">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 block uppercase">Current</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {STATUS_CONFIG[task.status].label}
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mx-2" />
          <div className="text-center flex-1">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 block uppercase">New</span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {STATUS_CONFIG[selectedStatus].label}
            </span>
          </div>
        </div>

        {/* Status Selector Radio / Buttons */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
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
                      ? 'border-blue-500 dark:border-blue-400 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className={isSelected ? 'text-blue-900 dark:text-blue-200' : 'text-slate-800 dark:text-slate-200'}>
                      {cfg.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded font-normal">
                        Current
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                    {cfg.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Remarks / Reason for status change */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>
                {selectedStatus === 'completed'
                  ? 'केलेल्या कामाचा शेरा / निकाल (Work Done Remarks)'
                  : selectedStatus === 'partial'
                  ? 'कामाचा प्रगती अहवाल (Progress Remarks)'
                  : 'शेरा / टिप्पणी (Reason / Remarks)'}
              </span>
            </span>
            {selectedStatus === 'completed' && (
              <span className="text-[10px] text-rose-500 font-bold tracking-normal bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
                * अनिवार्य (Mandatory)
              </span>
            )}
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={
              selectedStatus === 'completed'
                ? 'उदा. काम यशस्वीरीत्या पूर्ण झाले. सर्व रिपोर्ट आणि फायली तयार आहेत...'
                : selectedStatus === 'partial'
                ? 'उदा. ५ पैकी ३ कामे पूर्ण झाली, उर्वरित २ कामे प्रलंबित आहेत...'
                : 'उदा. काम सुरू केले आहे, पुढील माहितीची प्रतीक्षा आहे...'
            }
            rows={3}
            className={`w-full rounded-xl border bg-white dark:bg-slate-800 p-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 ${
              selectedStatus === 'completed' && !remarks.trim()
                ? 'border-amber-300 dark:border-amber-700/80 focus:border-blue-500 focus:ring-blue-500'
                : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500'
            }`}
          />
          <p className="text-[11px] text-slate-400 mt-1">
            {selectedStatus === 'completed'
              ? '📢 हा शेरा टास्क तयार करणाऱ्या व्यक्तीला (Task Creator) थेट नोटिफिकेशनद्वारे पाठवला जाईल.'
              : '💡 हा शेरा टाइमलाइनमध्ये सेव्ह होईल आणि पुढील हँडओव्हरसाठी सर्वांना स्पष्ट दिसेल.'}
          </p>
        </div>

        {/* Changed By Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Changed By</span>
          </label>
          <input
            type="text"
            value={changedBy}
            onChange={(e) => setChangedBy(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
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

