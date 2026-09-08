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
    <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/50 rounded-lg border border-border/80">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all active:scale-95 ${
              isActive
                ? 'bg-background text-foreground shadow-2xs font-bold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                tab.badgeColor || (isActive ? 'bg-muted text-foreground' : 'bg-muted/80 text-muted-foreground')
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

