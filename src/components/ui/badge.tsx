import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "workplace" | "personal";
  size?: "default" | "sm";
}

function Badge({ className, variant = "default", size = "default", ...props }: BadgeProps) {
  const variantStyles: Record<string, string> = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "border-transparent bg-destructive/15 text-destructive border border-destructive/30 dark:bg-destructive/20",
    outline: "text-foreground border-border",
    success: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
    warning: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30",
    info: "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30",
    workplace: "border-transparent bg-workplace/15 text-indigo-700 dark:text-indigo-300 border border-workplace/30",
    personal: "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30",
  };

  const sizeStyles: Record<string, string> = {
    default: "px-2.5 py-0.5 text-xs font-semibold",
    sm: "px-2 py-0.2 text-[10px] font-bold",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-sm border transition-colors focus:outline-none focus:ring-1 focus:ring-ring select-none",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
