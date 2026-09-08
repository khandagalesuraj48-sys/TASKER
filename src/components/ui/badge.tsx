import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning"
    | "info"
    | "workplace"
    | "personal"
    | "stable"
    | "beta";
  size?: "default" | "sm" | "xs";
  dot?: boolean;
  mono?: boolean;
}

function Badge({
  className,
  variant = "default",
  size = "default",
  dot = false,
  mono = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles: Record<string, string> = {
    default:
      "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
    secondary:
      "border-border/60 bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive:
      "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 dark:bg-rose-500/20",
    outline:
      "border-border bg-transparent text-foreground",
    success:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-500/20",
    warning:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-500/20",
    info:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400 dark:bg-sky-500/20",
    workplace:
      "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 dark:bg-indigo-500/20",
    personal:
      "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 dark:bg-blue-500/20",
    stable:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-500/20 font-semibold",
    beta:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-500/20 font-semibold",
  };

  const dotColors: Record<string, string> = {
    default: "bg-primary-foreground",
    secondary: "bg-muted-foreground",
    destructive: "bg-rose-500",
    outline: "bg-foreground",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    info: "bg-sky-500",
    workplace: "bg-indigo-500",
    personal: "bg-blue-500",
    stable: "bg-emerald-500",
    beta: "bg-amber-500",
  };

  const sizeStyles: Record<string, string> = {
    default: "px-2.5 py-0.5 text-xs font-medium gap-1.5",
    sm: "px-2 py-0.5 text-[11px] font-semibold gap-1",
    xs: "px-1.5 py-0.2 text-[10px] font-bold gap-1",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border transition-colors focus:outline-none focus:ring-1 focus:ring-ring select-none",
        mono && "font-mono tabular-nums",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            dotColors[variant] || "bg-current"
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge };
