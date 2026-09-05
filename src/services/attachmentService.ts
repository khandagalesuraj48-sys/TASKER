import { supabase } from '../lib/supabase';
import { STORAGE_BUCKET, DEFAULT_USER_NAME } from '../constants';
import { TaskAttachment } from '../types/task';
import { sanitizeFileName, validateFile } from '../lib/fileUtils';

export const getAttachments = async (taskId: string): Promise<TaskAttachment[]> => {
  const { data, error } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('Error fetching attachments:', error);
    throw new Error('Unable to load attachments.');
  }

  return (data || []) as TaskAttachment[];
};

export const uploadAttachment = async (
  taskId: string,
  file: File,
  uploader: string = DEFAULT_USER_NAME
): Promise<TaskAttachment> => {
  // Validate file client-side
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }

  const safeName = sanitizeFileName(file.name);
  const storagePath = `tasks/${taskId}/${Date.now()}_${safeName}`;

  // 1. Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('Supabase storage upload error:', uploadError);
    throw new Error(`File upload failed: ${uploadError.message || 'Please try again.'}`);
  }

  // 2. Store metadata in PostgreSQL
  const payload = {
    task_id: taskId,
    file_name: file.name,
    storage_path: storagePath,
    file_type: file.type || 'application/octet-stream',
    file_size: file.size,
    uploaded_by: uploader,
    uploaded_at: new Date().toISOString(),
  };

  const { data: record, error: dbError } = await supabase
    .from('task_attachments')
    .insert(payload as any)
    .select()
    .single();

  if (dbError) {
    console.error('Attachment metadata record error:', dbError);
    // Cleanup the uploaded file to prevent orphans
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error('Unable to save attachment metadata. Upload rolled back.');
  }

  return record as TaskAttachment;
};

/**
 * Generates a temporary signed URL for viewing or downloading a file from the private bucket.
 * Default expiration is 1 hour (3600 seconds).
 */
export const getAttachmentSignedUrl = async (
  storagePath: string,
  expiresIn: number = 3600
): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    console.error('Error generating signed URL:', error);
    throw new Error('Failed to generate secure file link.');
  }

  return data.signedUrl;
};

/**
 * @deprecated Use getAttachmentSignedUrl for private buckets.
 */
export const getAttachmentUrl = (storagePath: string): string => {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
};

export const downloadAttachmentBlob = async (storagePath: string): Promise<Blob> => {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);
  if (error || !data) {
    console.error('Error downloading attachment blob:', error);
    throw new Error('Failed to download file from storage.');
  }
  return data;
};

export const deleteAttachment = async (
  attachmentId: string,
  storagePath: string
): Promise<void> => {
  // 1. Delete from storage first - must succeed before metadata is removed
  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (storageError) {
    console.error('Could not remove file from storage:', storageError);
    throw new Error(`Failed to remove file from storage: ${storageError.message || 'Storage error'}`);
  }

  // 2. Delete metadata from PostgreSQL
  const { error: dbError } = await supabase
    .from('task_attachments')
    .delete()
    .eq('id', attachmentId);

  if (dbError) {
    console.error('Error deleting attachment record:', dbError);
    throw new Error('Unable to delete attachment record from database.');
  }
};

export const deleteAllTaskFiles = async (taskId: string): Promise<void> => {
  try {
    const { data: fileList, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(`tasks/${taskId}`);

    if (listError) {
      console.warn('Error listing task files for deletion:', listError);
      return;
    }

    if (!fileList || fileList.length === 0) {
      return;
    }

    const pathsToDelete = fileList.map((f) => `tasks/${taskId}/${f.name}`);
    const { error: removeError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(pathsToDelete);

    if (removeError) {
      console.warn('Error removing task files from storage:', removeError);
    }
  } catch (err) {
    console.error('Error cleaning up task files from storage:', err);
  }
};

