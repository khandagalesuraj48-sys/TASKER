package com.oneclicksolution.tasker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class TaskerBootReceiver extends BroadcastReceiver {

    private static final String TAG = "TaskerBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String action = intent.getAction();
        Log.i(TAG, "TaskerBootReceiver action: " + action);

        SharedPreferences prefs = context.getSharedPreferences(TaskerSyncService.PREFS_NAME, Context.MODE_PRIVATE);
        String userId = prefs.getString(TaskerSyncService.KEY_USER_ID, null);

        if (userId != null && !userId.trim().isEmpty()) {
            try {
                // Schedule silent background alarm checks without sticky notifications
                TaskerAlarmReceiver.scheduleNextAlarm(context);
                Log.i(TAG, "Scheduled TaskerAlarmReceiver after reboot: " + action);
            } catch (Exception e) {
                Log.e(TAG, "Failed to schedule alarm from boot receiver: " + e.getMessage());
            }
        }
    }
}
