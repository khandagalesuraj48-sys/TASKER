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
        className={`relative flex items-center justify-center gap-3 p-3 sm:p-3.5 rounded-xl border border-dashed transition-all cursor-pointer ${
          isDragOver
            ? 'border-primary bg-primary/10'
            : 'border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/40'
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
          <div className="flex items-center gap-2 py-1">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <p className="text-xs font-semibold text-foreground">
              {uploadProgressText || 'Uploading to secure storage...'}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-center sm:text-left">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                Drag & drop files, or <span className="text-primary underline">browse</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                Images, PDF, Excel, Docs, ZIP (Max 25MB)
              </p>
            </div>
          </div>
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
