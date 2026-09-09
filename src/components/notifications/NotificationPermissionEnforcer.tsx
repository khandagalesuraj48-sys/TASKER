import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, ArrowRight, ShieldAlert, Zap, BatteryCharging } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import {
  checkNotificationPermissions,
  requestNotificationPermissions,
  openSystemNotificationSettings,
  requestBatteryOptimizationExemption,
  openAutostartSettings,
  SystemPermissionStatus,
} from '../../services/notificationService';
import { useToast } from '../../context/ToastContext';

export const NotificationPermissionEnforcer: React.FC = () => {
  const { showToast } = useToast();
  const [status, setStatus] = useState<SystemPermissionStatus | null>(null);
  const [isPrompting, setIsPrompting] = useState<boolean>(false);
  const [dismissedTemporarily, setDismissedTemporarily] = useState<boolean>(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await checkNotificationPermissions();
      setStatus(res);
      if (res.granted && res.areNotificationsEnabled && res.isIgnoringBatteryOptimizations) {
        setDismissedTemporarily(false);
      }
    } catch (e) {
      console.warn('Error checking notification permissions:', e);
    }
  }, []);

  useEffect(() => {
    checkStatus();

    // Re-check when app regains focus from native Android settings
    let appStateHandle: any = null;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          checkStatus();
        }
      }).then((handle) => {
        appStateHandle = handle;
      });
    } else {
      const onFocus = () => checkStatus();
      window.addEventListener('focus', onFocus);
      return () => {
        window.removeEventListener('focus', onFocus);
      };
    }

    return () => {
      if (appStateHandle) {
        appStateHandle.remove();
      }
    };
  }, [checkStatus]);

  const handleEnableNotifications = async () => {
    setIsPrompting(true);
    try {
      const updated = await requestNotificationPermissions();
      setStatus(updated);

      if (updated.granted && updated.areNotificationsEnabled) {
        showToast('Notifications enabled successfully!', 'success');
        return;
      }

      // If still not granted or blocked, open system settings directly
      if (Capacitor.isNativePlatform()) {
        await openSystemNotificationSettings();
        showToast('Please enable notifications in system settings.', 'info');
      } else {
        showToast('Please allow notification permissions in browser settings.', 'warning');
      }
    } catch (err) {
      console.warn('Error requesting notifications:', err);
    } finally {
      setIsPrompting(false);
    }
  };

  const handleRequestBatteryExemption = async () => {
    try {
      await requestBatteryOptimizationExemption();
      showToast('Opening system dialog for battery optimization. Please allow.', 'info');
      setTimeout(() => checkStatus(), 1500);
    } catch (err) {
      console.warn('Error requesting battery exemption:', err);
    }
  };

  const handleOpenAutostart = async () => {
    try {
      await openAutostartSettings();
      showToast('Opening autostart settings. Please allow TASKER permissions.', 'info');
    } catch (err) {
      console.warn('Error opening autostart:', err);
    }
  };

  // If both notifications AND battery optimization are fully allowed, do not show enforcer
  if (!status) {
    return null;
  }

  const notificationsMissing = !status.granted || !status.areNotificationsEnabled;
  const batteryMissing = Capacitor.isNativePlatform() && !status.isIgnoringBatteryOptimizations;

  if (!notificationsMissing && !batteryMissing) {
    return null;
  }

  // If temporarily dismissed in current session, hide banner
  if (dismissedTemporarily) {
    return null;
  }

  const isBlocked = status.displayState === 'blocked' || status.displayState === 'denied';

  // SCENARIO 1: Notifications are completely OFF (Critical Red Alert)
  if (notificationsMissing) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[999] p-3 sm:p-4 animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto">
        <div className="max-w-xl mx-auto rounded-2xl bg-gradient-to-r from-amber-600 via-rose-600 to-red-600 p-0.5 shadow-2xl shadow-rose-950/40">
          <div className="rounded-[15px] bg-slate-900/95 backdrop-blur-md p-4 sm:p-5 text-white border border-white/10">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0 mt-0.5 animate-pulse">
                <BellOff className="w-6 h-6" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-1.5">
                    <span>Notifications are Disabled!</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-rose-500/30 text-rose-200 border border-rose-400/30">
                    Required
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                  To receive task assignments, completion alerts, and timely reminders, notifications must be enabled. Please turn on notifications immediately.
                </p>

                {isBlocked && (
                  <div className="mt-2 text-[11px] text-amber-200 bg-amber-500/10 p-2 rounded-lg border border-amber-400/20 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>When settings page opens, switch <strong>'Allow notifications'</strong> to ON.</span>
                  </div>
                )}

                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleEnableNotifications}
                    disabled={isPrompting}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>{isBlocked ? 'Open Settings' : 'Turn ON Notifications'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setDismissedTemporarily(true)}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
                  >
                    Remind Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SCENARIO 2: Notifications are ON, but Battery Optimization is Restricting Background Notifications (Amber Alert)
  return (
    <div className="fixed inset-x-0 bottom-0 z-[999] p-3 sm:p-4 animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto">
      <div className="max-w-xl mx-auto rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-0.5 shadow-2xl shadow-amber-950/40">
        <div className="rounded-[15px] bg-slate-900/95 backdrop-blur-md p-4 sm:p-5 text-white border border-white/10">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-1.5">
                  <span>Guaranteed Background Alerts</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/30 text-amber-200 border border-amber-400/30">
                  Recommended
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                To ensure instant alerts when app is closed or phone is locked, set battery to <strong>'Unrestricted'</strong> and enable autostart.
              </p>

              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <button
                  onClick={handleRequestBatteryExemption}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs shadow-lg shadow-orange-500/25 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <BatteryCharging className="w-3.5 h-3.5" />
                  <span>Allow Unrestricted Battery</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleOpenAutostart}
                  className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-amber-200 font-bold text-xs transition-colors cursor-pointer"
                >
                  Autostart Settings
                </button>

                <button
                  onClick={() => setDismissedTemporarily(true)}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
