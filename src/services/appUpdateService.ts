// src/services/appUpdateService.ts

import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { APP_VERSION, APP_BUILD_CODE } from '../constants';

export interface AppRelease {
  id: string;
  version_name: string;
  version_code: number;
  release_channel?: 'stable' | 'beta';
  status?: 'draft' | 'published' | 'disabled';
  rollout_percentage?: number;
  release_notes: string | null;
  apk_url: string;
  release_url?: string;
  windows_exe_url?: string;
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
 * Detects if the current running platform is Windows Desktop (Electron).
 */
export const isWindowsApp = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    ((window as any).isElectron === true ||
      Boolean((window as any).electron) ||
      navigator.userAgent.toLowerCase().includes('electron'))
  );
};

/**
 * Validates that the APK/EXE URL is secure and matches trusted distribution sources.
 */
export function isValidApkUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return false;
    // Allow GitHub Releases for TASKER or configured domain or Supabase storage
    const isGithubRelease =
      parsed.hostname === 'github.com' &&
      parsed.pathname.includes('/khandagalesuraj48-sys/TASKER/releases/');
    const isSupabase = parsed.hostname.includes('supabase.co');
    const isBinary =
      parsed.pathname.endsWith('.apk') ||
      url.includes('.apk') ||
      parsed.pathname.endsWith('.exe') ||
      url.includes('.exe');
    return (isGithubRelease || isSupabase || isBinary) && !url.toLowerCase().includes('javascript:');
  } catch {
    return false;
  }
}

/**
 * Get the currently installed app version and versionCode.
 * On native Android, reads from PackageManager via Capacitor App plugin.
 * On Windows Desktop, reads via Electron IPC.
 * On web or in development, defaults safely to package.json metadata.
 */
function parseSemver(v: string): number[] {
  return v
    .replace(/^v/i, '')
    .split('.')
    .map((part) => parseInt(part, 10) || 0);
}

export function compareSemver(v1: string, v2: string): number {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);
  const maxLen = Math.max(p1.length, p2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Get the currently installed app version and versionCode.
 * On native Android, reads from PackageManager via Capacitor App plugin.
 * On Windows Desktop, reads via Electron IPC.
 * On web or in development, defaults safely to package.json metadata.
 */
export async function getInstalledVersion(): Promise<{ versionName: string; versionCode: number }> {
  // 1. Windows Desktop (Electron)
  if (isWindowsApp() && (window as any).electron?.getVersion) {
    try {
      const versionName = await (window as any).electron.getVersion();
      return { versionName: versionName || APP_VERSION, versionCode: APP_BUILD_CODE };
      const code = versionName === '1.0.21' ? 24 : versionName === '1.0.20' ? 23 : APP_BUILD_CODE;
      return { versionName: versionName || APP_VERSION, versionCode: code };
    } catch (e) {
      console.warn('Electron getVersion failed:', e);
    }
  }

  // 2. Native Android
  if (Capacitor.isNativePlatform()) {
    try {
      const liveInfo = await UpdatePlugin.getInstalledVersion();
      if (liveInfo && liveInfo.versionName && typeof liveInfo.versionCode === 'number') {
        return { versionName: liveInfo.versionName, versionCode: liveInfo.versionCode };
      }
    } catch (e) {
      console.warn('UpdatePlugin.getInstalledVersion failed, falling back to App.getInfo:', e);
    }

    try {
      const info = await App.getInfo();
      const versionName = info.version || APP_VERSION;
      const versionCode = Number((info as any).build) || APP_BUILD_CODE;
      return { versionName, versionCode };
    } catch (e) {
      console.warn('App.getInfo failed, using fallback version:', e);
    }
  }
  return { versionName: APP_VERSION, versionCode: APP_BUILD_CODE };
}

/**
 * Fetch the latest published production release.
 * Simple, direct, and universally reliable across Android, Windows Desktop, and Web.
 */
export async function fetchLatestRelease(): Promise<AppRelease | null> {
  if (!navigator.onLine || !isSupabaseConfigured()) {
    return null;
  }

  try {
    // 1. Direct query: fetch latest published release
    const { data, error } = await supabase
      .from('app_releases')
      .select('*')
      .eq('status', 'published')
      .order('version_code', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      version_name: data.version_name,
      version_code: Number(data.version_code),
      release_channel: 'stable',
      status: data.status || 'published',
      rollout_percentage: 100,
      release_notes: data.release_notes || '',
      apk_url: data.apk_url || data.release_url || '',
      release_url: data.release_url || data.apk_url || '',
      windows_exe_url: data.windows_exe_url || data.release_url || '',
      is_mandatory: Boolean(data.is_mandatory),
      created_at: data.created_at || new Date().toISOString(),
    };
  } catch (e) {
    console.warn('Unexpected error fetching latest release:', e);
    return null;
  }
}

/**
 * Compares installed version code or semver with latest release.
 */
export function isUpdateAvailable(
  installedCode: number,
  latest?: AppRelease | null,
  installedVersionName?: string
): boolean {
  if (!latest) return false;
  if (typeof latest.version_code === 'number' && typeof installedCode === 'number') {
    if (latest.version_code > installedCode) return true;
  }
  if (latest.version_name && installedVersionName) {
    if (compareSemver(latest.version_name, installedVersionName) > 0) return true;
  }
  return false;
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
