// src/components/UpdateModal.tsx

import React, { useEffect } from 'react';
import { Button } from './common/Button';
import { AppRelease } from '../services/appUpdateService';
import { backHandlerService } from '../services/backHandlerService';
import {
  Download,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Calendar,
  Settings,
  X,
} from 'lucide-react';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: {
    versionName: string;
    versionCode: number;
  };
  release: AppRelease;
  isDownloading: boolean;
  downloadProgress: number;
  error: string | null;
  needsInstallPermission?: boolean;
  onConfirmInstall: () => void;
  onOpenPermissionSettings?: () => void;
  isMandatory?: boolean;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  currentVersion,
  release,
  isDownloading,
  downloadProgress,
  error,
  needsInstallPermission = false,
  onConfirmInstall,
  onOpenPermissionSettings,
  isMandatory = false,
}) => {
  // Register Android back button handling
  useEffect(() => {
    if (!isOpen) return;

    // If mandatory, we still intercept back press to prevent dismissing
    const cleanup = backHandlerService.register(
      'update-modal',
      () => {
        if ((!isMandatory || Boolean(error)) && !isDownloading) {
          onClose();
          return true;
        }
        // Consumed back press to prevent backing out of mandatory update when actively updating
        return true;
      },
      60
    );

    return cleanup;
  }, [isOpen, isMandatory, isDownloading, onClose]);

  if (!isOpen) return null;

  const formattedDate = release.created_at
    ? new Date(release.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`p-6 border-b ${
            isMandatory
              ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50'
              : 'bg-gradient-to-br from-blue-50/80 to-indigo-50/40 dark:from-blue-950/30 dark:to-slate-900 border-slate-100 dark:border-slate-800'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                  isMandatory
                    ? 'bg-rose-600 text-white shadow-rose-500/20'
                    : 'bg-blue-600 text-white shadow-blue-500/20'
                }`}
              >
                {isMandatory ? (
                  <ShieldAlert className="w-6 h-6" />
                ) : (
                  <Sparkles className="w-6 h-6" />
                )}
              </div>
              <div>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider block ${
                    isMandatory
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {isMandatory ? 'Required Update' : 'New Version Available'}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  TASKER v{release.version_name}
                </h3>
              </div>
            </div>

            {(!isMandatory || Boolean(error)) && !isDownloading && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Version comparison row */}
          <div className="mt-4 flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
            <div className="flex-1 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Current</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">
                v{currentVersion.versionName}
              </span>
            </div>
            <span className="text-slate-400 font-bold">→</span>
            <div className="flex-1 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900/60">
              <span className="text-[10px] text-blue-500 block uppercase font-semibold">Latest</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                v{release.version_name} (Build {release.version_code})
              </span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {formattedDate && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>Released on {formattedDate}</span>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
              What's New in this Release:
            </h4>
            <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line font-sans">
              {release.release_notes || 'General performance improvements and bug fixes.'}
            </div>
          </div>

          {/* Downloading state */}
          {isDownloading && (
            <div className="space-y-2 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60">
              <div className="flex justify-between items-center text-xs font-semibold text-blue-900 dark:text-blue-200">
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4 animate-bounce" />
                  <span>Downloading update package...</span>
                </span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-950 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-200"
                  style={{ width: `${Math.max(downloadProgress, 5)}%` }}
                />
              </div>
              <p className="text-[11px] text-blue-600 dark:text-blue-300">
                The official Android package installer will prompt you to confirm installation once downloaded.
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <p className="font-semibold">Update Notice</p>
                <p className="text-[11px] leading-relaxed">{error}</p>
                {release.apk_url && (
                  <div className="pt-1">
                    <a
                      href={release.apk_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold underline hover:text-blue-700"
                    >
                      Download APK directly via browser
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Unknown sources permission required hint */}
          {needsInstallPermission && onOpenPermissionSettings && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <Settings className="w-4 h-4" />
                <span>Permission Needed</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Android requires permission to install updates directly from TASKER.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenPermissionSettings}
                className="w-full text-xs font-semibold"
              >
                Open System Settings
              </Button>
            </div>
          )}

          <div className="text-[11px] text-slate-400 leading-relaxed">
            Note: TASKER never installs updates automatically. Android will present the official system verification prompt for you to manually confirm.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          {(!isMandatory || Boolean(error)) && !isDownloading && (
            <Button variant="secondary" size="md" onClick={onClose}>
              {error ? 'Close' : 'Later'}
            </Button>
          )}

          <Button
            variant={isMandatory ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirmInstall}
            isLoading={isDownloading}
            leftIcon={!isDownloading ? <Download className="w-4 h-4" /> : undefined}
          >
            {isDownloading ? `Downloading (${downloadProgress}%)` : error ? 'Try Again' : 'Install Update'}
          </Button>
        </div>
      </div>
    </div>
  );
};

