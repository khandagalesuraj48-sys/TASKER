import React from 'react';
import { BarChart3, Download, Flame, CheckCircle, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useTask } from '../context/TaskContext';
import { exportUserDataAsJson } from '../services/privacyService';
import { useToast } from '../context/ToastContext';

export const ReportsPage: React.FC = () => {
  const { stats } = useTask();
  const { showToast } = useToast();
  const streak = 3;

  const handleExport = async () => {
    try {
      const json = await exportUserDataAsJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TASKER_data_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported successfully (DPDP compliant)', 'success');
    } catch (e) {
      showToast('Export failed', 'error');
    }
  };

  const total = stats.totalActive + stats.completed;
  const completionRate = total > 0 ? Math.round((stats.completed / total) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Productivity & Compliance Reports</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Weekly completion velocity, streak insights, and data governance.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Export All Data (DPDP)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Daily Streak</span>
            <Flame className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{streak} Days 🔥</p>
          <p className="text-[11px] text-slate-400 mt-1">Keep completing tasks daily</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Completion Rate</span>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{completionRate}%</p>
          <p className="text-[11px] text-slate-400 mt-1">{stats.completed} of {total} total tasks</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Tasks</span>
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{stats.pending + stats.inProgress}</p>
          <p className="text-[11px] text-slate-400 mt-1">In active queue</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Overdue Rate</span>
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">{stats.overdue}</p>
          <p className="text-[11px] text-slate-400 mt-1">Needs urgent attention</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">India DPDP Act 2023 Compliance</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            You have full ownership of your personal, family, and business data. All data is end-to-end encrypted, and you can export or delete your account records at any time.
          </p>
        </div>
      </div>
    </div>
  );
};
