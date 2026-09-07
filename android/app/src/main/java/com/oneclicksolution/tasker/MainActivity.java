package com.oneclicksolution.tasker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {

    // ============================================================
    // SYSTEM BARS PLUGIN
    // ============================================================

    @CapacitorPlugin(name = "SystemBars")
    public static class SystemBarsPlugin extends Plugin {

        @PluginMethod
        public void setStyle(PluginCall call) {

            String style = call.getString("style", "light");
            boolean isDark = "dark".equalsIgnoreCase(style);

            if (getActivity() != null) {

                getActivity().runOnUiThread(() -> {

                    Window window = getActivity().getWindow();

                    if (window != null) {

                        WindowInsetsControllerCompat controller =
                                WindowCompat.getInsetsController(
                                        window,
                                        window.getDecorView()
                                );

                        if (controller != null) {

                            // Light background = dark system-bar icons
                            // Dark background  = light system-bar icons

                            controller.setAppearanceLightStatusBars(!isDark);
                            controller.setAppearanceLightNavigationBars(!isDark);
                        }
                    }

                    call.resolve();
                });

            } else {
                call.resolve();
            }
        }
    }

    // ============================================================
    // ACTIVITY CREATE
    // ============================================================

    @Override
    public void onCreate(Bundle savedInstanceState) {

        // Existing Capacitor plugins
        registerPlugin(SystemBarsPlugin.class);
        registerPlugin(UpdatePlugin.class);
        registerPlugin(NotificationHelperPlugin.class);

        super.onCreate(savedInstanceState);

        // Create Android notification channels
        createNotificationChannels();

        // ========================================================
        // EDGE-TO-EDGE SYSTEM UI
        // ========================================================

        Window window = getWindow();

        if (window != null) {

            // Allow WebView to draw behind system bars
            WindowCompat.setDecorFitsSystemWindows(window, false);

            // Transparent system bars
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);

            // Disable Android 10+ contrast scrims
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {

                window.setStatusBarContrastEnforced(false);
                window.setNavigationBarContrastEnforced(false);
            }

            // Detect current Android dark/light mode
            int nightModeFlags =
                    getResources()
                            .getConfiguration()
                            .uiMode
                            & Configuration.UI_MODE_NIGHT_MASK;

            boolean isDark =
                    nightModeFlags == Configuration.UI_MODE_NIGHT_YES;

            WindowInsetsControllerCompat controller =
                    WindowCompat.getInsetsController(
                            window,
                            window.getDecorView()
                    );

            if (controller != null) {

                controller.setAppearanceLightStatusBars(!isDark);
                controller.setAppearanceLightNavigationBars(!isDark);
            }
        }
    }

    // ============================================================
    // NOTIFICATION CHANNELS
    // ============================================================

    private void createNotificationChannels() {

        // Notification channels are available from Android 8.0+
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager =
                getSystemService(NotificationManager.class);

        if (manager == null) {
            return;
        }

        // Common audio attributes for high-priority notification sounds
        AudioAttributes audioAttributes =
                new AudioAttributes.Builder()
                        .setContentType(
                                AudioAttributes.CONTENT_TYPE_SONIFICATION
                        )
                        .setUsage(
                                AudioAttributes.USAGE_NOTIFICATION
                        )
                        .build();

        // ========================================================
        // 0. TASK ALERTS & UPDATES (Assigned, Completed, Priority)
        // ========================================================

        NotificationChannel alertsChannel =
                new NotificationChannel(
                        "tasker_alerts",
                        "Task Alerts & Updates",
                        NotificationManager.IMPORTANCE_HIGH
                );

        alertsChannel.setDescription(
                "Immediate heads-up alerts for task assignments, reassignments, and completions"
        );

        alertsChannel.enableVibration(true);
        alertsChannel.enableLights(true);
        alertsChannel.setLightColor(Color.BLUE);
        alertsChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        alertsChannel.setSound(
                RingtoneManager.getDefaultUri(
                        RingtoneManager.TYPE_NOTIFICATION
                ),
                audioAttributes
        );

        manager.createNotificationChannel(alertsChannel);

        // ========================================================
        // 1. TASK REASSIGNMENT
        // ========================================================

        NotificationChannel reassignChannel =
                new NotificationChannel(
                        "tasker_reassign",
                        "Task Assignments",
                        NotificationManager.IMPORTANCE_HIGH
                );

        reassignChannel.setDescription(
                "Alerts when a task is assigned or reassigned to you"
        );

        reassignChannel.enableVibration(true);
        reassignChannel.enableLights(true);
        reassignChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        reassignChannel.setSound(
                RingtoneManager.getDefaultUri(
                        RingtoneManager.TYPE_NOTIFICATION
                ),
                audioAttributes
        );

        manager.createNotificationChannel(reassignChannel);

        // ========================================================
        // 2. TASK REMINDERS
        // ========================================================

        NotificationChannel reminderChannel =
                new NotificationChannel(
                        "tasker_reminders",
                        "Task Reminders",
                        NotificationManager.IMPORTANCE_HIGH
                );

        reminderChannel.setDescription(
                "Scheduled task reminders and due date alerts"
        );

        reminderChannel.enableVibration(true);
        reminderChannel.enableLights(true);

        reminderChannel.setSound(
                RingtoneManager.getDefaultUri(
                        RingtoneManager.TYPE_NOTIFICATION
                ),
                audioAttributes
        );

        manager.createNotificationChannel(reminderChannel);

        // ========================================================
        // 2. PENDING TASKS
        // ========================================================

        NotificationChannel pendingChannel =
                new NotificationChannel(
                        "tasker_pending",
                        "Pending Tasks",
                        NotificationManager.IMPORTANCE_DEFAULT
                );

        pendingChannel.setDescription(
                "Periodic reminders and summaries of pending tasks"
        );

        pendingChannel.enableVibration(true);
        pendingChannel.enableLights(true);

        manager.createNotificationChannel(pendingChannel);

        // ========================================================
        // 3. BACKGROUND SYNC (Ongoing Low Priority)
        // ========================================================

        NotificationChannel syncChannel =
                new NotificationChannel(
                        "tasker_background_sync",
                        "TASKER पार्श्वभूमी सिंक (Background Sync)",
                        NotificationManager.IMPORTANCE_LOW
                );

        syncChannel.setDescription(
                "ॲप बंद असतानाही नोटिफिकेशन्स थेट स्क्रीनवर येण्यासाठी पार्श्वभूमी सेवा."
        );
        syncChannel.setShowBadge(false);

        manager.createNotificationChannel(syncChannel);
    }
}