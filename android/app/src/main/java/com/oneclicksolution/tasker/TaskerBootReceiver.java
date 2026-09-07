package com.oneclicksolution.tasker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

public class TaskerBootReceiver extends BroadcastReceiver {

    private static final String TAG = "TaskerBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String action = intent.getAction();
        Log.i(TAG, "Received broadcast action: " + action);

        SharedPreferences prefs = context.getSharedPreferences(TaskerSyncService.PREFS_NAME, Context.MODE_PRIVATE);
        String userId = prefs.getString(TaskerSyncService.KEY_USER_ID, null);

        if (userId != null && !userId.trim().isEmpty()) {
            try {
                Intent serviceIntent = new Intent(context, TaskerSyncService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
                Log.i(TAG, "Started TaskerSyncService after action: " + action);
            } catch (Exception e) {
                Log.e(TAG, "Failed to start TaskerSyncService from receiver: " + e.getMessage());
            }
        } else {
            Log.d(TAG, "No logged in user found in prefs, skipping service start.");
        }
    }
}

