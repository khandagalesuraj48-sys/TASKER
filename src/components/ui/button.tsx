import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "workplace";
  size?: "default" | "sm" | "lg" | "icon" | "xs";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 select-none";

    const variantStyles: Record<string, string> = {
      default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/95",
      destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
      outline: "border border-input bg-background shadow-xs hover:bg-muted hover:text-foreground text-foreground",
      secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
      ghost: "hover:bg-muted hover:text-foreground text-muted-foreground",
      link: "text-primary underline-offset-4 hover:underline",
      workplace: "bg-workplace text-workplace-foreground shadow-xs hover:bg-workplace/90",
    };

    const sizeStyles: Record<string, string> = {
      default: "h-9 px-4 py-2",
      xs: "h-7 px-2.5 text-[11px]",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-6 text-sm sm:text-base",
      icon: "h-9 w-9",
    };

    return (
      <button
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
