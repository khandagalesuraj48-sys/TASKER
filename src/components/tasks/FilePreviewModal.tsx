import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { TaskAttachment } from '../../types/task';
import { getAttachmentSignedUrl } from '../../services/attachmentService';
import {
  isImageFile,
  isPdfFile,
  isAudioFile,
  isVideoFile,
  isSpreadsheetFile,
  isDocumentFile,
  isArchiveFile,
  formatFileSize,
} from '../../lib/fileUtils';
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  AlertCircle,
  Music,
  Video,
  FileSpreadsheet,
  FileArchive,
  File as FileGeneric,
} from 'lucide-react';

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
  const isAudio = isAudioFile(attachment.file_name);
  const isVideo = isVideoFile(attachment.file_name);
  const isSpreadsheet = isSpreadsheetFile(attachment.file_name);
  const isDoc = isDocumentFile(attachment.file_name);
  const isArchive = isArchiveFile(attachment.file_name);

  const getPreviewIcon = () => {
    if (isSpreadsheet) return <FileSpreadsheet className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />;
    if (isDoc) return <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />;
    if (isArchive) return <FileArchive className="w-8 h-8 text-amber-600 dark:text-amber-400" />;
    if (isAudio) return <Music className="w-8 h-8 text-purple-600 dark:text-purple-400" />;
    if (isVideo) return <Video className="w-8 h-8 text-rose-600 dark:text-rose-400" />;
    return <FileGeneric className="w-8 h-8 text-slate-500" />;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={attachment.file_name}
      subtitle={`Size: ${formatFileSize(attachment.file_size)} • Uploaded by ${attachment.uploaded_by}`}
      maxWidth={isImage || isPdf || isVideo ? '3xl' : 'md'}
    >
      <div className="space-y-4">
        {/* Preview Container */}
        <div className="min-h-[260px] max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-100/70 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700/60">
          {isLoading ? (
            <div className="text-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Generating secure temporary preview link...</p>
            </div>
          ) : errorMsg ? (
            <div className="text-center p-8">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Unable to load preview</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{errorMsg}</p>
            </div>
          ) : isImage && fileUrl ? (
            <img
              src={fileUrl}
              alt={attachment.file_name}
              className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-xs"
            />
          ) : isPdf && fileUrl ? (
            <iframe
              src={`${fileUrl}#toolbar=0`}
              title={attachment.file_name}
              className="w-full h-[60vh] rounded-lg border-0 bg-white"
            />
          ) : isVideo && fileUrl ? (
            <div className="w-full flex justify-center">
              <video
                controls
                playsInline
                className="max-h-[60vh] max-w-full rounded-lg shadow-md bg-black"
                src={fileUrl}
              >
                Your browser does not support HTML5 video playback.
              </video>
            </div>
          ) : isAudio && fileUrl ? (
            <div className="text-center p-6 w-full max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center mx-auto mb-4 text-purple-600 dark:text-purple-400">
                <Music className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">{attachment.file_name}</p>
              <audio controls className="w-full" src={fileUrl}>
                Your browser does not support audio playback.
              </audio>
            </div>
          ) : (
            <div className="text-center p-8">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center mb-3">
                {getPreviewIcon()}
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {attachment.file_name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                In-browser preview is not supported for this format. Download to open in your system viewer.
              </p>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            {fileUrl && (
              <>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tab</span>
                </a>
                <a
                  href={fileUrl}
                  download={attachment.file_name}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
