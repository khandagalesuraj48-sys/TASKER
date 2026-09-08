import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Minus, Plus, RefreshCw } from "lucide-react";

export interface AuthSwitchProps {
  initialCount?: number;
  className?: string;
  title?: string;
  onChange?: (count: number) => void;
}

export const AuthSwitch: React.FC<AuthSwitchProps> = ({
  initialCount = 0,
  className,
  title = "Component Example",
  onChange,
}) => {
  const [count, setCount] = useState<number>(initialCount);

  const handleDecrement = () => {
    setCount((prev) => {
      const next = prev - 1;
      onChange?.(next);
      return next;
    });
  };

  const handleIncrement = () => {
    setCount((prev) => {
      const next = prev + 1;
      onChange?.(next);
      return next;
    });
  };

  const handleReset = () => {
    setCount(0);
    onChange?.(0);
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm max-w-sm mx-auto transition-all",
        className
      )}
    >
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Interactive State Counter
        </p>
      </div>

      <div className="flex items-center justify-center w-24 h-24 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 shadow-inner">
        <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">
          {count}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDecrement}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold active:scale-95 transition-all shadow-xs"
          aria-label="Decrement"
        >
          <Minus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="px-3 h-10 rounded-xl flex items-center gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold active:scale-95 transition-all"
          title="Reset"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <button
          type="button"
          onClick={handleIncrement}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold active:scale-95 transition-all shadow-xs"
          aria-label="Increment"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Aliases to satisfy all import formats
export const Component = AuthSwitch;
export default AuthSwitch;
