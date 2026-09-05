package com.oneclicksolution.tasker;

import android.content.Context;
import android.content.Intent;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "UpdatePlugin")
public class UpdatePlugin extends Plugin {
    private static final String TAG = "UpdatePlugin";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

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
                File cacheDir = context.getCacheDir();
                File apkFile = new File(cacheDir, "update.apk");

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

                Uri contentUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        apkFile
                );

                JSObject result = new JSObject();
                result.put("uri", contentUri.toString());
                result.put("filePath", apkFile.getAbsolutePath());
                result.put("fileSize", totalBytesRead);
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
        String uriString = call.getString("uri");
        Context context = getContext();

        try {
            Uri contentUri;
            if (uriString != null && !uriString.trim().isEmpty()) {
                contentUri = Uri.parse(uriString);
            } else {
                File apkFile = new File(context.getCacheDir(), "update.apk");
                if (!apkFile.exists()) {
                    call.reject("APK file does not exist in cache");
                    return;
                }
                contentUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        apkFile
                );
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            getActivity().startActivity(intent);

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Installation intent launch failed", e);
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", e.getMessage());
            call.resolve(result);
        }
    }
}
