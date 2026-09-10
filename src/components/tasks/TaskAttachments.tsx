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
        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
          <ImageIcon className="w-4 h-4" />
        </div>
      );
    }
    if (isPdfFile(fileName)) {
      return (
        <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
          <FileText className="w-4 h-4" />
        </div>
      );
    }
    if (isSpreadsheetFile(fileName)) {
      return (
        <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
      );
    }
    if (isAudioFile(fileName)) {
      return (
        <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 shrink-0">
          <Music className="w-4 h-4" />
        </div>
      );
    }
    if (isVideoFile(fileName)) {
      return (
        <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 shrink-0">
          <Video className="w-4 h-4" />
        </div>
      );
    }
    if (isDocumentFile(fileName)) {
      return (
        <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shrink-0">
          <FileText className="w-4 h-4" />
        </div>
      );
    }
    if (isArchiveFile(fileName)) {
      return (
        <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
          <FileArchive className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="p-1.5 rounded-lg bg-muted text-muted-foreground shrink-0">
        <FileGeneric className="w-4 h-4" />
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
                className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {getFileBadge(item.file_name)}
                  <div className="min-w-0">
                    <p
                      className="text-xs font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                      onClick={() => setPreviewItem(item)}
                      title={item.file_name}
                    >
                      {item.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatFileSize(item.file_size)} • {formatDateTime(item.uploaded_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors cursor-pointer"
                    title="Preview file"
                    aria-label="Preview file"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadFile(item)}
                    disabled={downloadingId === item.id}
                    className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
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
                      className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
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
