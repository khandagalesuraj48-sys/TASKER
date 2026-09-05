import React, { useRef, useState } from 'react';
import { ALLOWED_EXTENSIONS } from '../../constants';
import { validateFile } from '../../lib/fileUtils';
import { UploadCloud, AlertCircle, Loader2 } from 'lucide-react';

interface FileUploadZoneProps {
  onFileSelect?: (file: File) => void;
  onFilesSelect?: (files: File[]) => void;
  isUploading?: boolean;
  uploadProgressText?: string;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFileSelect,
  onFilesSelect,
  isUploading = false,
  uploadProgressText,
}) => {
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setErrorMsg(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFiles(Array.from(e.target.files));
    }
  };

  const processSelectedFiles = (files: File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const val = validateFile(file);
      if (!val.valid) {
        errors.push(`${file.name}: ${val.error}`);
      } else {
        validFiles.push(file);
      }
    }

    if (errors.length > 0) {
      setErrorMsg(errors.join(' • '));
    }

    if (validFiles.length > 0) {
      if (onFilesSelect) {
        onFilesSelect(validFiles);
      } else if (onFileSelect) {
        validFiles.forEach((f) => onFileSelect(f));
      }
    }

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700'
        } ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
          onChange={handleChange}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2 py-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {uploadProgressText || 'Uploading to secure storage...'}
            </p>
          </div>
        ) : (
          <>
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mb-2.5 shadow-sm">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 text-center">
              Drag & drop files here, or <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 text-center max-w-sm">
              Supports multiple files: Images, PDF, Office Docs, Excel, Audio, Video, ZIP (Max 25MB).
              <span className="block text-rose-500 dark:text-rose-400 font-medium mt-0.5">HTML files strictly blocked.</span>
            </p>
          </>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-900 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
