# Android Architecture Specification — Native TASKER App

This specification defines the native Android architecture for **TASKER**, sharing the exact same Supabase backend, database tables, authentication, and realtime replication as the Web application.

---

## 1. Native Technology Stack (No WebViews)

| Layer | Technology |
|---|---|
| **Language** | Kotlin (100% Native) |
| **UI Framework** | Jetpack Compose + Material 3 Design |
| **Backend / BaaS** | Supabase Kotlin SDK (`io.github.jan-tennert.supabase`) |
| **Modules** | `postgrest-kt` (Database), `auth-kt` (Supabase Auth), `realtime-kt` (WebSockets), `storage-kt` (Attachments) |
| **Local Cache** | Android Room Database (Offline-first cache mirrors Supabase schema) |
| **Background Sync** | Android `WorkManager` (Periodic background sync & offline queue) |
| **Precision Reminders** | Android `AlarmManager` + `BroadcastReceiver` |
| **Dependency Injection** | Hilt / Kotlin Koin |

---

## 2. Minimal & Compliant Permissions (`AndroidManifest.xml`)

Only permissions genuinely needed by TASKER are requested. Dangerous and privacy-sensitive permissions (contacts, microphone, camera, location, SMS, storage) are strictly avoided.

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Essential Internet & Network State for Supabase -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- Android 13+ (API 33) Runtime Notification Permission -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <!-- Exact Alarm for Precision Task Reminders -->
    <!-- Used only for user-scheduled task due dates -->
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />

    <!-- Device Reboot Alarm Rescheduling -->
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <!-- Vibration feedback for High-Priority reminders -->
    <uses-permission android:name="android.permission.VIBRATE" />

</manifest>
```

### Runtime Permission Flow (Android 13+)
```kotlin
// In Jetpack Compose screen before setting a reminder:
val notificationPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
) { isGranted: Boolean ->
    if (isGranted) {
        // Schedule reminder alarm
    } else {
        // Display educational rationale dialog explaining that reminders require notifications
    }
}
```

---

## 3. High-Priority Notification Channel Setup

```kotlin
object NotificationHelper {
    const val REMINDERS_CHANNEL_ID = "tasker_task_reminders"

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                REMINDERS_CHANNEL_ID,
                "Task Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifies you when your scheduled tasks are due."
                enableVibration(true)
                enableLights(true)
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
```

---

## 4. Reliable Reminder Scheduling (Even when App is Closed)

To ensure reminders fire reliably at the exact second even under Android Doze Mode:

```kotlin
class ReminderScheduler(private val context: Context) {
    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    fun scheduleReminder(reminder: TaskReminder, task: Task) {
        val intent = Intent(context, TaskReminderReceiver::class.java).apply {
            putExtra("TASK_ID", task.id)
            putExtra("TASK_TITLE", task.title)
            putExtra("TASK_PRIORITY", task.priority)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            task.id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val triggerAtMillis = Instant.parse(reminder.nextTriggerAt).toEpochMilli()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis,
                pendingIntent
            )
        } else {
            alarmManager.setExact(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis,
                pendingIntent
            )
        }
    }

    fun cancelReminder(taskId: String) {
        val intent = Intent(context, TaskReminderReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            taskId.hashCode(),
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
        }
    }
}
```

---

## 5. BroadcastReceiver: Lifecycle-Aware Notification Dispatch

When the alarm triggers, the receiver verifies that the task is still pending/active before posting the notification:

```kotlin
class TaskReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra("TASK_ID") ?: return
        val taskTitle = intent.getStringExtra("TASK_TITLE") ?: "Task Due"

        CoroutineScope(Dispatchers.IO).launch {
            // 1. Verify in local Room DB or Supabase that task is NOT completed or in bin
            val isEligible = TaskRepository.isReminderEligible(taskId)
            if (!isEligible) {
                // Task was completed or soft-deleted — do not fire notification
                return@launch
            }

            // 2. Build Interactive Notification
            val openIntent = Intent(context, MainActivity::class.java).apply {
                putExtra("NAV_TO_TASK_ID", taskId)
            }
            val openPendingIntent = PendingIntent.getActivity(
                context, taskId.hashCode(), openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Snooze Action (15m)
            val snoozeIntent = Intent(context, SnoozeReminderReceiver::class.java).apply {
                putExtra("TASK_ID", taskId)
            }
            val snoozePendingIntent = PendingIntent.getBroadcast(
                context, taskId.hashCode() + 1, snoozeIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(context, NotificationHelper.REMINDERS_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_tasker_notification)
                .setContentTitle(taskTitle)
                .setContentText("Task reminder is due now.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(openPendingIntent)
                .addAction(R.drawable.ic_snooze, "Snooze 15m", snoozePendingIntent)
                .build()

            val notificationManager = NotificationManagerCompat.from(context)
            notificationManager.notify(taskId.hashCode(), notification)
        }
    }
}
```

---

## 6. Device Boot Rescheduling (`BootReceiver`)

Alarms registered with `AlarmManager` are cleared by the Android OS when a phone reboots. `BootReceiver` reschedules all future active reminders upon restart:

```kotlin
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            CoroutineScope(Dispatchers.IO).launch {
                val activeReminders = TaskRepository.getAllActiveFutureReminders()
                val scheduler = ReminderScheduler(context)
                activeReminders.forEach { (reminder, task) ->
                    scheduler.scheduleReminder(reminder, task)
                }
            }
        }
    }
}
```

---

## 7. Supabase Realtime Synchronization Matrix

| Event Source | Mechanism | Receiver |
|---|---|---|
| **Web creates task / reminder** | PostgreSQL INSERT -> `supabase_realtime` CDC | Android WebSocket receives event -> schedules local `AlarmManager` |
| **Android completes task** | PostgreSQL UPDATE (`status = 'completed'`) | Web receives event -> updates UI and stops reminder instantly |
| **Task moved to Bin** | PostgreSQL UPDATE (`is_deleted = true`) | Database trigger `trg_task_reminder_lifecycle` sets `status = 'stopped'` |

