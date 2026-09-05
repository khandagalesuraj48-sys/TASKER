import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '../constants';

/**
 * Format bytes into human readable format: e.g. 1.5 MB
 */
export const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Extract file extension without dot
 */
export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  if (parts.length <= 1) return '';
  return parts.pop()?.toLowerCase() || '';
};

/**
 * Validate file before upload
 */
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  const ext = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `File type ".${ext}" is not supported. Supported: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 25MB limit (${formatFileSize(file.size)})`,
    };
  }

  return { valid: true };
};

/**
 * Checks if the file is an image
 */
export const isImageFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ['jpg', 'jpeg', 'png'].includes(ext);
};

/**
 * Checks if the file is a PDF
 */
export const isPdfFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ext === 'pdf';
};

/**
 * Sanitize filename to ensure safe Supabase storage path
 */
export const sanitizeFileName = (fileName: string): string => {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
};

