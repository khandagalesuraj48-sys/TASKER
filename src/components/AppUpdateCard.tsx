// src/components/AppUpdateCard.tsx

import React, { useState } from 'react';
import { Button } from './common/Button';
import { UpdateModal } from './UpdateModal';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { Sparkles, Download } from 'lucide-react';

/**
 * Non-blocking banner displayed when a newer APK version is available.
 * Can be dismissed for the session, or clicked to view release notes / install.
 * If mandatory, automatically displays the modal.
 */
export const AppUpdateCard: React.FC = () => {
  const {
    installedVersion,
    latestRelease,
    isUpdateAvailable,
    isMandatory,
    isDownloading,
    downloadProgress,
    error,
    needsInstallPermission,
    downloadAndInstall,
    openPermissionSettings,
    dismissBanner,
  } = useAppUpdate();

  const [modalOpen, setModalOpen] = useState(false);

  if (!isUpdateAvailable || !latestRelease) {
    return null;
  }

  return (
    <>
      <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-r from-blue-50 via-indigo-50/40 to-blue-50/20 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-slate-900 p-4 mb-5 shadow-sm transition-all animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  Update Available
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/70 text-blue-700 dark:text-blue-300">
                  v{latestRelease.version_name}
                </span>
                {isMandatory && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 uppercase">
                    Required
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-1">
                {latestRelease.release_notes
                  ? latestRelease.release_notes.split('\n')[0]
                  : 'New features and improvements are available.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {!isMandatory && (
              <button
                onClick={dismissBanner}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
              >
                Later
              </button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setModalOpen(true)}
              className="text-xs"
            >
              What's New
            </Button>

            <Button
              size="sm"
              variant="primary"
              onClick={downloadAndInstall}
              isLoading={isDownloading}
              leftIcon={!isDownloading ? <Download className="w-3.5 h-3.5" /> : undefined}
              className="text-xs shadow-sm"
            >
              {isDownloading ? `${downloadProgress}%` : 'Update'}
            </Button>
          </div>
        </div>
      </div>

      {/* Detail & Installation Modal */}
      {(modalOpen || isMandatory) && (
        <UpdateModal
          isOpen={modalOpen || isMandatory}
          onClose={() => setModalOpen(false)}
          currentVersion={installedVersion}
          release={latestRelease}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
          error={error}
          needsInstallPermission={needsInstallPermission}
          onConfirmInstall={downloadAndInstall}
          onOpenPermissionSettings={openPermissionSettings}
          isMandatory={isMandatory}
        />
      )}
    </>
  );
};
