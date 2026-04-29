import { cn } from "@/lib/cn";

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "warning" | "success";
  className?: string;
}) {
  const styles =
    variant === "warning"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : variant === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        styles,
        className
      )}
    >
      {children}
    </span>
  );
}

