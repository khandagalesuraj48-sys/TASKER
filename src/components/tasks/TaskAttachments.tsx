import React, { useState } from 'react';
import { TaskAttachment } from '../../types/task';
import {
  deleteAttachment,
  getAttachmentSignedUrl,
  uploadMultipleAttachments,
  FileUploadProgress,
} from '../../services/attachmentService';
import {
  formatFileSize,
  isImageFile,
  isAudioFile,
  isVideoFile,
  isPdfFile,
  isSpreadsheetFile,
  isDocumentFile,
  isArchiveFile,
} from '../../lib/fileUtils';
import { formatDateTime } from '../../lib/dateUtils';
import { FileUploadZone } from './FileUploadZone';
import { FilePreviewModal } from './FilePreviewModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import {
  FileText,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  File as FileGeneric,
  Eye,
  Download,
  Trash2,
  Loader2,
  Music,
  Video,
} from 'lucide-react';

interface TaskAttachmentsProps {
  taskId: string;
  attachments: TaskAttachment[];
  onAttachmentsUpdated: () => void;
  readOnly?: boolean;
}

export const TaskAttachments: React.FC<TaskAttachmentsProps> = ({
  taskId,
  attachments,
  onAttachmentsUpdated,
  readOnly = false,
}) => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgressStatus, setUploadProgressStatus] = useState<string>('');
  const [previewItem, setPreviewItem] = useState<TaskAttachment | null>(null);
  const [itemToDelete, setItemToDelete] = useState<TaskAttachment | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleDownloadFile = async (item: TaskAttachment) => {
    setDownloadingId(item.id);
    try {
      const signedUrl = await getAttachmentSignedUrl(item.storage_path, 60);
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = item.file_name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      showToast(err.message || 'Failed to download file.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleMultipleFilesUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadProgressStatus(`Uploading ${files.length} file(s)...`);

    try {
      const { successful, failedCount } = await uploadMultipleAttachments(
        taskId,
        files,
        (progressMap: Record<string, FileUploadProgress>) => {
          const names = Object.keys(progressMap);
          const completed = names.filter((n) => progressMap[n].status === 'completed').length;
          setUploadProgressStatus(`Uploaded ${completed}/${names.length} files...`);
        }
      );

      if (successful.length > 0) {
        showToast(`Successfully uploaded ${successful.length} file(s)!`, 'success');
        onAttachmentsUpdated();
      }

      if (failedCount > 0) {
        showToast(`${failedCount} file(s) failed to upload.`, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Upload process failed.', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgressStatus('');
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await deleteAttachment(itemToDelete.id, itemToDelete.storage_path);
      showToast('Attachment deleted.', 'info');
      onAttachmentsUpdated();
      setItemToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete attachment.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFileBadge = (fileName: string) => {
    if (isImageFile(fileName)) {
      return (
        <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
          <ImageIcon className="w-5 h-5" />
        </div>
      );
    }
    if (isPdfFile(fileName)) {
      return (
        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
          <FileText className="w-5 h-5" />
        </div>
      );
    }
    if (isSpreadsheetFile(fileName)) {
      return (
        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
      );
    }
    if (isAudioFile(fileName)) {
      return (
        <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 shrink-0">
          <Music className="w-5 h-5" />
        </div>
      );
    }
    if (isVideoFile(fileName)) {
      return (
        <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 shrink-0">
          <Video className="w-5 h-5" />
        </div>
      );
    }
    if (isDocumentFile(fileName)) {
      return (
        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shrink-0">
          <FileText className="w-5 h-5" />
        </div>
      );
    }
    if (isArchiveFile(fileName)) {
      return (
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
          <FileArchive className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
        <FileGeneric className="w-5 h-5" />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone with multi-file support */}
      {!readOnly && (
        <FileUploadZone
          onFilesSelect={handleMultipleFilesUpload}
          isUploading={isUploading}
          uploadProgressText={uploadProgressStatus}
        />
      )}

      {/* Attachments List */}
      <div className="space-y-2.5">
        {attachments.length === 0 ? (
          <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
            No attachments yet. Drop or select files above.
          </div>
        ) : (
          attachments.map((item) => {
            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getFileBadge(item.file_name)}
                  <div className="min-w-0">
                    <p
                      className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      onClick={() => setPreviewItem(item)}
                      title={item.file_name}
                    >
                      {item.file_name}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {formatFileSize(item.file_size)} • {formatDateTime(item.uploaded_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                    title="Preview file"
                    aria-label="Preview file"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadFile(item)}
                    disabled={downloadingId === item.id}
                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition-colors disabled:opacity-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
                    title="Download file"
                    aria-label="Download file"
                  >
                    {downloadingId === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                      title="Delete attachment"
                      aria-label="Delete attachment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        attachment={previewItem}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Attachment"
        message={`Are you sure you want to remove "${itemToDelete?.file_name}"? The file will be removed from secure storage.`}
        confirmText="Delete File"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
