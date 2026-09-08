// src/hooks/useAppUpdate.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  fetchLatestRelease,
  getInstalledVersion,
  isUpdateAvailable,
  downloadApk,
  installApk,
  checkCanInstallPackages,
  openInstallPermissionSettings,
  AppRelease,
  isWindowsApp,
} from '../services/appUpdateService';
import { APP_VERSION, APP_BUILD_CODE } from '../constants';

export interface AppUpdateState {
  installedVersion: {
    versionName: string;
    versionCode: number;
  };
  latestRelease: AppRelease | null;
  isUpdateAvailable: boolean;
  isMandatory: boolean;
  isChecking: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  error: string | null;
  downloadUri: string | null;
  needsInstallPermission: boolean;
  checkForUpdate: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  openPermissionSettings: () => Promise<void>;
  dismissBanner: () => void;
}

export const useAppUpdate = (): AppUpdateState => {
  const isAndroid = Capacitor.getPlatform() === 'android';
  const isDesktop = isWindowsApp();
  const isSupportedPlatform = isAndroid || isDesktop;

  const [installedVersion, setInstalledVersion] = useState<{ versionName: string; versionCode: number }>({
    versionName: APP_VERSION,
    versionCode: APP_BUILD_CODE,
  });
  const [latestRelease, setLatestRelease] = useState<AppRelease | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadUri, setDownloadUri] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [needsInstallPermission, setNeedsInstallPermission] = useState<boolean>(false);

  const isCheckingRef = useRef<boolean>(false);
  const isDownloadingRef = useRef<boolean>(false);

  // Initialize installed version on mount
  useEffect(() => {
    let isMounted = true;
    getInstalledVersion().then((version) => {
      if (isMounted) {
        setInstalledVersion(version);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const checkForUpdate = useCallback(
    async (resetDismissal = true) => {
      // App updates supported on Android and Windows Desktop. Never check on Web/Vercel.
      if (!isSupportedPlatform || isCheckingRef.current || isDownloadingRef.current) {
        return;
      }

      isCheckingRef.current = true;
      setIsChecking(true);

      try {
        const currentInstalled = await getInstalledVersion();
        setInstalledVersion(currentInstalled);

        const latest = await fetchLatestRelease();
        setLatestRelease(latest);

        const available = isUpdateAvailable(
          currentInstalled.versionCode,
          latest,
          currentInstalled.versionName
        );
        setUpdateAvailable(available);

        if (available && latest && resetDismissal) {
          if (latest.is_mandatory) {
            setIsDismissed(false);
          }
        }
      } catch (e: any) {
        console.warn('Update check failed:', e);
        setError(e?.message || 'Failed to check for updates. Please check your network connection.');
      } finally {
        setIsChecking(false);
        isCheckingRef.current = false;
      }
    },
    [isSupportedPlatform]
  );

  const downloadAndInstall = useCallback(async () => {
    if (!isSupportedPlatform) {
      return;
    }

    if (!latestRelease || (!latestRelease.apk_url && !latestRelease.release_url)) {
      setError('No valid release URL available to download.');
      return;
    }

    if (isDownloadingRef.current) {
      return;
    }

    isDownloadingRef.current = true;
    setIsDownloading(true);
    setError(null);
    setDownloadProgress(0);

    // Handle Windows Desktop Update via Electron
    if (isDesktop && (window as any).electron?.downloadUpdate) {
      try {
        const exeUrl =
          (latestRelease as any).windows_exe_url ||
          latestRelease.release_url ||
          `https://xargfforwknnicudigxs.supabase.co/storage/v1/object/public/app-releases/TASKER-Setup-${latestRelease.version_name}.exe`;

        // Subscribe to download progress from Electron
        const unsubscribe = (window as any).electron.onUpdateProgress?.((pct: number) => {
          setDownloadProgress(pct);
        });

        const downloadedPath = await (window as any).electron.downloadUpdate(exeUrl);
        if (unsubscribe) unsubscribe();
        setDownloadProgress(100);

        // Hand off to installer and exit
        await (window as any).electron.installUpdate(downloadedPath);
      } catch (e: any) {
        console.error('Desktop download/install error:', e);
        // Fallback: open release page in browser
        window.open(latestRelease.release_url || latestRelease.apk_url, '_blank');
        setError(e?.message || 'Download error. Opening release download page.');
      } finally {
        setIsDownloading(false);
        isDownloadingRef.current = false;
      }
      return;
    }

    try {
      // 1. Check unknown sources installation permission on Android before downloading
      const canInstall = await checkCanInstallPackages();
      if (!canInstall) {
        setNeedsInstallPermission(true);
        setError('Permission required: Please allow TASKER to install unknown apps in settings.');
        setIsDownloading(false);
        isDownloadingRef.current = false;
        return;
      }

      // 2. Download APK with progress
      const uri = await downloadApk(latestRelease.apk_url, (progress: number) => {
        setDownloadProgress(progress);
      });

      if (!uri) {
        throw new Error('APK download completed without a valid file URI.');
      }

      setDownloadUri(uri);
      setDownloadProgress(100);

      // 3. Mark pending install attempt before launching system installer
      sessionStorage.setItem('tasker_pending_update_code', String(latestRelease.version_code));
      sessionStorage.setItem('tasker_pending_update_version', latestRelease.version_name);
      sessionStorage.setItem('tasker_pending_update_time', String(Date.now()));

      // 4. Hand off to Android system package installer
      const launchResult = await installApk(uri);
      if (launchResult.needsPermission) {
        setNeedsInstallPermission(true);
        setError(launchResult.error || 'Permission needed: Please allow TASKER to install unknown apps.');
        sessionStorage.removeItem('tasker_pending_update_code');
      } else if (!launchResult.success || !launchResult.installerLaunched) {
        setError(launchResult.error || 'Failed to start Android package installer.');
        sessionStorage.removeItem('tasker_pending_update_code');
      } else {
        // Installer launched successfully
        setError(null);
      }
    } catch (e: any) {
      console.error('Download/install failed:', e);
      sessionStorage.removeItem('tasker_pending_update_code');
      setError(e?.message || 'Download failed. Please check internet connection.');
    } finally {
      setIsDownloading(false);
      isDownloadingRef.current = false;
    }
  }, [isAndroid, isDesktop, latestRelease]);

  const openPermissionSettings = useCallback(async () => {
    if (!isAndroid) return;
    await openInstallPermissionSettings();
    setNeedsInstallPermission(false);
  }, [isAndroid]);

  const dismissBanner = useCallback(() => {
    setIsDismissed(true);
  }, []);

  // Background/Foreground check: check on app resume if on native Android or Desktop
  useEffect(() => {
    if (!isSupportedPlatform) {
      return;
    }

    let appStateListener: any = null;

    const handleResume = async () => {
      // 1. Re-check actual installed version
      const currentInstalled = await getInstalledVersion();
      setInstalledVersion(currentInstalled);

      // 2. Check if an install attempt was recently launched (Android)
      if (isAndroid) {
        const pendingCodeStr = sessionStorage.getItem('tasker_pending_update_code');
        if (pendingCodeStr) {
          const pendingCode = parseInt(pendingCodeStr, 10);
          const pendingVersion = sessionStorage.getItem('tasker_pending_update_version') || '';
          sessionStorage.removeItem('tasker_pending_update_code');
          sessionStorage.removeItem('tasker_pending_update_version');
          sessionStorage.removeItem('tasker_pending_update_time');

          if (currentInstalled.versionCode >= pendingCode) {
            // Success: The APK was installed and the app is now at target version!
            setUpdateAvailable(false);
            setError(null);
            setIsDismissed(false);
          } else {
            // Failed or Cancelled: Returned to app, but still running older version
            setError(
              `Update to v${pendingVersion || '1.0.22'} was not installed. If Android cancelled the update, please enable "Install unknown apps" in Settings and try again.`
            );
            // PREVENT UPDATE LOOP: Dismiss modal so user isn't trapped in an infinite modal popup
            setIsDismissed(true);
          }
        }
      }

      // 3. Re-check remote update availability without re-popping dismissed modal
      checkForUpdate(false);
    };

    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          handleResume();
        }
      }).then((handle) => {
        appStateListener = handle;
      });
    }

    // Initial check after short delay to let app load
    const initialTimer = setTimeout(() => {
      checkForUpdate(true);
    }, 1200);

    return () => {
      clearTimeout(initialTimer);
      if (appStateListener?.remove) {
        appStateListener.remove();
      }
    };
  }, [checkForUpdate, isSupportedPlatform, isAndroid]);

  const isMandatory = Boolean(isSupportedPlatform && latestRelease?.is_mandatory && updateAvailable);
  const showUpdateAvailable = Boolean(
    isSupportedPlatform && updateAvailable && (!isDismissed || (isMandatory && !error))
  );

  return {
    installedVersion,
    latestRelease,
    isUpdateAvailable: showUpdateAvailable,
    isMandatory,
    isChecking,
    isDownloading,
    downloadProgress,
    error,
    downloadUri,
    needsInstallPermission,
    checkForUpdate,
    downloadAndInstall,
    openPermissionSettings,
    dismissBanner,
  };
};
