import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { supabase } from '../lib/supabase';
import { APP_NAME, DEFAULT_USER_NAME, STORAGE_BUCKET } from '../constants';
import { BackupData, Task, TaskAttachment, TaskNote, TaskStatusHistory } from '../types/task';
import { downloadAttachmentBlob } from './attachmentService';
import { format } from 'date-fns';

export interface RestoreResult {
  tasksCount: number;
  historyCount: number;
  notesCount: number;
  attachmentsCount: number;
  filesRestored: number;
  warnings?: string[];
}

export interface BackupResult {
  failedAttachments: { fileName: string; path: string; error: string }[];
}

export const SAFE_STORAGE_PATH_REGEX = /^tasks\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/;

/**
 * Generate a complete, portable ZIP backup containing structured JSON data
 * and all downloaded binary files from Supabase Storage.
 */
export const generateFullBackup = async (
  onProgress?: (status: string, percent: number) => void
): Promise<BackupResult> => {
  onProgress?.('Fetching database records...', 10);

  // 1. Fetch all tasks (including bin/deleted)
  const { data: tasks, error: tasksErr } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true });

  if (tasksErr) throw new Error('Failed to export tasks.');

  // 2. Fetch all status history
  const { data: history, error: histErr } = await supabase
    .from('task_status_history')
    .select('*')
    .order('changed_at', { ascending: true });

  if (histErr) throw new Error('Failed to export status history.');

  // 3. Fetch all notes
  const { data: notes, error: notesErr } = await supabase
    .from('task_notes')
    .select('*')
    .order('created_at', { ascending: true });

  if (notesErr) throw new Error('Failed to export notes.');

  // 4. Fetch all attachments metadata
  const { data: attachments, error: attachErr } = await supabase
    .from('task_attachments')
    .select('*')
    .order('uploaded_at', { ascending: true });

  if (attachErr) throw new Error('Failed to export attachments metadata.');

  onProgress?.('Preparing archive structure...', 30);

  const zip = new JSZip();
  const backupDate = new Date().toISOString();
  const dateFormatted = format(new Date(), 'dd_MMM_yyyy_HHmm');

  const rawTasks = (tasks as any[]) || [];
  const rawHistory = (history as any[]) || [];
  const rawNotes = (notes as any[]) || [];
  const rawAttachments = (attachments as any[]) || [];

  const backupPayload: BackupData = {
    metadata: {
      version: '1.0.0',
      exportDate: backupDate,
      appName: APP_NAME,
      author: DEFAULT_USER_NAME,
      counts: {
        tasks: rawTasks.length,
        statusHistory: rawHistory.length,
        notes: rawNotes.length,
        attachments: rawAttachments.length,
      },
    },
    tasks: rawTasks as Task[],
    statusHistory: rawHistory as TaskStatusHistory[],
    notes: rawNotes as TaskNote[],
    attachments: rawAttachments as TaskAttachment[],
  };

  // Add data.json to ZIP
  zip.file('data.json', JSON.stringify(backupPayload, null, 2));

  // 5. Download binary files from Supabase Storage and bundle inside attachments/
  const totalAttachments = rawAttachments.length;
  const failedAttachments: { fileName: string; path: string; error: string }[] = [];

  if (totalAttachments > 0) {
    const filesFolder = zip.folder('attachments');
    for (let i = 0; i < totalAttachments; i++) {
      const item = rawAttachments[i] as TaskAttachment;
      const progressPercent = 30 + Math.round(((i + 1) / totalAttachments) * 50);
      onProgress?.(`Archiving file ${i + 1} of ${totalAttachments}: ${item.file_name}`, progressPercent);

      try {
        const blob = await downloadAttachmentBlob(item.storage_path);
        if (filesFolder) {
          filesFolder.file(item.storage_path, blob);
        }
      } catch (fileErr: any) {
        console.warn(`Could not archive attachment ${item.file_name}:`, fileErr);
        failedAttachments.push({
          fileName: item.file_name,
          path: item.storage_path,
          error: fileErr?.message || 'Download failed',
        });
      }
    }
  }

  // If any attachments failed, include warning manifest inside zip
  if (failedAttachments.length > 0) {
    zip.file(
      'backup_warnings.json',
      JSON.stringify(
        {
          warning: 'Some attachments could not be downloaded and were omitted from this backup.',
          failedCount: failedAttachments.length,
          failedAttachments,
        },
        null,
        2
      )
    );
  }

  onProgress?.('Compressing backup archive...', 90);

  const content = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  onProgress?.('Saving backup file...', 100);
  const fileName = `MyWorkTracker_Backup_${dateFormatted}.zip`;
  saveAs(content, fileName);

  return { failedAttachments };
};

/**
 * Parses and verifies a backup file (either .zip or legacy .json)
 */
export const inspectBackupFile = async (
  file: File
): Promise<{ data: BackupData; zipInstance: JSZip | null }> => {
  if (file.name.endsWith('.json')) {
    const text = await file.text();
    const data = JSON.parse(text) as BackupData;
    if (!data.metadata || !Array.isArray(data.tasks)) {
      throw new Error('Invalid backup file format: Missing tasks array or metadata.');
    }
    return { data, zipInstance: null };
  }

  // Handle ZIP
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  const dataFile = loadedZip.file('data.json');

  if (!dataFile) {
    throw new Error('Invalid backup archive: data.json not found inside ZIP.');
  }

  const jsonText = await dataFile.async('text');
  const data = JSON.parse(jsonText) as BackupData;

  if (!data.metadata || !Array.isArray(data.tasks)) {
    throw new Error('Invalid backup archive data structure.');
  }

  return { data, zipInstance: loadedZip };
};

/**
 * Restores tasks, history, notes, and attachment files from backup
 */
export const restoreFromBackup = async (
  file: File,
  onProgress?: (msg: string, percent: number) => void
): Promise<RestoreResult> => {
  onProgress?.('Reading backup package...', 10);
  const { data, zipInstance } = await inspectBackupFile(file);

  onProgress?.(`Restoring ${data.tasks.length} tasks...`, 25);
  // 1. Upsert tasks
  if (data.tasks.length > 0) {
    const taskRows = data.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      person_name: t.person_name,
      priority: t.priority,
      status: t.status,
      created_at: t.created_at,
      due_date: t.due_date,
      started_at: t.started_at,
      completed_at: t.completed_at,
      completed_by: t.completed_by,
      created_by: t.created_by,
      updated_at: t.updated_at,
      pending_since: t.pending_since,
      is_deleted: t.is_deleted,
      deleted_at: t.deleted_at,
      deleted_by: t.deleted_by,
    }));

    const { error: taskErr } = await supabase
      .from('tasks')
      .upsert(taskRows as any, { onConflict: 'id' });

    if (taskErr) {
      console.error('Error restoring tasks:', taskErr);
      throw new Error('Failed to restore tasks to database.');
    }
  }

  onProgress?.(`Restoring ${data.statusHistory.length} history records...`, 45);
  // Clean up any initial status records created by triggers during the task upsert step
  if (data.tasks.length > 0 && data.statusHistory.length > 0) {
    const taskIds = data.tasks.map((t) => t.id);
    try {
      await supabase
        .from('task_status_history')
        .delete()
        .in('task_id', taskIds)
        .eq('remarks', 'Initial status set on task creation');
    } catch (cleanupErr) {
      console.warn('Initial trigger status history cleanup note:', cleanupErr);
    }
  }

  // 2. Upsert status history
  if (data.statusHistory.length > 0) {
    const histRows = data.statusHistory.map((h) => ({
      id: h.id,
      task_id: h.task_id,
      old_status: h.old_status,
      new_status: h.new_status,
      changed_by: h.changed_by,
      changed_at: h.changed_at,
      remarks: h.remarks,
    }));

    const { error: histErr } = await supabase
      .from('task_status_history')
      .upsert(histRows as any, { onConflict: 'id' });

    if (histErr) {
      console.error('Error restoring history:', histErr);
    }
  }

  onProgress?.(`Restoring ${data.notes.length} notes...`, 60);
  // 3. Upsert notes
  if (data.notes.length > 0) {
    const noteRows = data.notes.map((n) => ({
      id: n.id,
      task_id: n.task_id,
      note: n.note,
      created_by: n.created_by,
      created_at: n.created_at,
    }));

    const { error: noteErr } = await supabase
      .from('task_notes')
      .upsert(noteRows as any, { onConflict: 'id' });

    if (noteErr) {
      console.error('Error restoring notes:', noteErr);
    }
  }

  onProgress?.(`Restoring ${data.attachments.length} attachment records...`, 75);
  // 4. Upsert attachment metadata
  if (data.attachments.length > 0) {
    const attachRows = data.attachments.map((a) => ({
      id: a.id,
      task_id: a.task_id,
      file_name: a.file_name,
      storage_path: a.storage_path,
      file_type: a.file_type,
      file_size: a.file_size,
      uploaded_by: a.uploaded_by,
      uploaded_at: a.uploaded_at,
    }));

    const { error: attErr } = await supabase
      .from('task_attachments')
      .upsert(attachRows as any, { onConflict: 'id' });

    if (attErr) {
      console.error('Error restoring attachment metadata:', attErr);
    }
  }

  // 5. If zipInstance exists, restore binary files into Supabase Storage
  let filesRestored = 0;
  const warnings: string[] = [];

  if (zipInstance && data.attachments.length > 0) {
    const totalFiles = data.attachments.length;
    for (let i = 0; i < totalFiles; i++) {
      const att = data.attachments[i];

      // Validate storage path against path traversal attacks
      if (!SAFE_STORAGE_PATH_REGEX.test(att.storage_path)) {
        console.warn(`Skipping untrusted storage path in backup: ${att.storage_path}`);
        warnings.push(`Omitted file with unsafe path: ${att.file_name}`);
        continue;
      }

      const zippedFile = zipInstance.file(`attachments/${att.storage_path}`);
      if (zippedFile) {
        onProgress?.(
          `Uploading file to storage ${i + 1}/${totalFiles}: ${att.file_name}`,
          75 + Math.round(((i + 1) / totalFiles) * 20)
        );
        try {
          const blob = await zippedFile.async('blob');
          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(att.storage_path, blob, { upsert: true });

          if (uploadError) {
            console.warn(`Upload error for ${att.file_name}:`, uploadError);
            warnings.push(`Could not store ${att.file_name}: ${uploadError.message}`);
          } else {
            filesRestored++;
          }
        } catch (uploadErr: any) {
          console.warn(`Failed to restore storage file ${att.file_name}:`, uploadErr);
          warnings.push(`Failed to read/upload ${att.file_name}`);
        }
      }
    }
  }

  onProgress?.('Restore completed successfully!', 100);

  return {
    tasksCount: data.tasks.length,
    historyCount: data.statusHistory.length,
    notesCount: data.notes.length,
    attachmentsCount: data.attachments.length,
    filesRestored,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

