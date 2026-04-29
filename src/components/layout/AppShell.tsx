"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import type { Dormitory } from "@/lib/types";
import { PROPERTY_BUILDING_TYPES } from "@/lib/types";

function buildingTypeKey(d: Dormitory): string {
  const raw = d.propertyBuildingType;
  if (raw && (PROPERTY_BUILDING_TYPES as readonly string[]).includes(raw)) return raw;
  if (raw?.trim()) return raw.trim();
  return "미지정";
}

function groupDormsByBuildingType(dorms: Dormitory[]): { type: string; list: Dormitory[] }[] {
  const buckets = new Map<string, Dormitory[]>();
  for (const d of dorms) {
    const k = buildingTypeKey(d);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(d);
  }
  const ordered: { type: string; list: Dormitory[] }[] = [];
  const used = new Set<string>();
  for (const t of PROPERTY_BUILDING_TYPES) {
    const list = buckets.get(t);
    if (!list?.length) continue;
    used.add(t);
    list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    ordered.push({ type: t, list });
  }
  const misc = buckets.get("미지정");
  if (misc?.length) {
    used.add("미지정");
    misc.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    ordered.push({ type: "미지정", list: misc });
  }
  const rest = [...buckets.entries()]
    .filter(([k, list]) => !used.has(k) && list.length > 0)
    .sort(([a], [b]) => a.localeCompare(b, "ko"));
  for (const [type, list] of rest) {
    list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    ordered.push({ type, list });
  }
  return ordered;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [dorms, setDorms] = useState<Dormitory[] | null>(null);
  const [openByType, setOpenByType] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    import("@/lib/firestore/dormitories")
      .then((m) => m.listDormitories())
      .then((list) => {
        if (!alive) return;
        setDorms(list);
      })
      .catch(() => {
        if (!alive) return;
        setDorms([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const groups = useMemo(() => (dorms ? groupDormsByBuildingType(dorms) : []), [dorms]);

  useEffect(() => {
    if (!dorms?.length) return;
    setOpenByType((prev) => {
      const next = { ...prev };
      for (const { type } of groupDormsByBuildingType(dorms)) {
        if (next[type] === undefined) next[type] = true;
      }
      return next;
    });
  }, [dorms]);

  useEffect(() => {
    if (!dorms?.length || !pathname.startsWith("/dormitory/")) return;
    const id = pathname.split("/")[2];
    const d = dorms.find((x) => x.id === id);
    if (!d) return;
    const t = buildingTypeKey(d);
    setOpenByType((prev) => ({ ...prev, [t]: true }));
  }, [pathname, dorms]);

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white p-4 md:block">
        <nav className="flex flex-col gap-2">
          {dorms === null ? (
            <>
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </>
          ) : (
            <>
              <Link
                href="/dashboard"
                className={cn(
                  "rounded-xl px-3 py-2 text-sm transition-colors",
                  pathname === "/dashboard"
                    ? "bg-zinc-900 text-white"
                    : "hover:bg-zinc-100"
                )}
              >
                기숙사 전체 현황
              </Link>

              <div className="flex flex-col gap-1 border-t border-zinc-100 pt-2">
                {groups.map(({ type, list }) => {
                  const open = openByType[type] ?? true;
                  return (
                    <div key={type} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenByType((p) => ({
                            ...p,
                            [type]: !(p[type] ?? true),
                          }))
                        }
                        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:bg-zinc-50"
                        aria-expanded={open}
                      >
                        <span
                          className={cn(
                            "inline-block text-[10px] text-zinc-400 transition-transform",
                            open ? "rotate-90" : ""
                          )}
                          aria-hidden
                        >
                          ▶
                        </span>
                        <span className="normal-case tracking-normal">{type}</span>
                        <span className="ml-auto font-normal text-zinc-400">{list.length}</span>
                      </button>
                      {open ? (
                        <div className="ml-2 flex flex-col gap-0.5 border-l border-zinc-200 py-0.5 pl-2">
                          {list.map((d) => {
                            const href = `/dormitory/${d.id}`;
                            const active = pathname === href;
                            return (
                              <Link
                                key={d.id}
                                href={href}
                                className={cn(
                                  "rounded-lg py-1.5 pl-2 pr-2 text-sm leading-snug transition-colors",
                                  active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                                )}
                              >
                                {d.name}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/dashboard" className="text-sm font-semibold">
              기숙사 전체 현황
            </Link>
          </div>
        </header>

        <main className="flex flex-1 flex-col p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

