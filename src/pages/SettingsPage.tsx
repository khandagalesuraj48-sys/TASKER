import React, { useState } from 'react';
import { useLocalization } from '../context/LocalizationContext';
import { exportUserDataAsJson } from '../services/privacyService';
import { Languages, ShieldCheck } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Button } from '../components/common/Button';
import { UpdateModal } from '../components/UpdateModal';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { useToast } from '../context/ToastContext';
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Smartphone,
  Sparkles,
  Globe,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const isAndroid = Capacitor.getPlatform() === 'android';
  const { showToast } = useToast();

  const {
    installedVersion,
    latestRelease,
    isUpdateAvailable,
    isMandatory,
    isChecking,
    isDownloading,
    downloadProgress,
    error: updateError,
    needsInstallPermission,
    checkForUpdate,
    downloadAndInstall,
    openPermissionSettings,
  } = useAppUpdate();

  const { language, languages, setLanguage } = useLocalization();
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);

  const handleManualCheck = async () => {
    if (!isAndroid) return;
    await checkForUpdate();
    if (!updateError) {
      showToast('Checked for updates successfully.', 'info');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Title */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          {isAndroid ? (
            <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          ) : (
            <Globe className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          )}
          <span>{isAndroid ? 'App Updates & Version' : 'App Information & Version'}</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {isAndroid
            ? 'Direct in-app Android updates and release management'
            : 'TASKER Web Application & System Information'}
        </p>
      </div>

      {/* App Updates & System Version Card (Android Only) */}
      {isAndroid ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">App Updates & Version</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Direct in-app Android updates via official system package installer
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleManualCheck}
              isLoading={isChecking}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />}
              className="text-xs font-semibold"
            >
              Check for Updates
            </Button>
          </div>

          {/* Version Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Current Version
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                v{installedVersion.versionName}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                Build {installedVersion.versionCode}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Latest Version
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {latestRelease ? `v${latestRelease.version_name}` : `v${installedVersion.versionName}`}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                {latestRelease ? `Build ${latestRelease.version_code}` : 'Latest available'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Status
              </span>
              {isChecking ? (
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking...
                </span>
              ) : isUpdateAvailable ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Update Available
                </span>
              ) : updateError ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" /> Check Network
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> You're up to date
                </span>
              )}
            </div>
          </div>

          {/* Update Available Box with What's New and Update Now */}
          {isUpdateAvailable && latestRelease && (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-950 dark:text-blue-100">
                      TASKER v{latestRelease.version_name} is ready to install
                    </span>
                    {latestRelease.is_mandatory && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 uppercase">
                        Mandatory
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                    Download the latest APK directly without USB cable or PC connection.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsUpdateModalOpen(true)}
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
                    {isDownloading ? `Downloading (${downloadProgress}%)` : 'Update Now'}
                  </Button>
                </div>
              </div>

              {latestRelease.release_notes && (
                <div className="mt-2 p-3 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/60 text-xs text-slate-700 dark:text-slate-300">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    What's New:
                  </span>
                  <p className="whitespace-pre-line leading-relaxed font-sans line-clamp-3">
                    {latestRelease.release_notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Offline / Error notice */}
          {updateError && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{updateError}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleManualCheck}
                className="text-xs shrink-0"
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Web Application & System Info Card (Web/Vercel) */
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">TASKER Web Application</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cloud-hosted deployment on Vercel
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60">
              <CheckCircle2 className="w-3.5 h-3.5" /> Always Up to Date
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Web Release
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                v{installedVersion.versionName}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                Production Web Build
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Deployment Channel
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Automated Cloud Sync
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                Updated automatically via Git/Vercel
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Language Preferences (10 Indian Languages) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Languages className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Language & Localization</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose your preferred language across 10 official Indian regional languages
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLanguage(l.code);
                showToast(`Language switched to ${l.name} (${l.nativeName})`, 'info');
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                language === l.code
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 ring-2 ring-indigo-500'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <p className="text-xs font-bold text-slate-900 dark:text-white">{l.nativeName}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{l.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Data Protection & DPDP Compliance */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Privacy & DPDP Compliance</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Data ownership, export, and right to be forgotten under the DPDP Act 2023
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Export All Account & Life Data</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Download a complete JSON archive of all tasks, notes, vehicles, bills, and family lists.</p>
          </div>
          <button
            onClick={async () => {
              const json = await exportUserDataAsJson();
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `TASKER_complete_export_${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
              showToast('Data exported successfully', 'success');
            }}
            className="px-3.5 py-2 bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Archive</span>
          </button>
        </div>
      </div>

      {/* About TASKER & Attribution */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-200">TASKER Enterprise Work Management</span>
            <span className="mx-2">•</span>
            <span>Version {installedVersion.versionName}</span>
            <span className="text-[11px] text-slate-400 ml-1.5">(Build {installedVersion.versionCode})</span>
          </div>
          <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            Developed by Suraj Khandagale | One Click Solution
          </div>
        </div>
      </div>

      {/* Manual Update Details Modal from Settings (Android Only) */}
      {isAndroid && latestRelease && (
        <UpdateModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
          currentVersion={installedVersion}
          release={latestRelease}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
          error={updateError}
          needsInstallPermission={needsInstallPermission}
          onConfirmInstall={downloadAndInstall}
          onOpenPermissionSettings={openPermissionSettings}
          isMandatory={isMandatory}
        />
      )}
    </div>
  );
};
