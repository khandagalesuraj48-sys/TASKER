import React from 'react';
import { ArrowRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  colorScheme: 'amber' | 'blue' | 'orange' | 'emerald' | 'rose';
  onClick?: () => void;
  isActive?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  count,
  icon,
  colorScheme,
  onClick,
  isActive = false,
}) => {
  const schemeStyles = {
    amber: {
      border: 'border-amber-200 dark:border-amber-900/40',
      bg: 'bg-amber-50/50 dark:bg-amber-950/20',
      activeBorder: 'border-amber-500 dark:border-amber-400 ring-2 ring-amber-500/20',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
      countText: 'text-amber-900 dark:text-amber-100',
    },
    blue: {
      border: 'border-blue-200 dark:border-blue-900/40',
      bg: 'bg-blue-50/50 dark:bg-blue-950/20',
      activeBorder: 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20',
      iconBg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
      countText: 'text-blue-900 dark:text-blue-100',
    },
    orange: {
      border: 'border-orange-200 dark:border-orange-900/40',
      bg: 'bg-orange-50/50 dark:bg-orange-950/20',
      activeBorder: 'border-orange-500 dark:border-orange-400 ring-2 ring-orange-500/20',
      iconBg: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
      countText: 'text-orange-900 dark:text-orange-100',
    },
    emerald: {
      border: 'border-emerald-200 dark:border-emerald-900/40',
      bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
      activeBorder: 'border-emerald-500 dark:border-emerald-400 ring-2 ring-emerald-500/20',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
      countText: 'text-emerald-900 dark:text-emerald-100',
    },
    rose: {
      border: 'border-rose-200 dark:border-rose-900/40',
      bg: 'bg-rose-50/50 dark:bg-rose-950/20',
      activeBorder: 'border-rose-500 dark:border-rose-400 ring-2 ring-rose-500/20',
      iconBg: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
      countText: 'text-rose-900 dark:text-rose-100',
    },
  };

  const style = schemeStyles[colorScheme];

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-4 sm:p-5 transition-all bg-white dark:bg-slate-900 shadow-sm ${
        onClick ? 'cursor-pointer hover:shadow-md dark:hover:shadow-slate-950/50 active:scale-[0.98]' : ''
      } ${isActive ? style.activeBorder : style.border}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-xl ${style.iconBg}`}>{icon}</div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className={`text-2xl sm:text-3xl font-bold tracking-tight ${style.countText}`}>
          {count}
        </span>
        {onClick && (
          <span className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
            <ArrowRight className="w-4 h-4" />
          </span>
        )}
      </div>
    </div>
  );
};

