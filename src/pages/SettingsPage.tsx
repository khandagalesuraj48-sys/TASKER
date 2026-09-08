import React, { useState } from 'react';
import { exportUserDataAsJson } from '../services/privacyService';
import { ShieldCheck, FlaskConical, Radio, AlertCircle, Info } from 'lucide-react';
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
  Monitor,
} from 'lucide-react';
import { isWindowsApp } from '../services/appUpdateService';

export const SettingsPage: React.FC = () => {
  const isAndroid = Capacitor.getPlatform() === 'android';
  const isDesktop = isWindowsApp();
  const isSupportedPlatform = isAndroid || isDesktop;
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
    userChannel,
    isBeta,
    joinBeta,
    leaveBeta,
    checkForUpdate,
    downloadAndInstall,
    openPermissionSettings,
  } = useAppUpdate();

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState<boolean>(false);
  const [channelActionLoading, setChannelActionLoading] = useState<boolean>(false);

  const handleManualCheck = async () => {
    if (!isSupportedPlatform) return;
    await checkForUpdate();
    if (!updateError) {
      showToast('Checked for updates successfully.', 'info');
    }
  };

  const handleToggleChannel = async () => {
    setChannelActionLoading(true);
    try {
      if (isBeta) {
        await leaveBeta();
        showToast('Switched to Stable channel.', 'success');
      } else {
        await joinBeta();
        showToast('Enrolled in Beta channel! Checking for pre-releases...', 'success');
      }
      setIsChannelModalOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update channel', 'error');
    } finally {
      setChannelActionLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page Title */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          {isAndroid ? (
            <Smartphone className="w-6 h-6 text-primary" />
          ) : isDesktop ? (
            <Monitor className="w-6 h-6 text-primary" />
          ) : (
            <Globe className="w-6 h-6 text-primary" />
          )}
          <span>{isSupportedPlatform ? 'App Updates & Version' : 'System Information & Settings'}</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          {isAndroid
            ? 'Direct in-app Android updates and release management'
            : isDesktop
            ? 'Direct in-app Windows Desktop updates and release management'
            : 'TASKER Enterprise Platform & System Information'}
        </p>
      </div>

      {/* Release Channel & Beta Enrollment Card */}
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isBeta
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}>
                {isBeta ? <FlaskConical className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">Release Channel</h3>
                  <Badge
                    variant={isBeta ? 'warning' : 'success'}
                    className="text-[10px] font-bold uppercase tracking-wider"
                  >
                    {isBeta ? '🧪 Beta Channel' : '🟢 Stable Channel'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isBeta
                    ? 'You are enrolled in early preview releases and testing upcoming features.'
                    : 'You are on the verified production stream with battle-tested updates.'}
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant={isBeta ? 'outline' : 'default'}
              onClick={() => setIsChannelModalOpen(true)}
              className="h-8 text-xs font-semibold shrink-0"
            >
              {isBeta ? (
                <>
                  <Radio className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  Leave Beta
                </>
              ) : (
                <>
                  <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                  Join Beta Program
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-start gap-2.5">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Channel Policy</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  Stable users never receive untested builds. Beta users receive release candidate builds first.
                </p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Downgrade Protection</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  Android and Windows prevent version rollbacks. Switching to Stable will pause updates until Stable exceeds your build.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Updates & System Version Card (Android & Windows Desktop) */}
      {isSupportedPlatform ? (
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                {isAndroid ? (
                  <Smartphone className="w-5 h-5 text-primary" />
                ) : (
                  <Monitor className="w-5 h-5 text-primary" />
                )}
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isAndroid ? 'Android App Updates & Version' : 'Windows Desktop Updates & Version'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isAndroid
                      ? 'Direct in-app Android updates via official system package installer'
                      : 'Direct in-app Windows updates with auto-installer executable'}
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
                  Eligible Release ({userChannel.toUpperCase()})
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
                      <Badge
                        variant={latestRelease.release_channel === 'beta' ? 'warning' : 'outline'}
                        className="text-[10px] uppercase font-bold"
                      >
                        {latestRelease.release_channel}
                      </Badge>
                      {latestRelease.is_mandatory && (
                        <Badge variant="destructive" className="text-[10px] uppercase">
                          Mandatory
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isAndroid
                        ? 'Download the latest APK directly without USB cable or PC connection.'
                        : 'Download and run the official Windows release (.exe) installer directly.'}
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

      {/* Manual Update Details Modal from Settings */}
      {isSupportedPlatform && latestRelease && (
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

      {/* Channel Switch Confirmation Modal */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isBeta ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
              }`}>
                {isBeta ? <ShieldCheck className="w-5 h-5" /> : <FlaskConical className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {isBeta ? 'Switch to Stable Channel' : 'Join TASKER Beta Program'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isBeta ? 'Return to official general availability' : 'Get early access to pre-release features'}
                </p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-2.5 p-3.5 rounded-lg bg-muted/30 border border-border">
              {isBeta ? (
                <>
                  <p>
                    You are currently on the <strong>Beta Channel</strong>. Switching to Stable will subscribe you exclusively to verified production releases.
                  </p>
                  <div className="p-2.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium">
                    ⚠️ <strong>Note on Android / Windows:</strong> If your installed build is newer than the current Stable release, you will remain on your current build until Stable releases a higher version code. No automatic downgrade will occur.
                  </div>
                </>
              ) : (
                <>
                  <p>
                    By joining the <strong>Beta Program</strong>, you will receive experimental builds and early previews before general release.
                  </p>
                  <p>
                    Beta builds are tested for baseline stability but may occasionally contain visual bugs or work-in-progress features. You can leave at any time.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsChannelModalOpen(false)}
                disabled={channelActionLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={handleToggleChannel}
                disabled={channelActionLoading}
                className={!isBeta ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
              >
                {channelActionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : isBeta ? (
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                ) : (
                  <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                )}
                {isBeta ? 'Confirm Switch to Stable' : 'I Understand, Join Beta'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
