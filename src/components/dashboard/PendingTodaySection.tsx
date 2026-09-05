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
      icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />,
      badgeColor: counts.overdue > 0 ? 'bg-rose-100 text-rose-700 font-bold' : '',
    },
    {
      key: 'due_today' as PendingTab,
      label: 'Due Today',
      count: counts.dueToday,
      icon: <Calendar className="w-3.5 h-3.5 text-blue-600" />,
      badgeColor: counts.dueToday > 0 ? 'bg-blue-100 text-blue-700 font-semibold' : '',
    },
    {
      key: 'upcoming' as PendingTab,
      label: 'Upcoming',
      count: counts.upcoming,
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                tab.badgeColor || (isActive ? 'bg-slate-100 text-slate-700' : 'bg-slate-200 text-slate-600')
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

