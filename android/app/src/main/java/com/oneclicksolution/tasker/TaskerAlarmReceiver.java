package com.oneclicksolution.tasker;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

public class TaskerAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "TaskerAlarmReceiver";
    public static final String ACTION_CHECK_NOTIFS = "com.oneclicksolution.tasker.ACTION_CHECK_NOTIFS";
    private static final int ALARM_REQ_CODE = 7711;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;

        String action = intent != null ? intent.getAction() : null;
        Log.i(TAG, "TaskerAlarmReceiver triggered with action: " + action);

        // Schedule next silent alarm check (every 25 seconds)
        scheduleNextAlarm(context);

        // Run background check in async thread
        final PendingResult pendingResult = goAsync();
        new Thread(() -> {
            try {
                checkAndAlertNotifications(context);
            } catch (Exception e) {
                Log.w(TAG, "Error in background notification check: " + e.getMessage());
            } finally {
                pendingResult.finish();
            }
        }, "SilentNotifWorker").start();
    }

    public static void scheduleNextAlarm(Context context) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            Intent intent = new Intent(context, TaskerAlarmReceiver.class);
            intent.setAction(ACTION_CHECK_NOTIFS);

            PendingIntent pi = PendingIntent.getBroadcast(
                    context,
                    ALARM_REQ_CODE,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            long triggerAt = System.currentTimeMillis() + 25000L; // 25 seconds

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed scheduling next silent alarm: " + e.getMessage());
        }
    }

    private void checkAndAlertNotifications(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(TaskerSyncService.PREFS_NAME, Context.MODE_PRIVATE);
        String userId = prefs.getString(TaskerSyncService.KEY_USER_ID, null);
        String supabaseUrl = prefs.getString(TaskerSyncService.KEY_SUPABASE_URL, null);
        String supabaseKey = prefs.getString(TaskerSyncService.KEY_SUPABASE_ANON_KEY, null);

        if (userId == null || userId.trim().isEmpty() || supabaseUrl == null || supabaseKey == null) {
            return;
        }

        HttpURLConnection conn = null;
        try {
            String endpoint = supabaseUrl;
            if (!endpoint.endsWith("/")) endpoint += "/";
            endpoint += "rest/v1/rpc/get_unread_notifications_background";

            URL url = new URL(endpoint);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("apikey", supabaseKey);
            conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            JSONObject reqBody = new JSONObject();
            reqBody.put("p_user_id", userId.trim());
            reqBody.put("p_limit", 15);

            byte[] outBytes = reqBody.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(outBytes);
                os.flush();
            }

            int responseCode = conn.getResponseCode();
            if (responseCode >= 200 && responseCode < 300) {
                StringBuilder response = new StringBuilder();
                try (InputStream is = conn.getInputStream();
                     BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                }

                JSONArray notifs = new JSONArray(response.toString());
                if (notifs.length() > 0) {
                    processNewNotifications(context, notifs, prefs);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "checkAndAlertNotifications network exception: " + e.getMessage());
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private void processNewNotifications(Context context, JSONArray notifs, SharedPreferences prefs) {
        Set<String> seenIds = new HashSet<>(prefs.getStringSet(TaskerSyncService.KEY_SEEN_NOTIF_IDS, new HashSet<>()));
        boolean updated = false;

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "TASKER:SilentAlertWakeLock"
            );
            wakeLock.acquire(3000L);
        }

        try {
            for (int i = 0; i < notifs.length(); i++) {
                JSONObject item = notifs.getJSONObject(i);
                String id = item.optString("id");
                if (id == null || id.isEmpty() || seenIds.contains(id)) {
                    continue;
                }

                String title = item.optString("title", "नवीन टास्क सूचना (TASKER)");
                String message = item.optString("message", "");
                String entityId = item.optString("entity_id", "");
                String entityType = item.optString("entity_type", "");

                // Build Heads-up Alert Intent
                Intent tapIntent = new Intent(context, MainActivity.class);
                tapIntent.putExtra("notification_id", id);
                tapIntent.putExtra("entity_id", entityId);
                tapIntent.putExtra("entity_type", entityType);
                tapIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

                PendingIntent pi = PendingIntent.getActivity(
                        context,
                        id.hashCode(),
                        tapIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
                );

                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

                NotificationCompat.Builder alertBuilder = new NotificationCompat.Builder(context, TaskerSyncService.CHANNEL_ID_ALERTS)
                        .setSmallIcon(R.mipmap.ic_launcher)
                        .setContentTitle(title)
                        .setContentText(message)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setDefaults(NotificationCompat.DEFAULT_ALL)
                        .setSound(soundUri)
                        .setVibrate(new long[]{0, 350, 200, 350})
                        .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                        .setAutoCancel(true)
                        .setContentIntent(pi);

                // Show only the actual task alert notification (Heads-up with ringtone + vibration)
                notificationManager.notify(id.hashCode(), alertBuilder.build());
                seenIds.add(id);
                updated = true;
                Log.i(TAG, "Delivered new task alert notification: " + title);
            }

            if (updated) {
                if (seenIds.size() > 300) {
                    seenIds = new HashSet<>(new HashSet<>(seenIds));
                }
                prefs.edit().putStringSet(TaskerSyncService.KEY_SEEN_NOTIF_IDS, seenIds).apply();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error displaying alert notifications: " + e.getMessage());
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try {
                    wakeLock.release();
                } catch (Exception ignored) {}
            }
        }
    }
}
