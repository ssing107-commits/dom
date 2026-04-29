"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";
import type {
  Dormitory,
  HousingTenureType,
  MaintenanceRecord,
  MoveRecord,
  PropertyBuildingType,
  Resident,
} from "@/lib/types";
import {
  HOUSING_TENURE_TYPES,
  isOccupyingResidentStatus,
  PROPERTY_BUILDING_TYPES,
} from "@/lib/types";

// Firebase Client SDK는 빌드/프리렌더 단계(서버)에서 평가되면 실패할 수 있어,
// 실제 브라우저 런타임에서만 동적으로 import하여 사용합니다.
async function apiDormitories() {
  return import("@/lib/firestore/dormitories");
}
async function apiResidents() {
  return import("@/lib/firestore/residents");
}
async function apiMoveRecords() {
  return import("@/lib/firestore/moveRecords");
}
async function apiMaintenance() {
  return import("@/lib/firestore/maintenanceRecords");
}

type TabId = "info" | "residents" | "moves" | "maintenance";

function fmtDate(ts: Timestamp | null | undefined) {
  if (!ts) return "-";
  const d = ts.toDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function dDay(end: Timestamp) {
  const ms = end.toDate().getTime() - new Date().getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function toDateInputValue(ts: Timestamp | null) {
  if (!ts) return "";
  return fmtDate(ts);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const SELECT_FIELD_CLASS =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400";

export default function DormitoryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabId>("info");
  const [dorm, setDorm] = useState<Dormitory | null>(null);
  const [residents, setResidents] = useState<Resident[] | null>(null);
  const [moves, setMoves] = useState<MoveRecord[] | null>(null);
  const [maint, setMaint] = useState<MaintenanceRecord[] | null>(null);

  const [showPw, setShowPw] = useState(false);

  const [editDormOpen, setEditDormOpen] = useState(false);
  const [residentModal, setResidentModal] = useState<null | { mode: "new" | "edit"; r?: Resident }>(
    null
  );
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveEditRecord, setMoveEditRecord] = useState<MoveRecord | null>(null);
  const [maintModalOpen, setMaintModalOpen] = useState(false);
  const [deleteDormOpen, setDeleteDormOpen] = useState(false);
  const [deleteDormBusy, setDeleteDormBusy] = useState(false);

  const activeCount = useMemo(() => {
    if (!residents) return 0;
    return residents.filter((r) => isOccupyingResidentStatus(r.status)).length;
  }, [residents]);

  const vacancy = useMemo(() => {
    if (!dorm) return 0;
    return Math.max(0, dorm.capacity - activeCount);
  }, [dorm, activeCount]);

  const expiring = useMemo(() => {
    if (!dorm) return false;
    return dDay(dorm.contractEnd) <= 80;
  }, [dorm]);

  async function reloadAll() {
    const { getDormitory } = await apiDormitories();
    const { listResidentsByDormitory } = await apiResidents();
    const { listMoveRecords } = await apiMoveRecords();
    const { listMaintenanceRecords } = await apiMaintenance();

    const d = await getDormitory(id);
    setDorm(d);
    const r = await listResidentsByDormitory(id);
    setResidents(r);
    const m = await listMoveRecords(id);
    setMoves(m);
    const mt = await listMaintenanceRecords(id);
    setMaint(mt);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reloadAll().catch(() => {
      toast({ title: "데이터 로딩 실패", variant: "error" });
      setDorm(null);
      setResidents([]);
      setMoves([]);
      setMaint([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (dorm === null || residents === null || moves === null || maint === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!dorm) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        기숙사 정보를 찾을 수 없습니다.
      </div>
    );
  }

  const tabs = [
    { id: "info", label: "기본 정보" },
    { id: "residents", label: "사용자 관리" },
    { id: "moves", label: "입퇴실 기록" },
    { id: "maintenance", label: "시설 관리" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-semibold">{dorm.name}</div>
            {vacancy === 0 ? <Badge variant="warning">만석</Badge> : null}
          </div>
          <div className="mt-1 text-sm text-zinc-600">{dorm.address}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setEditDormOpen(true)}>
            기본 정보 편집
          </Button>
          <Button variant="danger" onClick={() => setDeleteDormOpen(true)}>
            기숙사 삭제
          </Button>
        </div>
      </div>

      {expiring ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          계약 만료까지 <span className="font-semibold">D-{dDay(dorm.contractEnd)}</span> 입니다.
        </div>
      ) : null}

      <Tabs items={tabs} value={tab} onChange={(v) => setTab(v as TabId)} />

      {tab === "info" ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 lg:col-span-2">
            <div className="grid gap-3 md:grid-cols-2">
              <InfoItem label="정원" value={`${dorm.capacity}명`} />
              <InfoItem label="현재 사용자수" value={`${activeCount}명`} />
              <InfoItem label="잔여(공실)수" value={`${vacancy}명`} />
              <InfoItem
                label="계약 기간"
                value={`${fmtDate(dorm.contractStart)} ~ ${fmtDate(dorm.contractEnd)}`}
              />
              <InfoItem label="보증금" value={`${(dorm.deposit ?? 0).toLocaleString()}원`} />
              <InfoItem label="임차료" value={`${(dorm.monthlyRent ?? 0).toLocaleString()}원`} />
              <InfoItem label="지급일자" value={dorm.rentDueType} />
              <InfoItem label="건물유형" value={dorm.propertyBuildingType ?? "-"} />
              <InfoItem label="임대형태" value={dorm.housingTenureType ?? "-"} />
              <div className="rounded-xl bg-zinc-50 p-3">
                <div className="text-xs text-zinc-500">기숙사 비밀번호</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="font-semibold">{showPw ? dorm.password : "••••••••"}</div>
                  <Button size="sm" variant="ghost" onClick={() => setShowPw((v) => !v)}>
                    {showPw ? "숨김" : "표시"}
                  </Button>
                </div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3 md:col-span-2">
                <div className="text-xs text-zinc-500">기본 옵션</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(dorm.basicOptions ?? []).length === 0 ? (
                    <span className="text-sm text-zinc-600">-</span>
                  ) : (
                    (dorm.basicOptions ?? []).map((o) => (
                      <span
                        key={o}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs"
                      >
                        {o}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3 md:col-span-2">
                <div className="text-xs text-zinc-500">설치 옵션</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(dorm.installOptions ?? []).length === 0 ? (
                    <span className="text-sm text-zinc-600">-</span>
                  ) : (
                    dorm.installOptions.map((o) => (
                      <span
                        key={o}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs"
                      >
                        {o}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">임대인 정보</div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-zinc-600">이름</div>
                <div className="font-medium">{dorm.landlord?.name ?? "-"}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-zinc-600">연락처</div>
                <div className="font-medium">{dorm.landlord?.phone ?? "-"}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "residents" ? (
        <div className="rounded-2xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between gap-2 p-4">
            <div>
              <div className="text-sm font-semibold">사용자 관리</div>
              <div className="mt-1 text-xs text-zinc-500">행을 더블클릭하면 편집합니다.</div>
            </div>
            <Button onClick={() => setResidentModal({ mode: "new" })}>사용자 추가</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] border-t border-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">이름</th>
                  <th className="px-4 py-3 text-left font-medium">메모</th>
                  <th className="px-4 py-3 text-left font-medium">방위치</th>
                  <th className="px-4 py-3 text-left font-medium">입주일</th>
                  <th className="px-4 py-3 text-left font-medium">퇴실(예정)일</th>
                  <th className="px-4 py-3 text-left font-medium">상태</th>
                  <th className="px-4 py-3 text-right font-medium">액션</th>
                </tr>
              </thead>
              <tbody>
                {residents
                  .filter((r) => r.status !== "moved_out")
                  .map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-zinc-100 hover:bg-zinc-50"
                      onDoubleClick={() => setResidentModal({ mode: "edit", r })}
                    >
                      <td className="px-4 py-3 align-top font-medium">{r.name}</td>
                      <td className="max-w-[min(28rem,45vw)] px-4 py-3 align-top text-zinc-700">
                        {r.memo?.trim() ? (
                          <span className="block whitespace-pre-wrap break-words text-sm leading-snug">
                            {r.memo}
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-zinc-700">
                        {r.roomLocation?.trim() ? r.roomLocation : "-"}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">{fmtDate(r.moveInDate)}</td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">{fmtDate(r.moveOutDate)}</td>
                      <td className="px-4 py-3 align-top">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            const date = Timestamp.fromDate(new Date());
                            try {
                              const { markResidentMovedOut } = await apiResidents();
                              await markResidentMovedOut({
                                residentId: r.id,
                                dormitoryId: dorm.id,
                                residentName: r.name,
                                moveOutDate: date,
                                note: "퇴실 처리",
                              });
                              toast({ title: "퇴실 처리 완료", variant: "success" });
                              await reloadAll();
                            } catch {
                              toast({ title: "퇴실 처리 실패", variant: "error" });
                            }
                          }}
                        >
                          퇴실 처리
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "moves" ? (
        <MoveRecordsPanel
          dormitoryId={dorm.id}
          moves={moves}
          onAdd={() => setMoveModalOpen(true)}
          onEditRecord={(r) => setMoveEditRecord(r)}
          onExport={() => {
            const rows = [
              ["날짜", "이름", "구분", "비고"],
              ...moves.map((m) => [
                fmtDate(m.date),
                m.residentName,
                m.type === "move_in" ? "입실" : "퇴실",
                m.note ?? "",
              ]),
            ];
            downloadCsv(`move-records-${dorm.name}.csv`, rows);
          }}
        />
      ) : null}

      {tab === "maintenance" ? (
        <MaintenancePanel
          items={maint}
          onAdd={() => setMaintModalOpen(true)}
          onUpdate={async (id2, patch) => {
            const { updateMaintenanceRecord } = await apiMaintenance();
            await updateMaintenanceRecord(id2, patch);
            await reloadAll();
          }}
        />
      ) : null}

      <EditDormitoryModal
        open={editDormOpen}
        dorm={dorm}
        onClose={() => setEditDormOpen(false)}
        onSave={async (patch) => {
          const { updateDormitory } = await apiDormitories();
          await updateDormitory(dorm.id, patch);
          toast({ title: "저장 완료", variant: "success" });
          setEditDormOpen(false);
          await reloadAll();
        }}
      />

      <Modal
        open={deleteDormOpen}
        onClose={() => {
          if (!deleteDormBusy) setDeleteDormOpen(false);
        }}
        title="기숙사 삭제"
        description={`「${dorm.name}」과(와) 연결된 사용자, 입퇴실 기록, 시설 관리 항목이 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteDormOpen(false)}
              disabled={deleteDormBusy}
            >
              취소
            </Button>
            <Button
              variant="danger"
              disabled={deleteDormBusy}
              onClick={async () => {
                setDeleteDormBusy(true);
                try {
                  const { deleteDormitoryCascade } = await apiDormitories();
                  await deleteDormitoryCascade(dorm.id);
                  toast({ title: "기숙사가 삭제되었습니다.", variant: "success" });
                  setDeleteDormOpen(false);
                  router.push("/dashboard");
                } catch (e) {
                  toast({
                    title: "삭제 실패",
                    description: e instanceof Error ? e.message : "Firestore 규칙을 확인해주세요.",
                    variant: "error",
                  });
                } finally {
                  setDeleteDormBusy(false);
                }
              }}
            >
              {deleteDormBusy ? "삭제 중..." : "삭제"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">
          대시보드로 이동합니다. 사이드 메뉴에 남아 있던 이 기숙사 링크는 새로고침 후 사라집니다.
        </p>
      </Modal>

      <ResidentModal
        open={residentModal !== null}
        mode={residentModal?.mode ?? "new"}
        resident={residentModal?.r}
        dorm={dorm}
        dormitoryId={dorm.id}
        onClose={() => setResidentModal(null)}
        onSaved={async () => {
          setResidentModal(null);
          await reloadAll();
        }}
      />

      <MoveRecordModal
        open={moveModalOpen}
        dormitoryId={dorm.id}
        onClose={() => setMoveModalOpen(false)}
        onSaved={async () => {
          setMoveModalOpen(false);
          await reloadAll();
        }}
      />

      <MoveRecordEditModal
        open={moveEditRecord !== null}
        record={moveEditRecord}
        onClose={() => setMoveEditRecord(null)}
        onSaved={async () => {
          setMoveEditRecord(null);
          await reloadAll();
        }}
      />

      <MaintenanceModal
        open={maintModalOpen}
        dormitoryId={dorm.id}
        onClose={() => setMaintModalOpen(false)}
        onSaved={async () => {
          setMaintModalOpen(false);
          await reloadAll();
        }}
      />
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: Resident["status"] }) {
  const text =
    status === "active"
      ? "입주중"
      : status === "scheduled"
        ? "입주예정"
        : status === "move_out_scheduled"
          ? "퇴실예정"
          : "퇴실";
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
        status === "active"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : status === "scheduled"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : status === "move_out_scheduled"
              ? "border-sky-200 bg-sky-50 text-sky-800"
              : "border-zinc-200 bg-zinc-50 text-zinc-700"
      )}
    >
      {text}
    </span>
  );
}

function EditDormitoryModal(props: {
  open: boolean;
  dorm: Dormitory;
  onClose: () => void;
  onSave: (patch: Partial<Omit<Dormitory, "id" | "createdAt">>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    name: props.dorm.name,
    address: props.dorm.address,
    password: props.dorm.password,
    capacity: String(props.dorm.capacity),
    deposit: String(props.dorm.deposit),
    monthlyRent: String(props.dorm.monthlyRent),
    rentDueType: props.dorm.rentDueType,
    contractStart: toDateInputValue(props.dorm.contractStart),
    contractEnd: toDateInputValue(props.dorm.contractEnd),
    installOptions: (props.dorm.installOptions ?? []).join(", "),
    basicOptions: (props.dorm.basicOptions ?? []).join(", "),
    propertyBuildingType: (props.dorm.propertyBuildingType ?? "아파트") as PropertyBuildingType,
    housingTenureType: (props.dorm.housingTenureType ?? "월세") as HousingTenureType,
    landlordName: props.dorm.landlord?.name ?? "",
    landlordPhone: props.dorm.landlord?.phone ?? "",
  }));

  useEffect(() => {
    if (!props.open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: props.dorm.name,
      address: props.dorm.address,
      password: props.dorm.password,
      capacity: String(props.dorm.capacity),
      deposit: String(props.dorm.deposit),
      monthlyRent: String(props.dorm.monthlyRent),
      rentDueType: props.dorm.rentDueType,
      contractStart: toDateInputValue(props.dorm.contractStart),
      contractEnd: toDateInputValue(props.dorm.contractEnd),
      installOptions: (props.dorm.installOptions ?? []).join(", "),
      basicOptions: (props.dorm.basicOptions ?? []).join(", "),
      propertyBuildingType: (props.dorm.propertyBuildingType ?? "아파트") as PropertyBuildingType,
      housingTenureType: (props.dorm.housingTenureType ?? "월세") as HousingTenureType,
      landlordName: props.dorm.landlord?.name ?? "",
      landlordPhone: props.dorm.landlord?.phone ?? "",
    });
  }, [props.open, props.dorm]);

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="기본 정보 편집"
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose} disabled={saving}>
            취소
          </Button>
          <Button
            onClick={async () => {
              setSaving(true);
              const { timestampFromDateInput } = await apiResidents();
              await props.onSave({
                name: form.name,
                address: form.address,
                password: form.password,
                capacity: Number(form.capacity || 0),
                deposit: Number(form.deposit || 0),
                monthlyRent: Number(form.monthlyRent || 0),
                rentDueType: form.rentDueType as Dormitory["rentDueType"],
                contractStart: timestampFromDateInput(form.contractStart),
                contractEnd: timestampFromDateInput(form.contractEnd),
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
              setSaving(false);
            }}
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장"}
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

function ResidentModal(props: {
  open: boolean;
  mode: "new" | "edit";
  resident?: Resident;
  dorm: Dormitory;
  dormitoryId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    name: props.resident?.name ?? "",
    roomLocation: props.resident?.roomLocation ?? "",
    moveInDate: props.resident ? toDateInputValue(props.resident.moveInDate) : "",
    moveOutDate: props.resident ? toDateInputValue(props.resident.moveOutDate) : "",
    status: props.resident?.status ?? "active",
    memo: props.resident?.memo ?? "",
  }));

  useEffect(() => {
    if (!props.open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: props.resident?.name ?? "",
      roomLocation: props.resident?.roomLocation ?? "",
      moveInDate: props.resident ? toDateInputValue(props.resident.moveInDate) : "",
      moveOutDate: props.resident ? toDateInputValue(props.resident.moveOutDate) : "",
      status: props.resident?.status ?? "active",
      memo: props.resident?.memo ?? "",
    });
  }, [props.open, props.resident]);

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === "new" ? "사용자 추가" : "사용자 편집"}
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose} disabled={saving}>
            취소
          </Button>
          <Button
            onClick={async () => {
              if (!form.name.trim()) {
                toast({ title: "이름을 입력해주세요.", variant: "error" });
                return;
              }
              if (!form.moveInDate) {
                toast({ title: "입주(예정)일을 입력해주세요.", variant: "error" });
                return;
              }
              setSaving(true);
              try {
                const { timestampFromDateInput, createResident, updateResident } =
                  await apiResidents();
                const { createMoveRecord } = await apiMoveRecords();
                if (props.mode === "new") {
                  const residentId = await createResident({
                    dormitoryId: props.dormitoryId,
                    name: form.name.trim(),
                    phone: "",
                    roomLocation: form.roomLocation.trim(),
                    moveInDate: timestampFromDateInput(form.moveInDate),
                    moveOutDate: form.moveOutDate ? timestampFromDateInput(form.moveOutDate) : null,
                    status: form.status as Resident["status"],
                    memo: form.memo,
                  });
                  await createMoveRecord({
                    dormitoryId: props.dormitoryId,
                    residentId,
                    residentName: form.name,
                    type: "move_in",
                    date: timestampFromDateInput(form.moveInDate),
                    note: "입실 기록(자동)",
                  });
                } else if (props.resident) {
                  await updateResident(props.resident.id, {
                    name: form.name.trim(),
                    phone: "",
                    roomLocation: form.roomLocation.trim(),
                    moveInDate: timestampFromDateInput(form.moveInDate),
                    moveOutDate: form.moveOutDate ? timestampFromDateInput(form.moveOutDate) : null,
                    status: form.status as Resident["status"],
                    memo: form.memo,
                  });
                }
                toast({ title: "저장 완료", variant: "success" });
                await props.onSaved();
              } catch (err) {
                toast({
                  title: "저장 실패",
                  description: err instanceof Error ? err.message : "입력값/권한을 확인해주세요.",
                  variant: "error",
                });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="이름">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="방위치">
          {props.dorm.propertyBuildingType === "아파트" ? (
            <select
              className={SELECT_FIELD_CLASS}
              value={form.roomLocation}
              onChange={(e) => setForm({ ...form, roomLocation: e.target.value })}
            >
              <option value="">선택 안함</option>
              <option value="안방">안방</option>
              <option value="중간방">중간방</option>
              <option value="현관문 앞 방">현관문 앞 방</option>
              <option value="전체사용">전체사용</option>
            </select>
          ) : (
            <Input
              value={form.roomLocation}
              onChange={(e) => setForm({ ...form, roomLocation: e.target.value })}
              placeholder="예: 301호, A동 2층"
            />
          )}
        </Field>
        <Field label="입주(예정)일">
          <DatePickerInput
            value={form.moveInDate}
            onChange={(value) => setForm({ ...form, moveInDate: value })}
          />
        </Field>
        <Field label="퇴실(예정)일 (선택)">
          <DatePickerInput
            value={form.moveOutDate}
            onChange={(value) => setForm({ ...form, moveOutDate: value })}
            placeholder="미정이면 비워두세요"
          />
        </Field>
        <Field label="상태">
          <select
            className={SELECT_FIELD_CLASS}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Resident["status"] })}
          >
            <option value="active">입주중</option>
            <option value="scheduled">입주예정</option>
            <option value="move_out_scheduled">퇴실예정</option>
            <option value="moved_out">퇴실</option>
          </select>
        </Field>
        <Field label="메모" className="md:col-span-2">
          <Input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function MoveRecordsPanel(props: {
  dormitoryId: string;
  moves: MoveRecord[];
  onAdd: () => void;
  onEditRecord: (r: MoveRecord) => void;
  onExport: () => void;
}) {
  const [type, setType] = useState<"" | "move_in" | "move_out">("");
  const [ym, setYm] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const filtered = useMemo(() => {
    const [y, m] = ym.split("-").map(Number);
    return props.moves.filter((r) => {
      const d = r.date.toDate();
      const okMonth = d.getFullYear() === y && d.getMonth() + 1 === m;
      const okType = type ? r.type === type : true;
      return okMonth && okType;
    });
  }, [props.moves, ym, type]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div>
          <div className="text-sm font-semibold">입퇴실 기록</div>
          <div className="mt-1 text-xs text-zinc-500">
            행을 더블클릭하면 수정·삭제할 수 있습니다. 필터 후 CSV로 내보낼 수 있습니다.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={ym} onChange={(e) => setYm(e.target.value)} type="month" />
          <Input
            value={type}
            onChange={(e) => setType(e.target.value as "" | "move_in" | "move_out")}
            placeholder="move_in / move_out"
          />
          <Button variant="secondary" onClick={props.onExport}>
            CSV 내보내기
          </Button>
          <Button onClick={props.onAdd}>기록 추가</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-t border-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">날짜</th>
              <th className="px-4 py-3 text-left font-medium">이름</th>
              <th className="px-4 py-3 text-left font-medium">구분</th>
              <th className="px-4 py-3 text-left font-medium">비고</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
                onDoubleClick={() => props.onEditRecord(r)}
              >
                <td className="px-4 py-3">{fmtDate(r.date)}</td>
                <td className="px-4 py-3 font-medium">{r.residentName}</td>
                <td className="px-4 py-3">{r.type === "move_in" ? "입실" : "퇴실"}</td>
                <td className="px-4 py-3">{r.note ?? ""}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-zinc-500" colSpan={4}>
                  기록이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MoveRecordModal(props: {
  open: boolean;
  dormitoryId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: "",
    residentName: "",
    type: "move_in",
    note: "",
  });

  useEffect(() => {
    if (!props.open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({ date: "", residentName: "", type: "move_in", note: "" });
  }, [props.open]);

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="입퇴실 기록 추가"
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose} disabled={saving}>
            취소
          </Button>
          <Button
            onClick={async () => {
              setSaving(true);
              try {
                const { timestampFromDateInput } = await apiResidents();
                const { createMoveRecord } = await apiMoveRecords();
                await createMoveRecord({
                  dormitoryId: props.dormitoryId,
                  residentId: "",
                  residentName: form.residentName,
                  type: form.type as "move_in" | "move_out",
                  date: timestampFromDateInput(form.date),
                  note: form.note,
                });
                toast({ title: "기록 추가 완료", variant: "success" });
                await props.onSaved();
              } catch {
                toast({ title: "기록 추가 실패", variant: "error" });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="날짜">
          <DatePickerInput
            value={form.date}
            onChange={(value) => setForm({ ...form, date: value })}
          />
        </Field>
        <Field label="구분 (move_in/move_out)">
          <Input
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          />
        </Field>
        <Field label="이름" className="md:col-span-2">
          <Input
            value={form.residentName}
            onChange={(e) => setForm({ ...form, residentName: e.target.value })}
          />
        </Field>
        <Field label="비고" className="md:col-span-2">
          <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function MoveRecordEditModal(props: {
  open: boolean;
  record: MoveRecord | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = saving || deleting;
  const [form, setForm] = useState({
    date: "",
    residentName: "",
    type: "move_in" as MoveRecord["type"],
    note: "",
  });

  useEffect(() => {
    if (!props.open || !props.record) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      date: toDateInputValue(props.record.date),
      residentName: props.record.residentName,
      type: props.record.type,
      note: props.record.note ?? "",
    });
  }, [props.open, props.record]);

  return (
    <Modal
      open={props.open}
      onClose={() => {
        if (!busy) props.onClose();
      }}
      title="입퇴실 기록 편집"
      footer={
        <>
          <Button
            variant="danger"
            className="mr-auto"
            disabled={busy}
            onClick={async () => {
              if (!props.record) return;
              if (!window.confirm("이 입퇴실 기록을 삭제할까요?")) return;
              setDeleting(true);
              try {
                const { deleteMoveRecord } = await apiMoveRecords();
                await deleteMoveRecord(props.record.id);
                toast({ title: "삭제 완료", variant: "success" });
                await props.onSaved();
              } catch {
                toast({ title: "삭제 실패", variant: "error" });
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "삭제 중..." : "삭제"}
          </Button>
          <Button variant="secondary" onClick={props.onClose} disabled={busy}>
            취소
          </Button>
          <Button
            onClick={async () => {
              if (!props.record) return;
              setSaving(true);
              try {
                const { timestampFromDateInput } = await apiResidents();
                const { updateMoveRecord } = await apiMoveRecords();
                await updateMoveRecord(props.record.id, {
                  residentName: form.residentName,
                  type: form.type,
                  date: timestampFromDateInput(form.date),
                  note: form.note,
                });
                toast({ title: "수정 완료", variant: "success" });
                await props.onSaved();
              } catch {
                toast({ title: "수정 실패", variant: "error" });
              } finally {
                setSaving(false);
              }
            }}
            disabled={busy}
          >
            {saving ? "저장 중..." : "저장"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="날짜">
          <DatePickerInput
            value={form.date}
            onChange={(value) => setForm({ ...form, date: value })}
          />
        </Field>
        <Field label="구분 (move_in/move_out)">
          <Input
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as MoveRecord["type"] })}
          />
        </Field>
        <Field label="이름" className="md:col-span-2">
          <Input
            value={form.residentName}
            onChange={(e) => setForm({ ...form, residentName: e.target.value })}
          />
        </Field>
        <Field label="비고" className="md:col-span-2">
          <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function MaintenancePanel(props: {
  items: MaintenanceRecord[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Omit<MaintenanceRecord, "id">>) => Promise<void>;
}) {
  const [filter, setFilter] = useState<"" | MaintenanceRecord["status"]>("");

  const filtered = useMemo(
    () => props.items.filter((x) => (filter ? x.status === filter : true)),
    [props.items, filter]
  );

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div>
          <div className="text-sm font-semibold">시설 관리</div>
          <div className="mt-1 text-xs text-zinc-500">상태별로 필터하고 상태를 변경합니다.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "" | MaintenanceRecord["status"])
            }
            placeholder="pending / in_progress / completed"
          />
          <Button onClick={props.onAdd}>요청 추가</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-t border-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">제목</th>
              <th className="px-4 py-3 text-left font-medium">내용</th>
              <th className="px-4 py-3 text-left font-medium">접수일</th>
              <th className="px-4 py-3 text-left font-medium">완료일</th>
              <th className="px-4 py-3 text-left font-medium">수리비용</th>
              <th className="px-4 py-3 text-right font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((x) => (
              <tr key={x.id} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-medium">{x.title}</td>
                <td className="px-4 py-3 text-zinc-700">{x.description}</td>
                <td className="px-4 py-3">{fmtDate(x.reportedAt)}</td>
                <td className="px-4 py-3">{fmtDate(x.resolvedAt)}</td>
                <td className="px-4 py-3">{x.cost === null ? "-" : `${x.cost.toLocaleString()}원`}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => props.onUpdate(x.id, { status: "pending", resolvedAt: null })}
                    >
                      접수
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => props.onUpdate(x.id, { status: "in_progress", resolvedAt: null })}
                    >
                      처리중
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        props.onUpdate(x.id, {
                          status: "completed",
                          resolvedAt: Timestamp.fromDate(new Date()),
                        })
                      }
                    >
                      완료
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-zinc-500" colSpan={6}>
                  항목이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MaintenanceModal(props: {
  open: boolean;
  dormitoryId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
  });

  useEffect(() => {
    if (!props.open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({ title: "", description: "" });
  }, [props.open]);

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="하자/수리 요청 추가"
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose} disabled={saving}>
            취소
          </Button>
          <Button
            onClick={async () => {
              setSaving(true);
              try {
                const { createMaintenanceRecord } = await apiMaintenance();
                await createMaintenanceRecord({
                  dormitoryId: props.dormitoryId,
                  title: form.title,
                  description: form.description,
                  status: "pending",
                  reportedAt: Timestamp.fromDate(new Date()),
                  resolvedAt: null,
                  cost: null,
                });
                toast({ title: "추가 완료", variant: "success" });
                await props.onSaved();
              } catch {
                toast({ title: "추가 실패", variant: "error" });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="제목">
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </Field>
        <Field label="내용">
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}

