"use client";

import { cn } from "@/lib/cn";

export type TabItem = { id: string; label: string };

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "h-9 rounded-xl px-3 text-sm font-medium transition-colors",
              active
                ? "bg-zinc-900 text-white"
                : "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

