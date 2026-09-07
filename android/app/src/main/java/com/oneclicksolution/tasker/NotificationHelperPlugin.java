package com.oneclicksolution.tasker;

import android.app.AlarmManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NotificationHelper")
public class NotificationHelperPlugin extends Plugin {

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Context context = getContext();
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open notification settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkSystemStatus(PluginCall call) {
        Context context = getContext();
        boolean enabled = NotificationManagerCompat.from(context).areNotificationsEnabled();
        boolean canScheduleExact = true;
        boolean isIgnoringBattery = true;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                canScheduleExact = alarmManager.canScheduleExactAlarms();
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                isIgnoringBattery = pm.isIgnoringBatteryOptimizations(context.getPackageName());
            }
        }

        JSObject result = new JSObject();
        result.put("areNotificationsEnabled", enabled);
        result.put("canScheduleExactAlarms", canScheduleExact);
        result.put("isIgnoringBatteryOptimizations", isIgnoringBattery);
        call.resolve(result);
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        Context context = getContext();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } else {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open alarm settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestBatteryOptimization(PluginCall call) {
        Context context = getContext();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(context.getPackageName())) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + context.getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                    JSObject ret = new JSObject();
                    ret.put("promptShown", true);
                    call.resolve(ret);
                    return;
                }
            }
            JSObject ret = new JSObject();
            ret.put("promptShown", false);
            ret.put("alreadyIgnoring", true);
            call.resolve(ret);
        } catch (Exception e) {
            try {
                // Fallback to general battery saver settings page
                Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                call.resolve();
            } catch (Exception ex) {
                call.reject("Could not request battery optimization exemption: " + e.getMessage());
            }
        }
    }

    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        Context context = getContext();
        PackageManager pm = context.getPackageManager();

        Intent[] autostartIntents = new Intent[] {
                // Xiaomi / POCO / Redmi
                new Intent().setComponent(new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")),
                // Oppo / Realme
                new Intent().setComponent(new ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")),
                new Intent().setComponent(new ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity")),
                // Vivo / iQOO
                new Intent().setComponent(new ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")),
                new Intent().setComponent(new ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager")),
                // Huawei / Honor
                new Intent().setComponent(new ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity")),
                // OnePlus
                new Intent().setComponent(new ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity")),
                // Samsung Device Care
                new Intent().setComponent(new ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"))
        };

        for (Intent intent : autostartIntents) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (intent.resolveActivity(pm) != null) {
                    context.startActivity(intent);
                    call.resolve();
                    return;
                }
            } catch (Exception ignored) {}
        }

        // Fallback to app details page
        try {
            Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            fallback.setData(Uri.parse("package:" + context.getPackageName()));
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(fallback);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open autostart settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startBackgroundSync(PluginCall call) {
        Context context = getContext();
        String userId = call.getString("userId");
        String supabaseUrl = call.getString("supabaseUrl");
        String supabaseAnonKey = call.getString("supabaseAnonKey");

        if (userId == null || userId.trim().isEmpty()) {
            call.reject("userId is required to start background sync");
            return;
        }

        try {
            SharedPreferences prefs = context.getSharedPreferences(TaskerSyncService.PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString(TaskerSyncService.KEY_USER_ID, userId.trim());
            if (supabaseUrl != null) editor.putString(TaskerSyncService.KEY_SUPABASE_URL, supabaseUrl.trim());
            if (supabaseAnonKey != null) editor.putString(TaskerSyncService.KEY_SUPABASE_ANON_KEY, supabaseAnonKey.trim());
            editor.apply();

            // Cancel any old sticky notification (ID 9001) and delete sync channel so it never appears
            android.app.NotificationManager nm = (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(TaskerSyncService.SERVICE_NOTIFICATION_ID);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    try {
                        nm.deleteNotificationChannel(TaskerSyncService.CHANNEL_ID_SERVICE);
                    } catch (Exception ignored) {}
                }
            }

            // Stop old foreground service
            try {
                Intent stopOld = new Intent(context, TaskerSyncService.class);
                context.stopService(stopOld);
            } catch (Exception ignored) {}

            // Start silent WhatsApp-style background checking with ZERO sticky notifications
            TaskerAlarmReceiver.scheduleNextAlarm(context);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start background sync service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopBackgroundSync(PluginCall call) {
        Context context = getContext();
        try {
            SharedPreferences prefs = context.getSharedPreferences(TaskerSyncService.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().remove(TaskerSyncService.KEY_USER_ID).apply();

            Intent serviceIntent = new Intent(context, TaskerSyncService.class);
            context.stopService(serviceIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop background sync service: " + e.getMessage());
        }
    }
}
