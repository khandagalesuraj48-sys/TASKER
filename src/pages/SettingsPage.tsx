import React, { useState } from 'react';
import { exportUserDataAsJson } from '../services/privacyService';
import { ShieldCheck } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
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

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);

  const handleManualCheck = async () => {
    if (!isAndroid) return;
    await checkForUpdate();
    if (!updateError) {
      showToast('Checked for updates successfully.', 'info');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page Title */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          {isAndroid ? (
            <Smartphone className="w-6 h-6 text-primary" />
          ) : (
            <Globe className="w-6 h-6 text-primary" />
          )}
          <span>{isAndroid ? 'App Updates & Version' : 'System Information & Settings'}</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          {isAndroid
            ? 'Direct in-app Android updates and release management'
            : 'TASKER Enterprise Platform & System Information'}
        </p>
      </div>

      {/* App Updates & System Version Card (Android Only) */}
      {isAndroid ? (
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">App Updates & Version</h3>
                  <p className="text-xs text-muted-foreground">
                    Direct in-app Android updates via official system package installer
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleManualCheck}
                disabled={isChecking}
                className="h-8 text-xs font-semibold"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isChecking ? 'animate-spin' : ''}`} />
                Check for Updates
              </Button>
            </div>

            {/* Version Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-lg bg-muted/30 border border-border">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Current Version
                </span>
                <span className="text-xs font-bold text-foreground font-mono">
                  v{installedVersion.versionName}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5 font-mono">
                  Build {installedVersion.versionCode}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-muted/30 border border-border">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Latest Version
                </span>
                <span className="text-xs font-bold text-foreground font-mono">
                  {latestRelease ? `v${latestRelease.version_name}` : `v${installedVersion.versionName}`}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5 font-mono">
                  {latestRelease ? `Build ${latestRelease.version_code}` : 'Latest available'}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-muted/30 border border-border">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Status
                </span>
                {isChecking ? (
                  <span className="text-xs font-semibold text-primary flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking...
                  </span>
                ) : isUpdateAvailable ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Update Available
                  </span>
                ) : updateError ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> Check Network
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Up to date
                  </span>
                )}
              </div>
            </div>

            {/* Update Available Box with What's New and Update Now */}
            {isUpdateAvailable && latestRelease && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        TASKER v{latestRelease.version_name} is ready to install
                      </span>
                      {latestRelease.is_mandatory && (
                        <Badge variant="destructive" className="text-[10px] uppercase">
                          Mandatory
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Download the latest APK directly without USB cable or PC connection.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsUpdateModalOpen(true)}
                      className="h-8 text-xs font-semibold bg-card"
                    >
                      What's New
                    </Button>
                    <Button
                      size="sm"
                      onClick={downloadAndInstall}
                      disabled={isDownloading}
                      className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {isDownloading ? (
                        `Downloading (${downloadProgress}%)`
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Update Now
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {latestRelease.release_notes && (
                  <div className="mt-2 p-3 rounded-lg bg-card border border-border text-xs text-foreground">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                      What's New:
                    </span>
                    <p className="whitespace-pre-line leading-relaxed font-sans line-clamp-3 text-muted-foreground">
                      {latestRelease.release_notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Offline / Error notice */}
            {updateError && (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{updateError}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManualCheck}
                  className="h-7 text-xs shrink-0"
                >
                  Retry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Web Application & System Info Card (Web/Vercel) */
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">TASKER Web Application</h3>
                  <p className="text-xs text-muted-foreground">
                    Cloud-hosted enterprise deployment
                  </p>
                </div>
              </div>
              <Badge variant="success" className="text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Always Up to Date
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg bg-muted/30 border border-border">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Web Release
                </span>
                <span className="text-xs font-bold text-foreground font-mono">
                  v{installedVersion.versionName}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Production Web Build
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-muted/30 border border-border">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Deployment Channel
                </span>
                <span className="text-xs font-bold text-foreground">
                  Automated Cloud Sync
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Continuous Integration & Delivery
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Protection & DPDP Compliance */}
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Privacy & DPDP Compliance</h3>
                <p className="text-xs text-muted-foreground">
                  Data ownership, export, and right to be forgotten under the DPDP Act 2023
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/20 border border-border">
            <div>
              <p className="text-xs font-bold text-foreground">Export All Account & Life Data</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Download a complete JSON archive of all tasks, notes, vehicles, bills, and family lists.</p>
            </div>
            <Button
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
              className="h-8 text-xs font-semibold shrink-0"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Archive
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About TASKER & Attribution */}
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              <span className="font-semibold text-foreground">TASKER Enterprise Operations Platform</span>
              <span className="mx-2">•</span>
              <span className="font-mono">v{installedVersion.versionName}</span>
              <span className="text-[11px] text-muted-foreground ml-1.5 font-mono">(Build {installedVersion.versionCode})</span>
            </div>
            <div className="text-[11px] font-medium text-muted-foreground">
              Developed by Suraj Khandagale | One Click Solution
            </div>
          </div>
        </CardContent>
      </Card>

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
