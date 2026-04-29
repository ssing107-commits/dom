import * as React from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

function variantClasses(variant: Variant) {
  switch (variant) {
    case "secondary":
      return "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50";
    case "danger":
      return "bg-rose-600 text-white hover:bg-rose-700";
    case "ghost":
      return "bg-transparent text-zinc-900 hover:bg-zinc-100";
    default:
      return "bg-zinc-900 text-white hover:bg-zinc-800";
  }
}

function sizeClasses(size: Size) {
  switch (size) {
    case "sm":
      return "h-9 px-3 text-sm";
    default:
      return "h-10 px-4 text-sm";
  }
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses(variant),
        sizeClasses(size),
        className
      )}
      {...props}
    />
  );
});

