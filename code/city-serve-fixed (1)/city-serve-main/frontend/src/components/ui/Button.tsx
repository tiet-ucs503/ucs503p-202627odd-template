import clsx from "clsx";
import { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className,
  ...props
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary-hover shadow-subtle",
        variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60",
        variant === "outline" && "border border-border bg-card text-foreground hover:bg-secondary/40 shadow-subtle",
        variant === "ghost" && "text-foreground hover:bg-secondary/50",
        variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-subtle",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4.5 py-2.5 text-sm",
        size === "lg" && "px-6 py-3 text-base font-semibold",
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={size === "sm" ? 12 : 15} className="animate-spin shrink-0" />}
      {children}
    </button>
  );
}

