"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";
import type { Dormitory, HousingTenureType, PropertyBuildingType, Resident } from "@/lib/types";
import { HOUSING_TENURE_TYPES, isOccupyingResidentStatus, PROPERTY_BUILDING_TYPES } from "@/lib/types";

type DormRowVM = {
  dorm: Dormitory;
  activeCount: number;
  activeNames: string[];
  activeResidentChips: ResidentDisplayChip[];
  vacancy: number;
  vacancyRoomNames: string[];
  expiringSoon: boolean;
  hasMoveOutOverdue: boolean;
  dDay: number;
  /** 표 정렬용: 해당 기숙사에서 “가장 먼저 나와야 하는” 입주자 역할 */
  primaryResidentRoleRank: number;
  /** 표 정렬용: primaryResidentRoleRank 동률일 때 */
  primaryResidentName: string;
  /** 표에 나오는 값 기준 통합 검색(소문자) */
  searchHaystack: string;
};

type ResidentDisplayChip = {
  id: string;
  displayName: string;
  status: Resident["status"];
};

const BUILDING_TYPE_ORDER: PropertyBuildingType[] = ["아파트", "투룸", "원룸"];

function buildingTypeRank(type: Dormitory["propertyBuildingType"]): number {
  if (!type) return 999;
  const idx = BUILDING_TYPE_ORDER.indexOf(type);
  return idx >= 0 ? idx : 998;
}

function residentRoleRank(name: string): number {
  const n = name.replace(/\(예정\)/g, "").trim();
  if (!n) return 999;
  if (n.includes("대표이사")) return 0;
  if (n.includes("전무")) return 1;
  if (n.includes("상무")) return 2;
  if (n.includes("이사")) return 3;
  return 4;
}

function sortActiveResidentsForDisplay(active: Resident[]): Resident[] {
  const list = [...active];
  return list.sort((a, b) => {
    const ra = residentRoleRank(a.name);
    const rb = residentRoleRank(b.name);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "ko");
  });
}

function buildDashboardSearchHaystack(params: {
  dorm: Dormitory;
  activeResidents: Resident[];
  activeNames: string[];
  vacancy: number;
  vacancyRoomNames: string[];
  hasMoveOutOverdue: boolean;
  dDay: number;
}): string {
  const d = params.dorm;
  const end = d.contractEnd.toDate();
  const start = d.contractStart.toDate();
  const parts: string[] = [];

  const push = (...xs: (string | number | undefined | null)[]) => {
    for (const v of xs) {
      if (v === undefined || v === null) continue;
      const s = String(v).trim();
      if (s) parts.push(s);
    }
  };

  push(d.name, d.address, d.propertyBuildingType, d.housingTenureType, d.rentDueType);
  push(fmtYmd(end), fmtYmd(start));
  push(end.getFullYear(), end.getMonth() + 1, end.getDate());
  push(start.getFullYear(), start.getMonth() + 1, start.getDate());
  push(`d-${params.dDay}`, `D-${params.dDay}`, params.dDay);
  push(fmtMoney(d.deposit), d.deposit, fmtMoney(d.monthlyRent), d.monthlyRent);
  push(String(d.capacity ?? 0), String(params.vacancy));
  push(...params.vacancyRoomNames);

  if (params.vacancy === 0) push("만석");
  if (params.vacancy > 0) push("공실", `${params.vacancy}개`);
  if (params.hasMoveOutOverdue) push("퇴실지연");

  for (const r of params.activeResidents) {
    push(r.name, r.roomLocation, r.memo);
  }
  push(...params.activeNames);

  return parts.join(" ").toLowerCase();
}

const APARTMENT_ROOM_NAMES = ["안방", "중간방", "현관문 앞 방"] as const;
const WHOLE_USE_MARKERS = new Set(["전체사용", "전체 사용", "전체"]);

function diffDays(end: Date) {
  const ms = end.getTime() - new Date().getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function fmtYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fmtMoney(n: number | null | undefined) {
  return `${(n ?? 0).toLocaleString()}원`;
}

function formatAddressForDashboard(address: string | undefined): string {
  const raw = (address ?? "").trim();
  return raw.replace(/^충남\s+/, "");
}

const SELECT_FIELD_CLASS =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400";

export default function DashboardPage() {
  const [items, setItems] = useState<DormRowVM[] | null>(null);
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [exportingReport, setExportingReport] = useState(false);

  function dateToInputValue(d: Date) {
    return fmtYmd(d);
  }

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [onlyExpiring, setOnlyExpiring] = useState(false);
  const [form, setForm] = useState(() => ({
    name: "",
    address: "",
    password: "",
    capacity: "0",
    contractStart: "",
    contractEnd: "",
    deposit: "0",
    monthlyRent: "0",
    rentDueType: "말일" as Dormitory["rentDueType"],
    installOptions: "",
    basicOptions: "",
    propertyBuildingType: "아파트" as PropertyBuildingType,
    housingTenureType: "월세" as HousingTenureType,
    landlordName: "",
    landlordPhone: "",
  }));

  useEffect(() => {
    if (!createOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((prev) => {
      const now = new Date();
      const end = new Date(now);
      end.setFullYear(end.getFullYear() + 1);
      return {
        ...prev,
        contractStart: prev.contractStart || dateToInputValue(now),
        contractEnd: prev.contractEnd || dateToInputValue(end),
      };
    });
  }, [createOpen]);

  async function load() {
    const [{ listDormitories }, { listResidentsByDormitory }] = await Promise.all([
      import("@/lib/firestore/dormitories"),
      import("@/lib/firestore/residents"),
    ]);
    const dorms = await listDormitories();
    const cards = await Promise.all(
      dorms.map(async (d) => {
        const residents = await listResidentsByDormitory(d.id);
        const active = residents.filter((r) => isOccupyingResidentStatus(r.status));
        const activeCount = active.length;
          const activeSorted = sortActiveResidentsForDisplay(active);
        const activeResidentChips = activeSorted
          .map((r) => {
            const n = r.name.trim();
            if (!n) return null;
            const displayName =
              r.status === "scheduled"
                ? `${n}(예정)`
                : r.status === "move_out_scheduled"
                  ? `${n}(퇴실예정)`
                  : n;
            return { id: r.id, displayName, status: r.status };
          })
          .filter((v): v is ResidentDisplayChip => Boolean(v));

        const activeNames = activeResidentChips.map((c) => c.displayName);
        const hasWholeUse =
            d.propertyBuildingType === "아파트" &&
          active.some((r) => {
            const room = (r.roomLocation ?? "").trim();
            return WHOLE_USE_MARKERS.has(room);
          });
        const occupiedRooms = new Set(
          active
            .map((r) => (r.roomLocation ?? "").trim())
            .filter((name) => APARTMENT_ROOM_NAMES.includes(name as (typeof APARTMENT_ROOM_NAMES)[number]))
        );
        const vacancyRoomNames =
            d.propertyBuildingType === "아파트" && !hasWholeUse
            ? APARTMENT_ROOM_NAMES.filter((room) => !occupiedRooms.has(room))
            : [];
        const vacancy =
          d.propertyBuildingType === "아파트"
            ? vacancyRoomNames.length
            : Math.max(0, (d.capacity ?? 0) - activeCount);
        const end = d.contractEnd.toDate();
        const dDay = diffDays(end);
        const expiringSoon = dDay <= 80;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const hasMoveOutOverdue = residents.some((r) => {
          if (r.status === "moved_out") return false;
          if (!r.moveOutDate) return false;
          return r.moveOutDate.toDate().getTime() < today.getTime();
        });
        const searchHaystack = buildDashboardSearchHaystack({
          dorm: d,
          activeResidents: activeSorted,
          activeNames,
          vacancy,
          vacancyRoomNames,
          hasMoveOutOverdue,
          dDay,
        });

          const primaryResident = activeSorted[0];
          const primaryResidentRoleRank = primaryResident ? residentRoleRank(primaryResident.name) : 999;
          const primaryResidentName = primaryResident ? primaryResident.name.trim() : "";

        return {
          dorm: d,
          activeCount,
          activeNames,
            activeResidentChips,
          vacancy,
          vacancyRoomNames,
          expiringSoon,
          hasMoveOutOverdue,
          dDay,
            primaryResidentRoleRank,
            primaryResidentName,
          searchHaystack,
        };
      })
    );
    setItems(cards);
  }

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(() => {
      if (!alive) return;
      setItems([]);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function exportDashboardPpt() {
    const node = reportRef.current;
    if (!node) return;
    setExportingReport(true);
    try {
      const { toPng } = await import("html-to-image");
      const { default: PptxGenJS } = await import("pptxgenjs");
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        filter: (n) => {
          const el = n as HTMLElement;
          return !el.dataset?.reportExclude;
        },
      });

      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "Dorm Manager";
      pptx.subject = "기숙사 전체 현황";
      pptx.title = `기숙사 전체 현황 ${fmtYmd(new Date())}`;

      const slide = pptx.addSlide();
      slide.addText(`기숙사 전체 현황 (${fmtYmd(new Date())})`, {
        x: 0.3,
        y: 0.2,
        w: 12.7,
        h: 0.3,
        fontSize: 16,
        bold: true,
        color: "1f2937",
      });
      slide.addImage({
        data: dataUrl,
        x: 0.3,
        y: 0.55,
        w: 12.7,
        h: 6.45,
      });

      await pptx.writeFile({ fileName: `기숙사-전체현황-보고서-${fmtYmd(new Date())}.pptx` });
      toast({ title: "보고서(PPT) 생성 완료", variant: "success" });
    } catch {
      toast({ title: "보고서 생성 실패", variant: "error" });
    } finally {
      setExportingReport(false);
    }
  }

  const expiringCount = useMemo(
    () => (items ?? []).filter((x) => x.expiringSoon).length,
    [items]
  );
  const overdueMoveOutCount = useMemo(
    () => (items ?? []).filter((x) => x.hasMoveOutOverdue).length,
    [items]
  );

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return (items ?? [])
      .filter((x) => (onlyExpiring ? x.expiringSoon || x.hasMoveOutOverdue : true))
      .filter((x) => {
        if (!q) return true;
        return (x.searchHaystack ?? "").includes(q);
      })
      .sort((a, b) => {
        // 정렬 기준:
        // 1) 건물유형(아파트 → 투룸 → 원룸)
        // 2) 입주자 역할(대표이사 → 상무 → 전무 → 이사)
        // 3) 기숙사 명 가나다순
        const brA = buildingTypeRank(a.dorm.propertyBuildingType);
        const brB = buildingTypeRank(b.dorm.propertyBuildingType);
        if (brA !== brB) return brA - brB;

        if (a.primaryResidentRoleRank !== b.primaryResidentRoleRank) {
          return a.primaryResidentRoleRank - b.primaryResidentRoleRank;
        }

        // 역할이 같으면 해당 역할 내 이름 가나다순
        if (a.primaryResidentName !== b.primaryResidentName) {
          return a.primaryResidentName.localeCompare(b.primaryResidentName, "ko");
        }

        return a.dorm.name.localeCompare(b.dorm.name, "ko");
      });
  }, [items, queryText, onlyExpiring]);

  const totals = useMemo(() => {
    const rows = filtered;
    const active = rows.reduce((s, x) => s + x.activeCount, 0);
    const totalDeposit = rows.reduce((s, x) => s + (x.dorm.deposit ?? 0), 0);
    const totalMonthlyRent = rows.reduce(
      (s, x) => s + (x.dorm.housingTenureType === "전세" ? 0 : (x.dorm.monthlyRent ?? 0)),
      0
    );
    const buildingCounts = PROPERTY_BUILDING_TYPES.map((type) => ({
      type,
      count: rows.filter((x) => x.dorm.propertyBuildingType === type).length,
    })).filter((x) => x.count > 0);
    const tenureCounts = HOUSING_TENURE_TYPES.map((type) => ({
      type,
      count: rows.filter((x) => x.dorm.housingTenureType === type).length,
    })).filter((x) => x.count > 0);
    return { active, count: rows.length, totalDeposit, totalMonthlyRent, buildingCounts, tenureCounts };
  }, [filtered]);

  return (
    <div ref={reportRef} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-semibold">기숙사 전체 현황</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={exportDashboardPpt} disabled={exportingReport}>
            {exportingReport ? "보고서 생성 중..." : "보고서 생성"}
          </Button>
          <button
            type="button"
            onClick={() => setOnlyExpiring((v) => !v)}
            className={cn(
              "h-10 rounded-xl border px-3 text-sm font-medium transition-colors",
              onlyExpiring
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
            )}
          >
            리스크만 보기
          </button>
          <Button onClick={() => setCreateOpen(true)}>기숙사 추가</Button>
        </div>
      </div>

      {items && expiringCount > 0 ? (
        <div
          data-report-exclude="true"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          계약 만료가 <span className="font-semibold">80일 이내</span>로 임박한 기숙사가{" "}
          <span className="font-semibold">{expiringCount}개</span> 있습니다.
        </div>
      ) : null}
      {items && overdueMoveOutCount > 0 ? (
        <div
          data-report-exclude="true"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          퇴실 예정일이 지난 사용자가 있는 기숙사가{" "}
          <span className="font-semibold">{overdueMoveOutCount}개</span> 있습니다.
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div data-report-exclude="true">
              <Input
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="검색 : "
                className="w-[280px] max-w-full"
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600">
              <span>
                총 <span className="font-semibold text-zinc-900">{totals.count}</span>개 / 입주자{" "}
                <span className="font-semibold text-zinc-900">{totals.active}</span>명
              </span>
              <span className="hidden sm:inline text-zinc-300">|</span>
              <span>
                보증금 합계{" "}
                <span className="font-semibold text-zinc-900">{fmtMoney(totals.totalDeposit)}</span>
              </span>
              <span>
                월세 합계{" "}
                <span className="font-semibold text-zinc-900">{fmtMoney(totals.totalMonthlyRent)}</span>
              </span>
            </div>
            {totals.buildingCounts.length > 0 ? (
              <div className="text-sm text-zinc-600">
                건물유형:{" "}
                {totals.buildingCounts.map((x, idx) => (
                  <span key={x.type}>
                    <span className="font-semibold text-zinc-900">{x.type} {x.count}개</span>
                    {idx < totals.buildingCounts.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
            ) : null}
            {totals.tenureCounts.length > 0 ? (
              <div className="text-sm text-zinc-600">
                임대형태:{" "}
                {totals.tenureCounts.map((x, idx) => (
                  <span key={x.type}>
                    <span className="font-semibold text-zinc-900">{x.type} {x.count}개</span>
                    {idx < totals.tenureCounts.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div data-report-exclude="true" className="text-xs text-zinc-500">
            인덱스
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
          {items === null ? (
            <div className="p-4">
              <Skeleton className="h-10" />
              <div className="mt-2 grid gap-2">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-zinc-600">
              표시할 데이터가 없습니다. (검색/필터를 확인하거나 기숙사를 추가하세요)
            </div>
          ) : (
            <table className="w-full min-w-[1180px] border-collapse text-[14px]">
              <thead className="sticky top-0 bg-zinc-50 text-[12px] text-zinc-600">
                <tr className="border-b border-zinc-200">
                  <th className="w-[50px] px-3 py-2 text-left align-top font-medium">번호</th>
                  <th className="w-[70px] px-3 py-2 text-left align-top font-medium">건물유형</th>
                  <th className="w-[70px] px-3 py-2 text-left align-top font-medium">임대형태</th>
                  <th className="px-3 py-2 text-left align-top font-medium">기숙사</th>
                  <th className="px-3 py-2 text-left align-top font-medium">주소</th>
                  <th className="px-3 py-2 text-left align-top font-medium">입주자</th>
                  <th className="px-3 py-2 text-left align-top font-medium">계약만료</th>
                  <th className="px-3 py-2 text-left align-top font-medium">D-day</th>
                  <th className="px-3 py-2 text-left align-top font-medium">보증금</th>
                  <th className="px-3 py-2 text-left align-top font-medium">월세</th>
                  <th className="px-3 py-2 text-left align-top font-medium">지급</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((x, idx) => (
                  <tr
                    key={x.dorm.id}
                    className={cn(
                      "border-b border-zinc-100 hover:bg-zinc-50",
                      idx % 2 === 1 ? "bg-white" : "bg-white"
                    )}
                  >
                    <td className="w-[50px] px-3 py-2 text-left align-top text-zinc-500">
                      {idx + 1}
                    </td>
                    <td className="w-[70px] px-3 py-2 text-left align-top text-zinc-800">
                      {x.dorm.propertyBuildingType ?? "-"}
                    </td>
                    <td className="w-[70px] px-3 py-2 text-left align-top text-zinc-800">
                      {x.dorm.housingTenureType ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-left align-top">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dormitory/${x.dorm.id}`}
                          className="min-w-0 flex-1 truncate font-semibold text-zinc-900 hover:underline"
                          title={x.dorm.name}
                        >
                          {x.dorm.name}
                        </Link>
                        <div className="ml-auto flex shrink-0 items-center gap-2">
                          {x.vacancy === 0 ? <Badge variant="warning">만석</Badge> : null}
                          {x.vacancy > 0 ? (
                            <Badge variant="success">공실 {x.vacancy}개</Badge>
                          ) : null}
                          {x.vacancyRoomNames.length > 0 ? (
                            <Badge>{x.vacancyRoomNames.join(", ")}</Badge>
                          ) : null}
                          {x.hasMoveOutOverdue ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                              퇴실지연
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-left align-top text-zinc-700">
                      {formatAddressForDashboard(x.dorm.address)}
                    </td>
                    <td className="px-3 py-2 text-left align-top">
                      <ResidentNames residents={x.activeResidentChips} />
                    </td>
                    <td className="px-3 py-2 text-left align-top whitespace-nowrap">
                      {x.dorm.housingTenureType === "소유" ? "" : fmtYmd(x.dorm.contractEnd.toDate())}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-left align-top font-semibold",
                        x.expiringSoon ? "text-rose-700" : ""
                      )}
                    >
                      {x.dorm.housingTenureType === "소유" ? "소유" : `D-${x.dDay}`}
                    </td>
                    <td className="px-3 py-2 text-left align-top">
                      {x.dorm.housingTenureType === "소유" ? "" : fmtMoney(x.dorm.deposit)}
                    </td>
                    <td className="px-3 py-2 text-left align-top">
                      {x.dorm.housingTenureType === "전세" || x.dorm.housingTenureType === "소유"
                        ? ""
                        : fmtMoney(x.dorm.monthlyRent)}
                    </td>
                    <td className="px-3 py-2 text-left align-top">{x.dorm.rentDueType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="기숙사 추가"
        description="등록 후 표에서 해당 기숙사를 클릭해 상세로 이동할 수 있습니다."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              취소
            </Button>
            <Button
              disabled={creating}
              onClick={async () => {
                if (!form.name.trim()) {
                  toast({ title: "기숙사명을 입력해주세요.", variant: "error" });
                  return;
                }
                if (!form.address.trim()) {
                  toast({ title: "주소를 입력해주세요.", variant: "error" });
                  return;
                }
                if (!form.contractStart || !form.contractEnd) {
                  toast({ title: "계약 시작일/만료일을 입력해주세요.", variant: "error" });
                  return;
                }
                setCreating(true);
                try {
                  const [{ createDormitory }, { timestampFromDateInput }] = await Promise.all([
                    import("@/lib/firestore/dormitories"),
                    import("@/lib/firestore/residents"),
                  ]);
                  await createDormitory({
                    name: form.name,
                    address: form.address,
                    password: form.password,
                    capacity: Number(form.capacity || 0),
                    contractStart: timestampFromDateInput(form.contractStart),
                    contractEnd: timestampFromDateInput(form.contractEnd),
                    deposit: Number(form.deposit || 0),
                    monthlyRent: Number(form.monthlyRent || 0),
                    rentDueType: form.rentDueType,
                    installOptions: form.installOptions
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    basicOptions: form.basicOptions
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    propertyBuildingType: form.propertyBuildingType,
                    housingTenureType: form.housingTenureType,
                    landlord: {
                      name: form.landlordName,
                      phone: form.landlordPhone,
                    },
                  });
                  toast({ title: "기숙사 등록 완료", variant: "success" });
                  setCreateOpen(false);
                  setForm({
                    name: "",
                    address: "",
                    password: "",
                    capacity: "0",
                    contractStart: "",
                    contractEnd: "",
                    deposit: "0",
                    monthlyRent: "0",
                    rentDueType: "말일",
                    installOptions: "",
                    basicOptions: "",
                    propertyBuildingType: "아파트",
                    housingTenureType: "월세",
                    landlordName: "",
                    landlordPhone: "",
                  });
                  await load();
                } catch (err) {
                  toast({
                    title: "등록 실패",
                    description: err instanceof Error ? err.message : "Firestore 규칙/키를 확인해주세요.",
                    variant: "error",
                  });
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? "등록 중..." : "등록"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="기숙사명">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="주소">
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="비밀번호">
            <Input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <Field label="정원">
            <Input
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              inputMode="numeric"
            />
          </Field>
          <Field label="계약 시작일">
            <DatePickerInput
              value={form.contractStart}
              onChange={(value) => setForm({ ...form, contractStart: value })}
            />
          </Field>
          <Field label="계약 만료일">
            <DatePickerInput
              value={form.contractEnd}
              onChange={(value) => setForm({ ...form, contractEnd: value })}
            />
          </Field>
          <Field label="보증금">
            <Input
              value={form.deposit}
              onChange={(e) => setForm({ ...form, deposit: e.target.value })}
              inputMode="numeric"
            />
          </Field>
          <Field label="임차료(월)">
            <Input
              value={form.monthlyRent}
              onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })}
              inputMode="numeric"
            />
          </Field>
          <Field label="지급일자 (10일/말일)">
            <Input
              value={form.rentDueType}
              onChange={(e) =>
                setForm({ ...form, rentDueType: e.target.value as Dormitory["rentDueType"] })
              }
            />
          </Field>
          <Field label="기본 옵션(콤마 구분)">
            <Input
              value={form.basicOptions}
              onChange={(e) => setForm({ ...form, basicOptions: e.target.value })}
            />
          </Field>
          <Field label="설치 옵션(콤마 구분)">
            <Input
              value={form.installOptions}
              onChange={(e) => setForm({ ...form, installOptions: e.target.value })}
            />
          </Field>
          <Field label="건물유형">
            <select
              className={SELECT_FIELD_CLASS}
              value={form.propertyBuildingType}
              onChange={(e) =>
                setForm({
                  ...form,
                  propertyBuildingType: e.target.value as PropertyBuildingType,
                })
              }
            >
              {PROPERTY_BUILDING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="임대형태 (월세/전세/소유)">
            <select
              className={SELECT_FIELD_CLASS}
              value={form.housingTenureType}
              onChange={(e) =>
                setForm({ ...form, housingTenureType: e.target.value as HousingTenureType })
              }
            >
              {HOUSING_TENURE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="임대인 이름">
            <Input
              value={form.landlordName}
              onChange={(e) => setForm({ ...form, landlordName: e.target.value })}
            />
          </Field>
          <Field label="임대인 연락처">
            <Input
              value={form.landlordPhone}
              onChange={(e) => setForm({ ...form, landlordPhone: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1 text-sm font-medium">{label}</div>
      {children}
    </div>
  );
}

function ResidentNames({ residents }: { residents: ResidentDisplayChip[] }) {
  if (!residents || residents.length === 0) return <span className="text-zinc-500">-</span>;
  const shown = residents.slice(0, 4);
  const rest = residents.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((r) => {
        const pillClass = cn(
          "rounded-full border px-2.5 py-1 text-xs font-medium",
          r.status === "active"
            ? "border-zinc-200 bg-white text-zinc-700"
            : r.status === "scheduled"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : r.status === "move_out_scheduled"
                ? "border-sky-200 bg-sky-50 text-sky-800"
                : "border-zinc-200 bg-zinc-50 text-zinc-700"
        );

        return (
          <span key={`${r.id}-${r.displayName}`} className={pillClass}>
            {r.displayName}
          </span>
        );
      })}
      {rest > 0 ? (
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}

