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
      if (selectedFile) {
        showToast('Uploading attachment proof...', 'info');
        await uploadAttachment(task.id, selectedFile, currentUserName);
      }

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
      title={isSubtask ? 'Complete Subtask with Proof' : 'Complete Task with Verification Proof'}
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
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-start gap-2.5">
            {isSubtask ? (
              <GitFork className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              {isSubtask && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-0.5">
                  Delegated Action Item
                </span>
              )}
              <h4 className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                {task.title}
              </h4>
              {task.person_name && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Assigned to: <strong className="text-foreground">{task.person_name}</strong>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Attachment / Log Book Upload Section */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isSubtask ? 'Log Book / Proof Document / Photo' : 'Site Photo or Document Proof'}</span>
            </span>
            <span className="text-[10px] font-normal text-muted-foreground">Optional</span>
          </label>

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
            <div className="relative rounded-xl overflow-hidden border border-emerald-500/30 bg-card p-3">
              {filePreview ? (
                <div className="space-y-2">
                  <img
                    src={filePreview}
                    alt="Proof Preview"
                    className="w-full h-44 object-cover rounded-lg"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate font-medium text-foreground">{selectedFile.name}</span>
                    <span className="shrink-0 text-[11px] font-mono">{formatFileSize(selectedFile.size)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-2">
                  <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {formatFileSize(selectedFile.size)} • Document Attached
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={removeFile}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground shadow-sm hover:opacity-90 transition-opacity"
                title="Remove attachment"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border border-dashed border-border hover:border-emerald-500/50 bg-muted/20 hover:bg-emerald-500/5 transition-all text-center group active:scale-98"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Camera className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-foreground">
                  Take Live Photo
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Camera proof
                </span>
              </button>

              <button
                type="button"
                onClick={() => documentInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-primary/5 transition-all text-center group active:scale-98"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-foreground">
                  Attach File / PDF
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Browse file manager
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Completion Remarks with One-Click ERP Presets */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Completion Remarks *</span>
          </label>

          <div className="flex flex-wrap gap-1.5 mb-2">
            {presetRemarks.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRemarks(preset)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all text-left ${
                  remarks === preset
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-muted/40 text-foreground hover:bg-muted'
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
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden resize-none"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Completing...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSubtask ? 'Done with Log Book' : 'Done with Proof'}</span>
              </span>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
