import React, { useState, useEffect, useCallback } from 'react';
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
  BellRing,
  BellOff,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import {
  checkNotificationPermissions,
  requestNotificationPermissions,
  openSystemNotificationSettings,
  openSystemExactAlarmSettings,
  getNotificationSettings,
  saveNotificationSettings,
  SystemPermissionStatus,
  TaskerNotificationSettings,
} from '../services/notificationService';

export const SettingsPage: React.FC = () => {
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

  // Notification settings & permissions
  const [permStatus, setPermStatus] = useState<SystemPermissionStatus>({
    granted: false,
    areNotificationsEnabled: false,
    canScheduleExactAlarms: true,
    displayState: 'prompt',
  });
  const [notifSettings, setNotifSettings] = useState<TaskerNotificationSettings>(getNotificationSettings());
  const [isCheckingPerms, setIsCheckingPerms] = useState<boolean>(false);

  const refreshPermissions = useCallback(async () => {
    setIsCheckingPerms(true);
    try {
      const status = await checkNotificationPermissions();
      setPermStatus(status);
    } finally {
      setIsCheckingPerms(false);
    }
  }, []);

  useEffect(() => {
    refreshPermissions();
    // Also recheck when window/tab gains focus (e.g., returning from Android Settings)
    window.addEventListener('focus', refreshPermissions);
    return () => window.removeEventListener('focus', refreshPermissions);
  }, [refreshPermissions]);

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermissions();
    setPermStatus(res);
    if (res.granted) {
      showToast('Notification permission granted!', 'success');
    } else if (res.displayState === 'blocked') {
      showToast('Notifications are blocked in Android Settings.', 'error');
    }
  };

  const handleUpdateNotifSettings = (newSettings: TaskerNotificationSettings) => {
    setNotifSettings(newSettings);
    saveNotificationSettings(newSettings);
    showToast('Notification preferences updated.', 'info');
  };

  const handleManualCheck = async () => {
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
          <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <span>Notifications & App Updates</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage native Android task notifications, reminders, and in-app APK version updates
        </p>
      </div>

      {/* 1. Notifications & Reminders Configuration Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <BellRing className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifications & Reminders</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Native Android alarms for scheduled tasks and pending summaries
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={refreshPermissions}
            isLoading={isCheckingPerms}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isCheckingPerms ? 'animate-spin' : ''}`} />}
            className="text-xs font-semibold"
          >
            Check Status
          </Button>
        </div>

        {/* Permission Status Box */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {permStatus.granted ? (
                <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : permStatus.displayState === 'blocked' ? (
                <div className="p-2 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <BellOff className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Android System Status:
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                      permStatus.granted
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                        : permStatus.displayState === 'blocked'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                    }`}
                  >
                    {permStatus.granted
                      ? 'Notifications Enabled'
                      : permStatus.displayState === 'blocked'
                      ? 'Blocked in Android Settings'
                      : 'Permission Required'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {permStatus.granted
                    ? 'Alarms will trigger even when TASKER is closed or the screen is locked.'
                    : permStatus.displayState === 'blocked'
                    ? 'Android reports all notifications from this app are blocked. Enable them in System Settings.'
                    : 'Grant notification permission so TASKER can alert you on due tasks.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!permStatus.granted && permStatus.displayState !== 'blocked' && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleRequestPermission}
                  className="text-xs"
                >
                  Request Permission
                </Button>
              )}
              <Button
                size="sm"
                variant={permStatus.displayState === 'blocked' ? 'primary' : 'outline'}
                onClick={openSystemNotificationSettings}
                leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Open Android Settings
              </Button>
            </div>
          </div>

          {/* Android 12+ Exact Alarm Restriction Notice */}
          {!permStatus.canScheduleExactAlarms && (
            <div className="mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Exact alarms are restricted. Reminders may be delayed by system battery saver.</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={openSystemExactAlarmSettings}
                className="text-xs text-amber-900 dark:text-amber-100 shrink-0"
              >
                Enable Exact Alarms
              </Button>
            </div>
          )}
        </div>

        {/* Reminders Preferences & Controls */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Notification Preferences
          </h4>

          {/* Master Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                Master Notifications Toggle
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Master switch for all task alerts and pending summaries
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifSettings.masterEnabled}
                onChange={(e) =>
                  handleUpdateNotifSettings({ ...notifSettings, masterEnabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Task Reminders Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                Individual Task Reminders
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Fire alarms configured on specific tasks (one-time, daily, custom recurrence)
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                disabled={!notifSettings.masterEnabled}
                checked={notifSettings.taskRemindersEnabled}
                onChange={(e) =>
                  handleUpdateNotifSettings({ ...notifSettings, taskRemindersEnabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-40"></div>
            </label>
          </div>

          {/* Periodic Pending Tasks Summary Toggle & Interval */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                  Periodic Pending Tasks Reminder
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Recurring nudge when you have uncompleted pending tasks
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!notifSettings.masterEnabled}
                  checked={notifSettings.pendingRemindersEnabled}
                  onChange={(e) =>
                    handleUpdateNotifSettings({ ...notifSettings, pendingRemindersEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-40"></div>
              </label>
            </div>

            {notifSettings.masterEnabled && notifSettings.pendingRemindersEnabled && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  Reminder Frequency:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: '1 hour', hours: 1 },
                    { label: '2 hours', hours: 2 },
                    { label: '4 hours', hours: 4 },
                    { label: '8 hours', hours: 8 },
                    { label: 'Daily', hours: 24 },
                  ].map((preset) => (
                    <button
                      key={preset.hours}
                      type="button"
                      onClick={() =>
                        handleUpdateNotifSettings({
                          ...notifSettings,
                          pendingReminderIntervalHours: preset.hours,
                        })
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        notifSettings.pendingReminderIntervalHours === preset.hours
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              ℹ Automatically suppresses reminders when you have 0 pending tasks.
            </p>
          </div>
        </div>
      </div>

      {/* 2. App Updates & System Version Card */}
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

      {/* Manual Update Details Modal from Settings */}
      {latestRelease && (
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
