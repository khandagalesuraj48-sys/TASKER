import React, { useState, useRef } from 'react';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import {
  generateFullBackup,
  inspectBackupFile,
  restoreFromBackup,
  RestoreResult,
} from '../services/backupService';
import { useToast } from '../context/ToastContext';
import { useTask } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import {
  Download,
  Upload,
  Database,
  FileArchive,
  CheckCircle2,
  AlertTriangle,
  FileText,
  HardDrive,
  Copy,
  LogOut,
  UserCheck,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { isConfigured, triggerRefresh } = useTask();
  const { user, userEmail, displayName, signOut } = useAuth();
  const { showToast } = useToast();

  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [backupProgress, setBackupProgress] = useState<{ status: string; percent: number }>({
    status: '',
    percent: 0,
  });

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<any | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreProgress, setRestoreProgress] = useState<{ status: string; percent: number }>({
    status: '',
    percent: 0,
  });
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState<boolean>(false);
  const [restoreSummary, setRestoreSummary] = useState<RestoreResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Backup Handler
  const handleBackupNow = async () => {
    setIsBackingUp(true);
    setBackupProgress({ status: 'Initiating backup...', percent: 5 });
    try {
      const result = await generateFullBackup((status: string, percent: number) => {
        setBackupProgress({ status, percent });
      });
      if (result.failedAttachments.length > 0) {
        showToast(
          `Backup created with warnings: ${result.failedAttachments.length} attachments could not be downloaded. Check backup_warnings.json inside ZIP.`,
          'warning'
        );
      } else {
        showToast('Backup archive generated and downloaded successfully!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Backup failed. Please try again.', 'error');
    } finally {
      setIsBackingUp(false);
      setBackupProgress({ status: '', percent: 0 });
    }
  };

  // Inspect Selected File for Restore
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setRestoreFile(file);

    try {
      const { data } = await inspectBackupFile(file);
      setRestorePreview(data);
    } catch (err: any) {
      showToast(err.message || 'Invalid backup file.', 'error');
      setRestoreFile(null);
      setRestorePreview(null);
    }
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!restoreFile) return;
    setRestoreConfirmOpen(false);
    setIsRestoring(true);
    setRestoreProgress({ status: 'Starting restore...', percent: 5 });

    try {
      const result = await restoreFromBackup(restoreFile, (status: string, percent: number) => {
        setRestoreProgress({ status, percent });
      });
      setRestoreSummary(result);
      if (result.warnings && result.warnings.length > 0) {
        showToast(`Restore completed with ${result.warnings.length} warning(s).`, 'warning');
      } else {
        showToast('Data restored from backup successfully!', 'success');
      }
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to restore backup.', 'error');
    } finally {
      setIsRestoring(false);
      setRestoreProgress({ status: '', percent: 0 });
    }
  };

  const copyMigrationPath = () => {
    navigator.clipboard.writeText('supabase/migrations/001_initial_schema.sql');
    showToast('Migration path copied to clipboard!', 'info');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Title */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <span>Settings & Backup Management</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage system identity, full offline ZIP backups, data restoration, and database connection
        </p>
      </div>

      {/* Supabase Connection Status Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1527] p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Database & Backend Status</h3>
          </div>
          {isConfigured ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Supabase Connected</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Credentials Incomplete</span>
            </span>
          )}
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3">
          <p>
            <strong>My Work Tracker</strong> utilizes <strong>Supabase PostgreSQL</strong> for relational
            data integrity, status history tracking, and <strong>Supabase Storage</strong> for attached documents.
          </p>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">SQL Migration File:</span>
              <button
                onClick={copyMigrationPath}
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-sans text-xs"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Path</span>
              </button>
            </div>
            <code className="text-slate-800 dark:text-slate-200 block bg-white dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800">
              supabase/migrations/001_initial_schema.sql
            </code>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Run this migration once in your Supabase SQL Editor to automatically create all tables,
            triggers, indexes, and configure the <code className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-1 py-0.5 rounded">task-attachments</code> storage bucket.
          </p>
        </div>
      </div>

      {/* Authenticated User Account Section */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1527] p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Authenticated Account</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All tasks, notes, history, reminders, and attachments are strictly isolated to this account.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => signOut()}
            leftIcon={<LogOut className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
            className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/50"
          >
            Sign Out
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Account Email
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 break-all">
              {userEmail || 'Not available'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Display Name
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {displayName || 'User'}
            </span>
          </div>

          <div className="sm:col-span-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Security Identity (auth.uid)
            </span>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400 break-all select-all">
              {user?.id || 'Unauthenticated'}
            </span>
          </div>
        </div>
      </div>

      {/* Backup System Section */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1527] p-6 shadow-2xs space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileArchive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Manual Backup & Archiving</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Create an offline, portable archive containing all tasks, status history, notes, and downloaded binary documents.
          </p>
        </div>

        {/* Backup Now Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Create Full System Backup
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
              Downloads all database records and storage files into a single timestamped ZIP package.
            </p>
          </div>

          <Button
            size="md"
            onClick={handleBackupNow}
            isLoading={isBackingUp}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Backup Now
          </Button>
        </div>

        {/* Backup Progress */}
        {isBackingUp && (
          <div className="space-y-2 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs">
            <div className="flex justify-between font-semibold text-blue-900 dark:text-blue-200">
              <span>{backupProgress.status}</span>
              <span>{backupProgress.percent}%</span>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-950 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${backupProgress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Restore Backup Section */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1527] p-6 shadow-2xs space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Restore Backup</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Restore previously exported data and documents into your Supabase database.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Select Backup Archive (.zip or .json)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Choose a backup file previously generated by "Backup Now".
              </p>
            </div>

            <Button
              variant="outline"
              size="md"
              onClick={() => fileInputRef.current?.click()}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Choose Backup File
            </Button>
          </div>

          {/* Inspect / Preview Card */}
          {restoreFile && restorePreview && (
            <div className="mt-4 p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{restoreFile.name}</span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Exported: {restorePreview.metadata?.exportDate?.substring(0, 10) || 'Unknown'}
                </span>
              </div>

              {/* Statistics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200">
                  Tasks: <strong>{restorePreview.tasks?.length || 0}</strong>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200">
                  Status History: <strong>{restorePreview.statusHistory?.length || 0}</strong>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200">
                  Notes: <strong>{restorePreview.notes?.length || 0}</strong>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200">
                  Attachments: <strong>{restorePreview.attachments?.length || 0}</strong>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setRestoreConfirmOpen(true)}
                  isLoading={isRestoring}
                >
                  Restore From This Backup
                </Button>
              </div>
            </div>
          )}

          {/* Restore Progress Bar */}
          {isRestoring && (
            <div className="space-y-2 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs">
              <div className="flex justify-between font-semibold text-emerald-900 dark:text-emerald-200">
                <span>{restoreProgress.status}</span>
                <span>{restoreProgress.percent}%</span>
              </div>
              <div className="w-full bg-emerald-200 dark:bg-emerald-950 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${restoreProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Restore Completion Summary */}
          {restoreSummary && (
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>Restoration Completed!</span>
              </div>
              <p>
                Successfully restored {restoreSummary.tasksCount} tasks, {restoreSummary.historyCount} status
                events, {restoreSummary.notesCount} notes, and {restoreSummary.filesRestored} binary files.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        isOpen={restoreConfirmOpen}
        onClose={() => setRestoreConfirmOpen(false)}
        onConfirm={handleExecuteRestore}
        title="Confirm Backup Restoration"
        message={`Are you sure you want to restore data from "${restoreFile?.name}"?
Existing records matching IDs in the backup will be updated, and any missing attached files will be uploaded back into Supabase Storage.`}
        confirmText="Confirm & Restore"
        variant="warning"
        isLoading={isRestoring}
      />
    </div>
  );
};

