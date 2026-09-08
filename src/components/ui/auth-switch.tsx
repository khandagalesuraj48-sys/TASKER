import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { LogIn, UserPlus } from "lucide-react";

export interface AuthSwitchProps {
  activeTab?: "signin" | "signup";
  onTabChange?: (tab: "signin" | "signup") => void;
  className?: string;
  // Backward-compatible counter props
  initialCount?: number;
  title?: string;
  onChange?: (count: number) => void;
}

export const AuthSwitch: React.FC<AuthSwitchProps> = ({
  activeTab,
  onTabChange,
  className,
  initialCount = 0,
  title,
  onChange,
}) => {
  // If activeTab is passed, render the Sign In / Create Account switcher
  const [internalTab, setInternalTab] = useState<"signin" | "signup">(activeTab || "signin");
  const currentTab = activeTab !== undefined ? activeTab : internalTab;

  const handleTabClick = (tab: "signin" | "signup") => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  // If title is passed explicitly and activeTab is not, render counter demo
  const [count, setCount] = useState<number>(initialCount);
  if (title && activeTab === undefined) {
    return (
      <div className={cn("flex flex-col items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm", className)}>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400">{count}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const next = count - 1;
              setCount(next);
              onChange?.(next);
            }}
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => {
              const next = count + 1;
              setCount(next);
              onChange?.(next);
            }}
            className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold"
          >
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative grid grid-cols-2 p-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 shadow-inner mb-5",
        className
      )}
      role="tablist"
    >
      {/* Sign In Tab */}
      <button
        type="button"
        role="tab"
        aria-selected={currentTab === "signin"}
        onClick={() => handleTabClick("signin")}
        className={cn(
          "flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-98",
          currentTab === "signin"
            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-bold"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
        )}
      >
        <LogIn className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", currentTab === "signin" ? "text-blue-600 dark:text-blue-400" : "text-slate-400")} />
        <span>Sign In</span>
      </button>

      {/* Create Account Tab */}
      <button
        type="button"
        role="tab"
        aria-selected={currentTab === "signup"}
        onClick={() => handleTabClick("signup")}
        className={cn(
          "flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-98",
          currentTab === "signup"
            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-bold"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
        )}
      >
        <UserPlus className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", currentTab === "signup" ? "text-blue-600 dark:text-blue-400" : "text-slate-400")} />
        <span>Create Account</span>
      </button>
    </div>
  );
};

export const Component = AuthSwitch;
export default AuthSwitch;
