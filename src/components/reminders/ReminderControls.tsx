import React from 'react';
import { Bell, BellOff, Clock, Sparkles } from 'lucide-react';
import { ReminderInput, ReminderRecurrence } from '../../types/task';
import { formatInputDateTime } from '../../lib/dateUtils';
import { requestNotificationPermissions } from '../../services/notificationService';

interface ReminderControlsProps {
  value: ReminderInput;
  onChange: (val: ReminderInput) => void;
  defaultTime?: string | null;
}

export const ReminderControls: React.FC<ReminderControlsProps> = ({
  value,
  onChange,
  defaultTime,
}) => {
  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      requestNotificationPermissions().catch(() => {});
    }

    const now = Date.now();
    let targetTime = value.remind_at;
    if (!targetTime || new Date(targetTime).getTime() <= now) {
      targetTime = defaultTime && new Date(defaultTime).getTime() > now
        ? defaultTime
        : new Date(now + 15 * 60 * 1000).toISOString();
    }

    onChange({
      ...value,
      is_enabled: enabled,
      remind_at: targetTime,
    });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange({
      ...value,
      remind_at: val ? new Date(val).toISOString() : new Date().toISOString(),
    });
  };

  const handleQuickPreset = (mins: number) => {
    requestNotificationPermissions().catch(() => {});
    const triggerDate = new Date(Date.now() + mins * 60 * 1000);
    onChange({
      ...value,
      is_enabled: true,
      remind_at: triggerDate.toISOString(),
      recurrence_type: 'once',
    });
  };

  const handleRecurrenceChange = (recurrence: ReminderRecurrence) => {
    onChange({
      ...value,
      recurrence_type: recurrence,
    });
  };

  const handleCustomIntervalChange = (mins: number) => {
    const validMins = mins > 0 ? mins : 60;
    const now = Date.now();
    // If remind_at is in past or empty, advance from now
    const targetRemindAt = (!value.remind_at || new Date(value.remind_at).getTime() <= now)
      ? new Date(now + validMins * 60 * 1000).toISOString()
      : value.remind_at;

    onChange({
      ...value,
      custom_interval_minutes: validMins,
      remind_at: targetRemindAt,
    });
  };

  return (
    <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
      {/* Header & Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {value.is_enabled ? (
            <Bell className="w-4 h-4 text-primary" />
          ) : (
            <BellOff className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold text-foreground">Smart Reminder</span>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={value.is_enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {value.is_enabled && (
        <div className="space-y-3.5 pt-2 border-t border-border/60 animate-in fade-in">
          {/* Quick Schedule Presets */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <label className="block text-xs font-medium text-foreground/80">
                Quick Schedule (from now)
              </label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-xs">
              {[
                { label: 'In 1 min', mins: 1 },
                { label: 'In 5 mins', mins: 5 },
                { label: 'In 15 mins', mins: 15 },
                { label: 'In 30 mins', mins: 30 },
                { label: 'In 1 hr', mins: 60 },
                { label: 'In 2 hrs', mins: 120 },
              ].map((preset) => (
                <button
                  key={preset.mins}
                  type="button"
                  onClick={() => handleQuickPreset(preset.mins)}
                  className="py-1 px-1.5 rounded-lg border text-center font-medium bg-card text-foreground border-border/80 hover:bg-muted hover:text-primary transition-colors shadow-2xs"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reminder Trigger Time */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Exact Reminder Date & Time
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="datetime-local"
                value={value.remind_at ? formatInputDateTime(value.remind_at) : ''}
                onChange={handleDateChange}
                className="w-full rounded-lg border border-input/80 bg-background pl-9 pr-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>

          {/* Recurrence Selector */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Repeat Recurrence
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
              {(
                [
                  { key: 'once', label: 'Once' },
                  { key: 'hourly', label: 'Every 1 hr' },
                  { key: 'every_2_hours', label: 'Every 2 hrs' },
                  { key: 'daily', label: 'Daily' },
                  { key: 'custom', label: 'Custom' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleRecurrenceChange(opt.key)}
                  className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-colors ${
                    value.recurrence_type === opt.key
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card text-foreground border-border/80 hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Interval if selected */}
          {value.recurrence_type === 'custom' && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Repeat every:</label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={value.custom_interval_minutes || 60}
                  onChange={(e) => handleCustomIntervalChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-20 rounded-lg border border-input/80 bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
                <span className="text-xs text-muted-foreground">minutes</span>
              </div>

              {/* Quick Preset Chips for Custom Interval */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {[
                  { label: '1 min', val: 1 },
                  { label: '5 min', val: 5 },
                  { label: '15 min', val: 15 },
                  { label: '30 min', val: 30 },
                  { label: '1 hr', val: 60 },
                  { label: '2 hrs', val: 120 },
                ].map((chip) => (
                  <button
                    key={chip.val}
                    type="button"
                    onClick={() => handleCustomIntervalChange(chip.val)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors ${
                      value.custom_interval_minutes === chip.val
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-card text-muted-foreground border-border/80 hover:bg-muted'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            ℹ When the task is completed or deleted, all future reminders automatically stop.
          </p>
        </div>
      )}
    </div>
  );
};