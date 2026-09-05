import React from 'react';
import { Clock, AlertCircle, Calendar, CheckCircle2 } from 'lucide-react';

export type PendingTab = 'all' | 'due_today' | 'overdue' | 'upcoming';

interface PendingTodaySectionProps {
  activeTab: PendingTab;
  onTabChange: (tab: PendingTab) => void;
  counts: {
    all: number;
    dueToday: number;
    overdue: number;
    upcoming: number;
  };
}

export const PendingTodaySection: React.FC<PendingTodaySectionProps> = ({
  activeTab,
  onTabChange,
  counts,
}) => {
  const tabs = [
    {
      key: 'all' as PendingTab,
      label: 'All Pending',
      count: counts.all,
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    {
      key: 'overdue' as PendingTab,
      label: 'Overdue',
      count: counts.overdue,
      icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
      badgeColor: counts.overdue > 0 ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold' : '',
    },
    {
      key: 'due_today' as PendingTab,
      label: 'Due Today',
      count: counts.dueToday,
      icon: <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
      badgeColor: counts.dueToday > 0 ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold' : '',
    },
    {
      key: 'upcoming' as PendingTab,
      label: 'Upcoming',
      count: counts.upcoming,
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              isActive
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                tab.badgeColor || (isActive ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400')
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

