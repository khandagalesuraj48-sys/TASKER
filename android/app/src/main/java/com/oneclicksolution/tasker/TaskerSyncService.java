package com.oneclicksolution.tasker;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
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

public class TaskerSyncService extends Service {

    private static final String TAG = "TaskerSyncService";

    public static final String CHANNEL_ID_SERVICE = "tasker_background_sync";
    public static final String CHANNEL_ID_ALERTS = "tasker_alerts";
    public static final int SERVICE_NOTIFICATION_ID = 9001;

    public static final String PREFS_NAME = "tasker_sync_prefs";
    public static final String KEY_USER_ID = "sync_user_id";
    public static final String KEY_SUPABASE_URL = "sync_supabase_url";
    public static final String KEY_SUPABASE_ANON_KEY = "sync_supabase_anon_key";
    public static final String KEY_SEEN_NOTIF_IDS = "seen_notif_ids";

    private volatile boolean mIsRunning = false;
    private Thread mWorkerThread = null;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        Log.i(TAG, "TaskerSyncService onCreate");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String userId = intent.getStringExtra(KEY_USER_ID);
            String supabaseUrl = intent.getStringExtra(KEY_SUPABASE_URL);
            String supabaseKey = intent.getStringExtra(KEY_SUPABASE_ANON_KEY);

            if (userId != null && !userId.trim().isEmpty()) {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit();
                editor.putString(KEY_USER_ID, userId.trim());
                if (supabaseUrl != null) editor.putString(KEY_SUPABASE_URL, supabaseUrl.trim());
                if (supabaseKey != null) editor.putString(KEY_SUPABASE_ANON_KEY, supabaseKey.trim());
                editor.apply();
                Log.i(TAG, "Saved sync credentials for user: " + userId);
            }
        }

        // Cancel any sticky notification and switch to silent AlarmManager
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(SERVICE_NOTIFICATION_ID);
            }
        } catch (Exception ignored) {}

        // Schedule silent background checks
        TaskerAlarmReceiver.scheduleNextAlarm(this);

        stopSelf();
        return START_NOT_STICKY;
    }

    private Notification buildServiceNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID_SERVICE)
                .setContentTitle("TASKER सिंक सक्रिय आहे")
                .setContentText("नवीन टास्क आणि सूचनांचे अपडेट्स चालू आहेत")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .build();
    }

    private void runPollingLoop() {
        Log.i(TAG, "TaskerSyncWorker thread started");
        while (mIsRunning) {
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                String userId = prefs.getString(KEY_USER_ID, null);
                String supabaseUrl = prefs.getString(KEY_SUPABASE_URL, null);
                String supabaseKey = prefs.getString(KEY_SUPABASE_ANON_KEY, null);

                if (userId != null && !userId.isEmpty() && supabaseUrl != null && supabaseKey != null) {
                    pollSupabase(userId, supabaseUrl, supabaseKey, prefs);
                }

                // Schedule next alarm backup in case OS kills the thread
                scheduleNextAlarmWakeup();

                // Adaptive Sleep: 12 seconds when interactive (screen on), 25 seconds when idle (screen off)
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                boolean isInteractive = pm != null && (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH ? pm.isInteractive() : true);
                long sleepMs = isInteractive ? 12000L : 25000L;

                Thread.sleep(sleepMs);
            } catch (InterruptedException ie) {
                Log.i(TAG, "TaskerSyncWorker interrupted, exiting loop");
                break;
            } catch (Exception e) {
                Log.e(TAG, "Exception in TaskerSyncWorker loop: " + e.getMessage());
                try {
                    Thread.sleep(15000L);
                } catch (InterruptedException ignored) {}
            }
        }
    }

    private void pollSupabase(String userId, String supabaseUrl, String supabaseKey, SharedPreferences prefs) {
        HttpURLConnection conn = null;
        try {
            String endpoint = supabaseUrl;
            if (!endpoint.endsWith("/")) endpoint += "/";
            endpoint += "rest/v1/rpc/get_unread_notifications_background";

            URL url = new URL(endpoint);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("apikey", supabaseKey);
            conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            JSONObject reqBody = new JSONObject();
            reqBody.put("p_user_id", userId);
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
                    processIncomingNotifications(notifs, prefs);
                }
            } else {
                Log.w(TAG, "Poll Supabase returned code: " + responseCode);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed polling Supabase: " + e.getMessage());
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private void processIncomingNotifications(JSONArray notifs, SharedPreferences prefs) {
        Set<String> seenIds = new HashSet<>(prefs.getStringSet(KEY_SEEN_NOTIF_IDS, new HashSet<>()));
        boolean updated = false;

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "TASKER:AlertWakeLock"
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

                String title = item.optString("title", "नवीन सूचना (TASKER)");
                String message = item.optString("message", "");
                String entityId = item.optString("entity_id", "");
                String entityType = item.optString("entity_type", "");

                // Build Heads-up Intent
                Intent tapIntent = new Intent(this, MainActivity.class);
                tapIntent.putExtra("notification_id", id);
                tapIntent.putExtra("entity_id", entityId);
                tapIntent.putExtra("entity_type", entityType);
                tapIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

                PendingIntent pi = PendingIntent.getActivity(
                        this,
                        id.hashCode(),
                        tapIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
                );

                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

                NotificationCompat.Builder alertBuilder = new NotificationCompat.Builder(this, CHANNEL_ID_ALERTS)
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

                notificationManager.notify(id.hashCode(), alertBuilder.build());
                seenIds.add(id);
                updated = true;
                Log.i(TAG, "Fired native notification: " + title);
            }

            if (updated) {
                // Keep seen IDs bounded to latest 200 items
                if (seenIds.size() > 300) {
                    seenIds = new HashSet<>(new HashSet<>(seenIds));
                }
                prefs.edit().putStringSet(KEY_SEEN_NOTIF_IDS, seenIds).apply();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing notifications: " + e.getMessage());
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try {
                    wakeLock.release();
                } catch (Exception ignored) {}
            }
        }
    }

    private void scheduleNextAlarmWakeup() {
        try {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            Intent intent = new Intent(this, TaskerBootReceiver.class);
            intent.setAction("com.oneclicksolution.tasker.ACTION_SYNC_NOTIFICATIONS");

            PendingIntent pi = PendingIntent.getBroadcast(
                    this,
                    8888,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            long triggerAtMillis = System.currentTimeMillis() + 60000L; // 1 min backup
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not set exact alarm backup: " + e.getMessage());
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // App was swiped away from Recents: Reschedule service immediately!
        Log.i(TAG, "onTaskRemoved called - restarting TaskerSyncService via AlarmManager");
        try {
            Intent restartServiceIntent = new Intent(getApplicationContext(), TaskerSyncService.class);
            restartServiceIntent.setPackage(getPackageName());
            PendingIntent restartServicePendingIntent = PendingIntent.getService(
                    getApplicationContext(),
                    1,
                    restartServiceIntent,
                    PendingIntent.FLAG_ONE_SHOT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );
            AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                alarmManager.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 2000L, restartServicePendingIntent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to reschedule service on task remove: " + e.getMessage());
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        mIsRunning = false;
        if (mWorkerThread != null) {
            mWorkerThread.interrupt();
        }
        Log.i(TAG, "TaskerSyncService onDestroy");
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        // 1. Discreet Background Sync Channel
        NotificationChannel syncChannel = new NotificationChannel(
                CHANNEL_ID_SERVICE,
                "TASKER पार्श्वभूमी सिंक (Background Sync)",
                NotificationManager.IMPORTANCE_LOW
        );
        syncChannel.setDescription("ॲप बंद असतानाही नोटिफिकेशन्स चालू ठेवण्यासाठी आवश्यक सिस्टीम सेवा.");
        syncChannel.setShowBadge(false);
        manager.createNotificationChannel(syncChannel);

        // 2. High-Priority Alert Channel
        NotificationChannel alertChannel = new NotificationChannel(
                CHANNEL_ID_ALERTS,
                "TASKER अलर्ट्स व टास्क असाइनमेंट्स (High Priority)",
                NotificationManager.IMPORTANCE_HIGH
        );
        alertChannel.setDescription("नवीन टास्क, स्टेटस बदल व महत्त्वाच्या सूचनांचे तत्काळ अलर्ट्स.");
        alertChannel.enableLights(true);
        alertChannel.setLightColor(0xFF2563EB);
        alertChannel.enableVibration(true);
        alertChannel.setVibrationPattern(new long[]{0, 350, 200, 350});

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
        alertChannel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), audioAttributes);

        manager.createNotificationChannel(alertChannel);
    }
}

