package com.oneclicksolution.tasker;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "UpdatePlugin")
public class UpdatePlugin extends Plugin {
    private static final String TAG = "UpdatePlugin";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private static class ApkValidationResult {
        boolean isValid;
        String error;
        String packageName;
        String versionName;
        long versionCode;
    }

    /**
     * Helper to get canonical file location for downloaded update APKs.
     * Uses app's cache directory under an updates subfolder.
     */
    private File getUpdateApkFile() {
        Context context = getContext();
        File baseDir = context.getExternalCacheDir();
        if (baseDir == null) {
            baseDir = context.getCacheDir();
        }
        File updateDir = new File(baseDir, "updates");
        if (!updateDir.exists()) {
            updateDir.mkdirs();
        }
        return new File(updateDir, "update.apk");
    }

    /**
     * Inspects and validates the downloaded APK file before installation.
     * Verifies that the APK is non-empty, parseable by PackageManager,
     * matches the exact expected applicationId (com.oneclicksolution.tasker),
     * and has a versionCode strictly greater than the currently installed app version.
     */
    private ApkValidationResult validateApkFile(File apkFile) {
        ApkValidationResult result = new ApkValidationResult();
        if (apkFile == null || !apkFile.exists() || apkFile.length() == 0) {
            result.isValid = false;
            result.error = "Update APK file does not exist or is empty.";
            return result;
        }

        Context context = getContext();
        PackageManager pm = context.getPackageManager();
        PackageInfo apkInfo = null;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                apkInfo = pm.getPackageArchiveInfo(
                        apkFile.getAbsolutePath(),
                        PackageManager.PackageInfoFlags.of(PackageManager.GET_ACTIVITIES | PackageManager.GET_META_DATA)
                );
            } else {
                apkInfo = pm.getPackageArchiveInfo(
                        apkFile.getAbsolutePath(),
                        PackageManager.GET_ACTIVITIES | PackageManager.GET_META_DATA
                );
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to parse APK archive info", e);
        }

        if (apkInfo == null) {
            result.isValid = false;
            result.error = "Downloaded file is corrupted or not a valid Android APK package.";
            return result;
        }

        result.packageName = apkInfo.packageName;
        result.versionName = apkInfo.versionName != null ? apkInfo.versionName : "";
        result.versionCode = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
                ? apkInfo.getLongVersionCode()
                : apkInfo.versionCode;

        String expectedPackage = context.getPackageName();
        if (result.packageName == null || !result.packageName.equals(expectedPackage)) {
            result.isValid = false;
            result.error = "Security validation error: APK package name mismatch (found: "
                    + result.packageName + ", expected: " + expectedPackage + ").";
            return result;
        }

        // Compare against currently installed version
        try {
            PackageInfo installedInfo = pm.getPackageInfo(expectedPackage, 0);
            long currentVersionCode = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
                    ? installedInfo.getLongVersionCode()
                    : installedInfo.versionCode;

            if (result.versionCode <= currentVersionCode) {
                result.isValid = false;
                result.error = "Downloaded APK version code (" + result.versionCode
                        + ") is not newer than currently installed version (" + currentVersionCode + ").";
                return result;
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not determine current installed version code: " + e.getMessage());
        }

        result.isValid = true;
        return result;
    }

    /**
     * Returns the currently installed version name and version code
     * directly from Android's PackageManager.
     */
    @PluginMethod
    public void getInstalledVersion(PluginCall call) {
        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            PackageInfo pinfo = pm.getPackageInfo(context.getPackageName(), 0);
            long versionCode = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
                    ? pinfo.getLongVersionCode()
                    : pinfo.versionCode;

            JSObject result = new JSObject();
            result.put("versionName", pinfo.versionName != null ? pinfo.versionName : "1.0.5");
            result.put("versionCode", versionCode);
            result.put("packageName", pinfo.packageName);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get installed version", e);
            call.reject("Failed to get installed version: " + e.getMessage());
        }
    }

    /**
     * Validates the currently cached update APK.
     */
    @PluginMethod
    public void validateApk(PluginCall call) {
        File apkFile = getUpdateApkFile();
        ApkValidationResult validation = validateApkFile(apkFile);

        JSObject result = new JSObject();
        result.put("valid", validation.isValid);
        if (validation.isValid) {
            result.put("packageName", validation.packageName);
            result.put("versionName", validation.versionName);
            result.put("versionCode", validation.versionCode);
        } else {
            result.put("error", validation.error);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.trim().isEmpty()) {
            call.reject("Missing 'url' parameter");
            return;
        }

        executor.execute(() -> {
            HttpURLConnection connection = null;
            InputStream inputStream = null;
            FileOutputStream outputStream = null;

            try {
                String currentUrl = urlString;
                int redirects = 0;
                final int MAX_REDIRECTS = 10;

                // Follow HTTP/HTTPS redirects (e.g. GitHub Releases -> AWS S3)
                while (redirects < MAX_REDIRECTS) {
                    URL url = new URL(currentUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setInstanceFollowRedirects(true);
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(30000);
                    connection.setRequestProperty("User-Agent", "TASKER-Android-Updater");

                    int responseCode = connection.getResponseCode();
                    if (responseCode == HttpURLConnection.HTTP_MOVED_PERM
                            || responseCode == HttpURLConnection.HTTP_MOVED_TEMP
                            || responseCode == HttpURLConnection.HTTP_SEE_OTHER
                            || responseCode == 307
                            || responseCode == 308) {
                        String newLocation = connection.getHeaderField("Location");
                        if (newLocation != null && !newLocation.isEmpty()) {
                            currentUrl = newLocation;
                            connection.disconnect();
                            redirects++;
                            continue;
                        }
                    }

                    if (responseCode != HttpURLConnection.HTTP_OK) {
                        call.reject("Download server returned HTTP " + responseCode);
                        return;
                    }

                    break;
                }

                if (connection == null) {
                    call.reject("Failed to connect to update server");
                    return;
                }

                long fileLength = connection.getContentLengthLong();
                Context context = getContext();
                File apkFile = getUpdateApkFile();

                if (apkFile.exists()) {
                    apkFile.delete();
                }

                inputStream = connection.getInputStream();
                outputStream = new FileOutputStream(apkFile);

                byte[] buffer = new byte[8192];
                long totalBytesRead = 0;
                int bytesRead;
                int lastReportedPercent = -1;

                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                    totalBytesRead += bytesRead;

                    if (fileLength > 0) {
                        int currentPercent = (int) ((totalBytesRead * 100) / fileLength);
                        if (currentPercent != lastReportedPercent) {
                            lastReportedPercent = currentPercent;
                            JSObject progressData = new JSObject();
                            progressData.put("progress", currentPercent);
                            progressData.put("bytesRead", totalBytesRead);
                            progressData.put("totalBytes", fileLength);
                            notifyListeners("downloadProgress", progressData);
                        }
                    }
                }

                outputStream.flush();
                outputStream.close();
                outputStream = null;

                // Make file readable to system package installer
                apkFile.setReadable(true, false);

                // Immediate pre-install APK validation
                ApkValidationResult validation = validateApkFile(apkFile);
                if (!validation.isValid) {
                    if (apkFile.exists()) {
                        apkFile.delete();
                    }
                    call.reject("Downloaded APK validation failed: " + validation.error);
                    return;
                }

                Uri contentUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        apkFile
                );

                JSObject result = new JSObject();
                result.put("uri", contentUri.toString());
                result.put("filePath", apkFile.getAbsolutePath());
                result.put("fileSize", totalBytesRead);
                result.put("packageName", validation.packageName);
                result.put("versionName", validation.versionName);
                result.put("versionCode", validation.versionCode);
                call.resolve(result);

            } catch (Exception e) {
                Log.e(TAG, "Download failed", e);
                call.reject("Download error: " + e.getMessage());
            } finally {
                try {
                    if (outputStream != null) outputStream.close();
                } catch (Exception ignored) {}
                try {
                    if (inputStream != null) inputStream.close();
                } catch (Exception ignored) {}
                if (connection != null) connection.disconnect();
            }
        });
    }

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            boolean canInstall = getContext().getPackageManager().canRequestPackageInstalls();
            result.put("canInstall", canInstall);
        } else {
            result.put("canInstall", true);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
            }
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Cannot open install permission settings", e);
            call.reject("Failed to open install settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        Context context = getContext();
        File apkFile = getUpdateApkFile();

        if (!apkFile.exists() || apkFile.length() == 0) {
            // Fallback to internal cache if present
            File fallback = new File(context.getCacheDir(), "update.apk");
            if (fallback.exists() && fallback.length() > 0) {
                apkFile = fallback;
            } else {
                JSObject result = new JSObject();
                result.put("success", false);
                result.put("installerLaunched", false);
                result.put("error", "Update package not found. Please download the update again.");
                call.resolve(result);
                return;
            }
        }

        // 1. Strict validation of package name and versionCode
        ApkValidationResult validation = validateApkFile(apkFile);
        if (!validation.isValid) {
            apkFile.delete();
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("installerLaunched", false);
            result.put("error", validation.error);
            call.resolve(result);
            return;
        }

        // 2. Check Android 8.0+ Unknown App Sources permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!context.getPackageManager().canRequestPackageInstalls()) {
                JSObject result = new JSObject();
                result.put("success", false);
                result.put("installerLaunched", false);
                result.put("needsPermission", true);
                result.put("error", "Permission to install unknown apps is required. Please grant permission in Android settings.");
                call.resolve(result);
                return;
            }
        }

        // 3. Ensure readable
        apkFile.setReadable(true, false);

        // 4. Create FileProvider URI
        Uri contentUri;
        try {
            contentUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    apkFile
            );
        } catch (Exception e) {
            Log.e(TAG, "FileProvider getUriForFile failed", e);
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("installerLaunched", false);
            result.put("error", "Could not generate secure FileProvider URI: " + e.getMessage());
            call.resolve(result);
            return;
        }

        // 5. Build Intent with correct MIME type and permissions
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);

        // Explicitly grant URI permission to target activities
        List<ResolveInfo> resolveInfoList = context.getPackageManager().queryIntentActivities(
                intent, PackageManager.MATCH_DEFAULT_ONLY
        );
        for (ResolveInfo resolveInfo : resolveInfoList) {
            if (resolveInfo.activityInfo != null && resolveInfo.activityInfo.packageName != null) {
                context.grantUriPermission(
                        resolveInfo.activityInfo.packageName,
                        contentUri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION
                );
            }
        }

        // 6. Launch Android Package Installer
        try {
            getActivity().startActivity(intent);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("installerLaunched", true);
            result.put("targetVersionCode", validation.versionCode);
            result.put("targetVersionName", validation.versionName);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Installation intent launch failed", e);
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("installerLaunched", false);
            result.put("error", "Failed to launch Android package installer: " + e.getMessage());
            call.resolve(result);
        }
    }
}
