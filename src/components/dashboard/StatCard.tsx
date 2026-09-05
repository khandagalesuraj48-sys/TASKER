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
      border: 'border-amber-200',
      bg: 'bg-amber-50/50',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/20',
      iconBg: 'bg-amber-100 text-amber-700',
      countText: 'text-amber-900',
    },
    blue: {
      border: 'border-blue-200',
      bg: 'bg-blue-50/50',
      activeBorder: 'border-blue-500 ring-2 ring-blue-500/20',
      iconBg: 'bg-blue-100 text-blue-700',
      countText: 'text-blue-900',
    },
    orange: {
      border: 'border-orange-200',
      bg: 'bg-orange-50/50',
      activeBorder: 'border-orange-500 ring-2 ring-orange-500/20',
      iconBg: 'bg-orange-100 text-orange-700',
      countText: 'text-orange-900',
    },
    emerald: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50/50',
      activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20',
      iconBg: 'bg-emerald-100 text-emerald-700',
      countText: 'text-emerald-900',
    },
    rose: {
      border: 'border-rose-200',
      bg: 'bg-rose-50/50',
      activeBorder: 'border-rose-500 ring-2 ring-rose-500/20',
      iconBg: 'bg-rose-100 text-rose-700',
      countText: 'text-rose-900',
    },
  };

  const style = schemeStyles[colorScheme];

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-4 sm:p-5 transition-all bg-white shadow-2xs ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      } ${isActive ? style.activeBorder : style.border}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-lg ${style.iconBg}`}>{icon}</div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className={`text-2xl sm:text-3xl font-bold tracking-tight ${style.countText}`}>
          {count}
        </span>
        {onClick && (
          <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
            <ArrowRight className="w-4 h-4" />
          </span>
        )}
      </div>
    </div>
  );
};

