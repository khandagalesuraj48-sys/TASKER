import React from 'react';
import { Bell, BellOff, Clock } from 'lucide-react';
import { ReminderInput, ReminderRecurrence } from '../../types/task';
import { formatInputDate } from '../../lib/dateUtils';

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
    onChange({
      ...value,
      is_enabled: enabled,
      remind_at: value.remind_at || defaultTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange({
      ...value,
      remind_at: val ? new Date(val).toISOString() : new Date().toISOString(),
    });
  };

  const handleRecurrenceChange = (recurrence: ReminderRecurrence) => {
    onChange({
      ...value,
      recurrence_type: recurrence,
    });
  };

  const handleCustomIntervalChange = (mins: number) => {
    onChange({
      ...value,
      custom_interval_minutes: mins > 0 ? mins : 60,
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
      {/* Header & Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {value.is_enabled ? (
            <Bell className="w-4 h-4 text-blue-600" />
          ) : (
            <BellOff className="w-4 h-4 text-slate-400" />
          )}
          <span className="text-sm font-semibold text-slate-800">Smart Reminder</span>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={value.is_enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {value.is_enabled && (
        <div className="space-y-3 pt-2 border-t border-slate-200/60 animate-in fade-in">
          {/* Reminder Trigger Time */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Reminder Date & Time
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="datetime-local"
                value={value.remind_at ? formatInputDate(value.remind_at) : ''}
                onChange={handleDateChange}
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Recurrence Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
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
                  className={`py-1.5 px-2 rounded-md border text-center font-medium transition-colors ${
                    value.recurrence_type === opt.key
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Interval if selected */}
          {value.recurrence_type === 'custom' && (
            <div className="flex items-center gap-2 pt-1">
              <label className="text-xs text-slate-600 whitespace-nowrap">Repeat every:</label>
              <input
                type="number"
                min="5"
                max="1440"
                value={value.custom_interval_minutes || 60}
                onChange={(e) => handleCustomIntervalChange(parseInt(e.target.value, 10) || 60)}
                className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500">minutes</span>
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            ℹ When the task is completed or deleted, all future reminders automatically stop.
          </p>
        </div>
      )}
    </div>
  );
};