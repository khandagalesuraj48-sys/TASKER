import React, { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Task } from '../../types/task';
import { DEFAULT_USER_NAME } from '../../constants';
import { updateTaskStatus } from '../../services/taskService';
import { uploadAttachment } from '../../services/attachmentService';
import { useToast } from '../../context/ToastContext';
import { useTask } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { 
  CheckCircle2, 
  Camera, 
  FileUp, 
  FileText, 
  X, 
  Loader2, 
  Sparkles,
  GitFork 
} from 'lucide-react';
import { formatFileSize } from '../../lib/fileUtils';

interface QuickCompleteModalProps {
  task: Task;
  isOpen: boolean;
  siteName?: string;
  onClose: () => void;
  onCompleted?: () => void;
}

export const QuickCompleteModal: React.FC<QuickCompleteModalProps> = ({
  task,
  isOpen,
  siteName,
  onClose,
  onCompleted,
}) => {
  const { displayName, userEmail } = useAuth();
  const currentUserName = displayName || userEmail || DEFAULT_USER_NAME;

  const isSubtask = Boolean(task.parent_task_id || task.custom_fields?.is_subtask);
  const parentTitle = task.custom_fields?.parent_task_title;

  const [remarks, setRemarks] = useState<string>(
    isSubtask ? '✓ Log book verified & attached' : '✓ Completed & Verified on Site'
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const { showToast } = useToast();
  const { triggerRefresh } = useTask();

  const presetRemarks = isSubtask
    ? [
        '✓ Log book verified & attached',
        '✓ Completed & verified on site',
        '✓ Work inspected & approved',
        '✓ Client sign-off collected',
        '✓ Deliverables fulfilled',
      ]
    : [
        '✓ Completed & Verified on Site',
        '✓ Work Inspected & Approved',
        '✓ Installation & Setup Complete',
        '✓ Maintenance & Cleaning Done',
        '✓ Client Handover Finished',
      ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) {
      showToast('Please provide completion remarks.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      // 1. If file/log book attached, upload it
      if (selectedFile) {
        showToast('Uploading attachment proof...', 'info');
        await uploadAttachment(task.id, selectedFile, currentUserName);
      }

      // 2. Mark task as completed
      await updateTaskStatus(
        task.id,
        'completed',
        remarks.trim(),
        currentUserName
      );

      showToast(
        isSubtask ? 'Subtask completed with attached proof!' : 'Task completed successfully!',
        'success'
      );
      triggerRefresh();
      onCompleted?.();
      onClose();
    } catch (err: any) {
      console.error('Complete error:', err);
      showToast(err.message || 'Failed to complete task. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSubtask ? 'Complete Subtask with Proof' : 'Complete Task with Photo Proof'}
      subtitle={
        isSubtask && parentTitle
          ? `Under parent task: "${parentTitle}"`
          : siteName
          ? `Site Location: ${siteName}`
          : 'Attach proof and verify work completion'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Task Title Banner */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
          <div className="flex items-start gap-2.5">
            {isSubtask ? (
              <GitFork className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              {isSubtask && (
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block mb-0.5">
                  Delegated Action Item
                </span>
              )}
              <h4 className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-200 leading-snug">
                {task.title}
              </h4>
              {task.person_name && (
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                  Assigned to: <strong>{task.person_name}</strong>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Attachment / Log Book Upload Section */}
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isSubtask ? 'Log Book / Proof Document / Photo' : 'Site Photo or Document Proof'}</span>
            </span>
            <span className="text-[10px] font-normal text-slate-500">Optional</span>
          </label>

          {/* Hidden inputs for camera and documents */}
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
          <input
            type="file"
            ref={documentInputRef}
            onChange={handleFileChange}
            accept="*/*"
            className="hidden"
          />

          {selectedFile ? (
            <div className="relative rounded-2xl overflow-hidden border border-emerald-300 dark:border-emerald-800 bg-slate-50 dark:bg-slate-900 p-3">
              {filePreview ? (
                <div className="space-y-2">
                  <img
                    src={filePreview}
                    alt="Proof Preview"
                    className="w-full h-44 object-cover rounded-xl"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <span className="truncate font-medium">{selectedFile.name}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatFileSize(selectedFile.size)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-2">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatFileSize(selectedFile.size)} • Document Attached
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={removeFile}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700 transition-colors"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-emerald-50/30 transition-all text-center group active:scale-98"
              >
                <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Take Live Photo
                </span>
                <span className="text-[10px] text-slate-400">
                  Camera proof
                </span>
              </button>

              <button
                type="button"
                onClick={() => documentInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-blue-50/30 transition-all text-center group active:scale-98"
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Attach Log Book / PDF
                </span>
                <span className="text-[10px] text-slate-400">
                  Browse file manager
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Completion Remarks with One-Click ERP Presets */}
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Completion Remarks *</span>
          </label>

          <div className="flex flex-wrap gap-1.5 mb-2">
            {presetRemarks.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRemarks(preset)}
                className={`px-2.5 py-1 text-xs rounded-xl font-medium transition-all text-left ${
                  remarks === preset
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            required
            placeholder="Type verification notes or observations..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-none"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !remarks.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Completing...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubtask ? 'Done with Log Book' : 'Done with Proof'}</span>
              </span>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
