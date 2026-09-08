import React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const schemeStyles: Record<string, { indicator: string; iconBg: string; text: string }> = {
    amber: {
      indicator: 'border-l-4 border-l-amber-500',
      iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
      text: 'text-amber-600 dark:text-amber-400',
    },
    blue: {
      indicator: 'border-l-4 border-l-blue-500',
      iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
      text: 'text-blue-600 dark:text-blue-400',
    },
    orange: {
      indicator: 'border-l-4 border-l-orange-500',
      iconBg: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
      text: 'text-orange-600 dark:text-orange-400',
    },
    emerald: {
      indicator: 'border-l-4 border-l-emerald-500',
      iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      text: 'text-emerald-600 dark:text-emerald-400',
    },
    rose: {
      indicator: 'border-l-4 border-l-rose-500',
      iconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
      text: 'text-rose-600 dark:text-rose-400',
    },
  };

  const style = schemeStyles[colorScheme] || schemeStyles.blue;

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-md border border-border bg-card text-card-foreground p-3.5 sm:p-4 transition-all shadow-2xs',
        style.indicator,
        onClick ? 'cursor-pointer hover:border-foreground/20' : '',
        isActive ? 'ring-1 ring-primary bg-accent/40' : ''
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        <div className={cn('p-1.5 rounded-sm', style.iconBg)}>{icon}</div>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-mono">
          {count}
        </span>
        {onClick && (
          <span className="text-muted-foreground/60 hover:text-foreground transition-colors">
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );
};
