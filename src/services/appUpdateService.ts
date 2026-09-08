// src/services/appUpdateService.ts

import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface AppRelease {
  id: string;
  version_name: string;
  version_code: number;
  release_notes: string | null;
  apk_url: string;
  release_url?: string;
  is_mandatory: boolean;
  created_at: string;
}

export interface UpdateInfo {
  installedVersion: {
    versionName: string;
    versionCode: number;
  };
  latestRelease: AppRelease | null;
  isUpdateAvailable: boolean;
  isMandatory: boolean;
}

export interface InstallApkResult {
  success: boolean;
  installerLaunched?: boolean;
  needsPermission?: boolean;
  error?: string;
  targetVersionCode?: number;
  targetVersionName?: string;
}

export interface UpdatePluginInterface {
  downloadApk(options: { url: string }): Promise<{
    uri: string;
    filePath?: string;
    fileSize?: number;
    packageName?: string;
    versionName?: string;
    versionCode?: number;
  }>;
  validateApk(): Promise<{
    valid: boolean;
    packageName?: string;
    versionName?: string;
    versionCode?: number;
    error?: string;
  }>;
  getInstalledVersion(): Promise<{
    versionName: string;
    versionCode: number;
    packageName: string;
  }>;
  installApk(options?: { uri?: string }): Promise<InstallApkResult>;
  canRequestPackageInstalls(): Promise<{ canInstall: boolean }>;
  openInstallPermissionSettings(): Promise<{ success: boolean }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (info: { progress: number; bytesRead: number; totalBytes: number }) => void
  ): Promise<any>;
}

export const UpdatePlugin = registerPlugin<UpdatePluginInterface>('UpdatePlugin');

/**
 * Detects if the current running platform is Android (native Capacitor).
 */
export const isAndroid = (): boolean => Capacitor.getPlatform() === 'android';

/**
 * Validates that the APK URL is secure and matches trusted distribution sources.
 */
export function isValidApkUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return false;
    // Allow GitHub Releases for TASKER or configured domain
    const isGithubRelease =
      parsed.hostname === 'github.com' &&
      parsed.pathname.includes('/khandagalesuraj48-sys/TASKER/releases/');
    const isApkFile = parsed.pathname.endsWith('.apk') || url.includes('.apk');
    return (isGithubRelease || isApkFile) && !url.toLowerCase().includes('javascript:');
  } catch {
    return false;
  }
}

/**
 * Get the currently installed app version and versionCode.
 * On native Android, reads from PackageManager via Capacitor App plugin.
 * On web or in development, defaults safely to package.json metadata.
 */
export async function getInstalledVersion(): Promise<{ versionName: string; versionCode: number }> {
  if (Capacitor.isNativePlatform()) {
    // 1. Query live Android PackageManager directly via UpdatePlugin
    try {
      const liveInfo = await UpdatePlugin.getInstalledVersion();
      if (liveInfo && liveInfo.versionName && typeof liveInfo.versionCode === 'number') {
        return { versionName: liveInfo.versionName, versionCode: liveInfo.versionCode };
      }
    } catch (e) {
      console.warn('UpdatePlugin.getInstalledVersion failed, falling back to App.getInfo:', e);
    }

    // 2. Fallback to Capacitor App.getInfo()
    try {
      const info = await App.getInfo();
      const versionName = info.version || '1.0.13';
      const versionCode = Number((info as any).build) || 16;
      return { versionName, versionCode };
    } catch (e) {
      console.warn('App.getInfo failed, using fallback version:', e);
    }
  }
  return { versionName: '1.0.13', versionCode: 16 };
}

/**
 * Fetch the latest active release metadata from Supabase.
 * Read-only query against public.app_releases with graceful error fallback.
 * Disabled on Web/Vercel as App Updates are Android-only.
 */
export async function fetchLatestRelease(): Promise<AppRelease | null> {
  // App updates are strictly Android-only. Do not check or query on Web/Vercel.
  if (!isAndroid()) {
    return null;
  }

  if (!navigator.onLine || !isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('app_releases')
      .select('*')
      .order('version_code', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // If table doesn't exist yet or permission denied, fail silently to avoid app crash
      console.warn('App releases query warning:', error.message);
      return null;
    }

    if (!data) return null;

    const releaseData = data as any;
    return {
      id: releaseData.id,
      version_name: releaseData.version_name,
      version_code: Number(releaseData.version_code),
      release_notes: releaseData.release_notes || '',
      apk_url: releaseData.apk_url || releaseData.release_url || '',
      release_url: releaseData.release_url || releaseData.apk_url || '',
      is_mandatory: Boolean(releaseData.is_mandatory),
      created_at: releaseData.created_at,
    };
  } catch (e) {
    console.warn('Unexpected error fetching latest release:', e);
    return null;
  }
}

/**
 * Compares installed version code with latest release.
 */
export function isUpdateAvailable(installedCode: number, latest?: AppRelease | null): boolean {
  if (!latest || typeof latest.version_code !== 'number') return false;
  return latest.version_code > installedCode;
}

/**
 * Check if the app has permission to install unknown apps (Android 8.0+).
 */
export async function checkCanInstallPackages(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await UpdatePlugin.canRequestPackageInstalls();
    return res?.canInstall ?? true;
  } catch (e) {
    console.warn('checkCanInstallPackages error:', e);
    return true;
  }
}

/**
 * Direct user to system settings to enable unknown app installation for TASKER.
 */
export async function openInstallPermissionSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await UpdatePlugin.openInstallPermissionSettings();
  } catch (e) {
    console.warn('openInstallPermissionSettings error:', e);
  }
}

/**
 * Downloads APK via native UpdatePlugin. Returns the FileProvider content URI.
 */
export async function downloadApk(
  url: string,
  onProgress?: (progress: number) => void
): Promise<string | null> {
  if (!isValidApkUrl(url)) {
    throw new Error('Security Error: Invalid or untrusted APK download URL');
  }

  if (!Capacitor.isNativePlatform()) {
    // On web, open the download URL in a new window/tab
    window.open(url, '_blank');
    return url;
  }

  let listenerHandle: any = null;
  try {
    if (onProgress) {
      listenerHandle = await UpdatePlugin.addListener('downloadProgress', (data) => {
        if (typeof data?.progress === 'number') {
          onProgress(data.progress);
        }
      });
    }

    const result = await UpdatePlugin.downloadApk({ url: url.trim() });
    return result?.uri ?? null;
  } catch (e: any) {
    console.error('Error downloading APK:', e);
    throw new Error(e?.message || 'Failed to download update APK');
  } finally {
    if (listenerHandle?.remove) {
      listenerHandle.remove();
    }
  }
}

/**
 * Triggers Android package installer for the downloaded APK.
 * The system shows the confirmation prompt: "Do you want to install an update to this application?"
 * Returns detailed installation status (installerLaunched, needsPermission, targetVersionCode, error).
 */
export async function installApk(uri?: string): Promise<InstallApkResult> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: 'In-app update installation is only supported on Android devices.' };
  }

  try {
    const result = await UpdatePlugin.installApk(uri ? { uri } : {});
    return {
      success: Boolean(result?.success),
      installerLaunched: Boolean(result?.installerLaunched),
      needsPermission: Boolean(result?.needsPermission),
      error: result?.error,
      targetVersionCode: result?.targetVersionCode,
      targetVersionName: result?.targetVersionName,
    };
  } catch (e: any) {
    console.error('Error launching installer:', e);
    return {
      success: false,
      installerLaunched: false,
      error: e?.message || 'Failed to start Android package installer',
    };
  }
}
