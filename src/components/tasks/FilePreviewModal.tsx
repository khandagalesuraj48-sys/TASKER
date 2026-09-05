import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { TaskAttachment } from '../../types/task';
import { getAttachmentSignedUrl } from '../../services/attachmentService';
import { isImageFile, isPdfFile, formatFileSize } from '../../lib/fileUtils';
import { Download, ExternalLink, FileText, Loader2, AlertCircle } from 'lucide-react';

interface FilePreviewModalProps {
  attachment: TaskAttachment | null;
  isOpen: boolean;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  attachment,
  isOpen,
  onClose,
}) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    if (isOpen && attachment) {
      setIsLoading(true);
      setErrorMsg(null);
      getAttachmentSignedUrl(attachment.storage_path, 3600)
        .then((url) => {
          if (!isCancelled) {
            setFileUrl(url);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (!isCancelled) {
            setErrorMsg(err.message || 'Failed to load secure file preview.');
            setIsLoading(false);
          }
        });
    } else {
      setFileUrl(null);
      setErrorMsg(null);
      setIsLoading(false);
    }
    return () => {
      isCancelled = true;
    };
  }, [isOpen, attachment]);

  if (!attachment) return null;

  const isImage = isImageFile(attachment.file_name);
  const isPdf = isPdfFile(attachment.file_name);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={attachment.file_name}
      subtitle={`Size: ${formatFileSize(attachment.file_size)} • Uploaded by ${attachment.uploaded_by}`}
      maxWidth={isImage || isPdf ? '3xl' : 'md'}
    >
      <div className="space-y-4">
        {/* Preview Container */}
        <div className="min-h-[260px] max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-100/70 rounded-lg p-2 border border-slate-200">
          {isLoading ? (
            <div className="text-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-medium">Generating secure link...</p>
            </div>
          ) : errorMsg ? (
            <div className="text-center p-8">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-800">Unable to load preview</p>
              <p className="text-xs text-slate-500 mt-1">{errorMsg}</p>
            </div>
          ) : isImage && fileUrl ? (
            <img
              src={fileUrl}
              alt={attachment.file_name}
              className="max-h-[60vh] max-w-full rounded object-contain"
            />
          ) : isPdf && fileUrl ? (
            <iframe
              src={`${fileUrl}#toolbar=0`}
              title={attachment.file_name}
              className="w-full h-[60vh] rounded border-0 bg-white"
            />
          ) : (
            <div className="text-center p-8">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                Direct in-browser preview is not available for this file type.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                You can download or open the file in your preferred application.
              </p>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            {fileUrl ? (
              <>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in New Tab</span>
                </a>
                <a
                  href={fileUrl}
                  download={attachment.file_name}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
};

