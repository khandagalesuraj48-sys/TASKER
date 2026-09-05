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
} from '../services/appUpdateService';

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
  const [installedVersion, setInstalledVersion] = useState<{ versionName: string; versionCode: number }>({
    versionName: '1.0.3',
    versionCode: 4,
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

  const checkForUpdate = useCallback(async () => {
    if (isCheckingRef.current || isDownloadingRef.current) {
      return;
    }

    isCheckingRef.current = true;
    setIsChecking(true);
    setError(null);

    try {
      const currentInstalled = await getInstalledVersion();
      setInstalledVersion(currentInstalled);

      const latest = await fetchLatestRelease();
      setLatestRelease(latest);

      const available = isUpdateAvailable(currentInstalled.versionCode, latest);
      setUpdateAvailable(available);

      if (available && latest) {
        // Reset dismissal if a new mandatory update is available
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
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!latestRelease || !latestRelease.apk_url) {
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

    try {
      // Check unknown sources installation permission on Android
      const canInstall = await checkCanInstallPackages();
      if (!canInstall) {
        setNeedsInstallPermission(true);
      }

      // Download APK
      const uri = await downloadApk(latestRelease.apk_url, (progress: number) => {
        setDownloadProgress(progress);
      });

      if (!uri) {
        throw new Error('APK download completed without a valid file URI.');
      }

      setDownloadUri(uri);
      setDownloadProgress(100);

      // Hand off to Android system package installer
      const launchSuccess = await installApk(uri);
      if (!launchSuccess) {
        // User may have cancelled or permission needed
        const canInstallAfter = await checkCanInstallPackages();
        if (!canInstallAfter) {
          setNeedsInstallPermission(true);
          setError('Installation permission needed: Please allow TASKER to install unknown apps.');
        }
      }
    } catch (e: any) {
      console.error('Download/install failed:', e);
      setError(e?.message || 'Download failed. Please check internet connection.');
    } finally {
      setIsDownloading(false);
      isDownloadingRef.current = false;
    }
  }, [latestRelease]);

  const openPermissionSettings = useCallback(async () => {
    await openInstallPermissionSettings();
    setNeedsInstallPermission(false);
  }, []);

  const dismissBanner = useCallback(() => {
    setIsDismissed(true);
  }, []);

  // Background/Foreground check: check on app resume if on native
  useEffect(() => {
    let appStateListener: any = null;

    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          checkForUpdate();
        }
      }).then((handle) => {
        appStateListener = handle;
      });
    }

    // Initial check after short delay to let app load
    const initialTimer = setTimeout(() => {
      checkForUpdate();
    }, 1200);

    return () => {
      clearTimeout(initialTimer);
      if (appStateListener?.remove) {
        appStateListener.remove();
      }
    };
  }, [checkForUpdate]);

  const isMandatory = Boolean(latestRelease?.is_mandatory && updateAvailable);
  const showUpdateAvailable = updateAvailable && (!isDismissed || isMandatory);

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
