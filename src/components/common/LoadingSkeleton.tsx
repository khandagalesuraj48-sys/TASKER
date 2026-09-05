import React from 'react';

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs animate-pulse"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/3"></div>
            <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-lg w-24"></div>
          </div>
          <div className="mt-3 h-4 bg-slate-100 dark:bg-slate-800/60 rounded-lg w-2/3"></div>
          <div className="mt-4 flex items-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-28"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-28"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-28"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs animate-pulse">
      <div className="bg-slate-50 dark:bg-slate-800/50 h-11 border-b border-slate-200 dark:border-slate-800" />
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/4"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-16"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-16"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-24"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-24"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const StatsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-16"></div>
            <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
          </div>
          <div className="mt-3 h-7 bg-slate-200 dark:bg-slate-800 rounded-lg w-12"></div>
        </div>
      ))}
    </div>
  );
};

