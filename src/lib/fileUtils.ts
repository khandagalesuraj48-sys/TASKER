import {
  ALLOWED_EXTENSIONS,
  BLOCKED_EXTENSIONS,
  BLOCKED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../constants';

export type FileCategory =
  | 'image'
  | 'pdf'
  | 'audio'
  | 'video'
  | 'spreadsheet'
  | 'document'
  | 'archive'
  | 'other';

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
 * Checks if the file is an image
 */
export const isImageFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext);
};

/**
 * Checks if the file is a PDF
 */
export const isPdfFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ext === 'pdf';
};

/**
 * Checks if the file is an Audio file
 */
export const isAudioFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac'].includes(ext);
};

/**
 * Checks if the file is a Video file
 */
export const isVideoFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext);
};

/**
 * Checks if the file is a Spreadsheet
 */
export const isSpreadsheetFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ['xls', 'xlsx', 'csv', 'ods'].includes(ext);
};

/**
 * Checks if the file is a Document
 */
export const isDocumentFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ['doc', 'docx', 'txt', 'rtf', 'odt', 'ppt', 'pptx'].includes(ext);
};

/**
 * Checks if the file is an Archive
 */
export const isArchiveFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext);
};

/**
 * Get category descriptor for any file
 */
export const getFileCategory = (filename: string): FileCategory => {
  if (isImageFile(filename)) return 'image';
  if (isPdfFile(filename)) return 'pdf';
  if (isAudioFile(filename)) return 'audio';
  if (isVideoFile(filename)) return 'video';
  if (isSpreadsheetFile(filename)) return 'spreadsheet';
  if (isDocumentFile(filename)) return 'document';
  if (isArchiveFile(filename)) return 'archive';
  return 'other';
};

/**
 * Validate file before upload.
 * Strictly blocks HTML files (.html, .htm, text/html)
 */
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  const ext = getFileExtension(file.name);
  const mimeType = (file.type || '').toLowerCase();

  // 1. STRICT HTML BLOCKING
  if (
    BLOCKED_EXTENSIONS.includes(ext) ||
    BLOCKED_MIME_TYPES.some((blocked) => mimeType.includes(blocked)) ||
    ext === 'html' ||
    ext === 'htm'
  ) {
    return {
      valid: false,
      error: 'Security restriction: HTML files (.html, .htm) cannot be uploaded.',
    };
  }

  // 2. Allowed extensions check
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `File type ".${ext}" is not supported. Please upload a standard document, media, image, or archive file.`,
    };
  }

  // 3. Size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 25MB limit (${formatFileSize(file.size)}).`,
    };
  }

  return { valid: true };
};

/**
 * Sanitize filename to ensure safe Supabase storage path
 */
export const sanitizeFileName = (fileName: string): string => {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
};

