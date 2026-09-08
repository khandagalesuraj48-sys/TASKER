import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "workplace";
  size?: "default" | "sm" | "lg" | "icon" | "xs";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs sm:text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]";

    const variantStyles: Record<string, string> = {
      default:
        "bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 hover:shadow-xs",
      primary:
        "bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 hover:shadow-xs",
      destructive:
        "bg-destructive text-destructive-foreground shadow-2xs hover:bg-destructive/90 hover:shadow-xs",
      outline:
        "border border-border/80 bg-background text-foreground shadow-2xs hover:bg-muted hover:text-foreground",
      secondary:
        "bg-secondary text-secondary-foreground shadow-2xs hover:bg-secondary/80",
      ghost:
        "hover:bg-muted hover:text-foreground text-muted-foreground",
      link:
        "text-primary underline-offset-4 hover:underline p-0 h-auto",
      workplace:
        "bg-workplace text-workplace-foreground shadow-2xs hover:bg-workplace/90 hover:shadow-xs",
    };

    const sizeStyles: Record<string, string> = {
      default: "h-9 px-4 py-2 gap-2",
      xs: "h-7 px-2.5 text-[11px] gap-1.5 rounded-md",
      sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
      lg: "h-10 px-5 text-sm gap-2.5 rounded-lg",
      icon: "h-9 w-9 p-0",
    };

    return (
      <button
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        ) : (
          leftIcon
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
