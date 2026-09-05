import React, { useState } from 'react';
import { TaskAttachment } from '../../types/task';
import {
  deleteAttachment,
  getAttachmentSignedUrl,
  uploadAttachment,
} from '../../services/attachmentService';
import { formatFileSize, getFileExtension } from '../../lib/fileUtils';
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

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      await uploadAttachment(taskId, file);
      showToast(`Uploaded "${file.name}" successfully!`, 'success');
      onAttachmentsUpdated();
    } catch (err: any) {
      showToast(err.message || 'File upload failed.', 'error');
    } finally {
      setIsUploading(false);
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

  const getFileIcon = (fileName: string) => {
    const ext = getFileExtension(fileName);
    if (['jpg', 'jpeg', 'png'].includes(ext)) {
      return <ImageIcon className="w-5 h-5 text-indigo-500" />;
    }
    if (ext === 'pdf') {
      return <FileText className="w-5 h-5 text-rose-500" />;
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    }
    if (['doc', 'docx', 'txt'].includes(ext)) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    if (ext === 'zip') {
      return <FileArchive className="w-5 h-5 text-amber-500" />;
    }
    return <FileGeneric className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {!readOnly && (
        <FileUploadZone
          onFileSelect={handleFileUpload}
          isUploading={isUploading}
        />
      )}

      {/* Attachments List */}
      <div className="space-y-2">
        {attachments.length === 0 ? (
          <div className="p-4 text-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
            No files attached to this task.
          </div>
        ) : (
          attachments.map((item) => {
            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 shrink-0">
                    {getFileIcon(item.file_name)}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-xs font-semibold text-slate-800 truncate cursor-pointer hover:text-blue-600"
                      onClick={() => setPreviewItem(item)}
                      title={item.file_name}
                    >
                      {item.file_name}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatFileSize(item.file_size)} • Uploaded {formatDateTime(item.uploaded_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Preview file"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadFile(item)}
                    disabled={downloadingId === item.id}
                    className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Download file"
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
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete attachment"
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
        message={`Are you sure you want to remove "${itemToDelete?.file_name}"? The file will be removed from Supabase storage.`}
        confirmText="Delete File"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

