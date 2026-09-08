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
import { CheckCircle2, Camera, X, Loader2, Sparkles } from 'lucide-react';

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

  const [remarks, setRemarks] = useState<string>('✓ Completed & Verified on Site');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { showToast } = useToast();
  const { triggerRefresh } = useTask();

  const presetRemarks = [
    '✓ Completed & Verified on Site',
    '✓ Work Inspected & Approved',
    '✓ Installation & Setup Complete',
    '✓ Maintenance & Cleaning Done',
    '✓ Client Handover Finished',
  ];

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) {
      showToast('Please provide completion remarks.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      // 1. If photo attached, upload it
      if (photo) {
        showToast('Uploading site photo proof...', 'info');
        await uploadAttachment(task.id, photo, currentUserName);
      }

      // 2. Mark task as completed
      await updateTaskStatus(
        task.id,
        'completed',
        remarks.trim(),
        currentUserName
      );

      showToast('Task completed successfully!', 'success');
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
      title="Complete Task with Photo Proof"
      subtitle={siteName ? `Site Location: ${siteName}` : 'Attach proof and verify work completion'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Task Title Banner */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
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

        {/* Live Camera / Photo Proof Upload Section */}
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Site Photo Proof</span>
            </span>
            <span className="text-[10px] font-normal text-slate-500">Optional</span>
          </label>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoSelect}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          {photoPreview ? (
            <div className="relative rounded-2xl overflow-hidden border border-emerald-300 dark:border-emerald-800 bg-slate-100 dark:bg-slate-900">
              <img
                src={photoPreview}
                alt="Work Completed Proof"
                className="w-full h-48 object-cover"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700 transition-colors"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-xs text-white text-[11px] font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{photo?.name}</span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group border-2 border-dashed border-emerald-300 dark:border-emerald-800/80 hover:border-emerald-500 dark:hover:border-emerald-600 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center gap-2 cursor-pointer bg-emerald-50/30 dark:bg-emerald-950/20 transition-all active:scale-[0.99]"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Camera className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Take photo with camera or choose from gallery
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Mobile camera will open directly
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Remarks Presets */}
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Quick Presets:</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {presetRemarks.map((pr) => (
              <button
                type="button"
                key={pr}
                onClick={() => setRemarks(pr)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all transform active:scale-95 ${
                  remarks === pr
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {pr}
              </button>
            ))}
          </div>
        </div>

        {/* Remarks Textarea */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Completion Remarks:
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            placeholder="Describe work completed..."
            required
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Complete</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
