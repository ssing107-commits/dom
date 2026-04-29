import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { MaintenanceRecord, MaintenanceStatus } from "@/lib/types";
import { withWriteKey } from "@/lib/firestore/writeKey";

const colRef = collection(db, "maintenanceRecords");

export async function listMaintenanceRecords(dormitoryId: string): Promise<MaintenanceRecord[]> {
  // 인덱스 없이도 동작하도록 서버 orderBy를 제거하고 클라이언트에서 정렬합니다.
  const q = query(colRef, where("dormitoryId", "==", dormitoryId));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<MaintenanceRecord, "id">),
  }));
  return list.sort((a, b) => b.reportedAt.toMillis() - a.reportedAt.toMillis());
}

export async function createMaintenanceRecord(input: {
  dormitoryId: string;
  title: string;
  description: string;
  status: MaintenanceStatus;
  reportedAt: Timestamp;
  resolvedAt: Timestamp | null;
  cost: number | null;
}) {
  const res = await addDoc(colRef, withWriteKey({ ...input, createdAt: serverTimestamp() }));
  return res.id;
}

export async function updateMaintenanceRecord(
  id: string,
  patch: Partial<Omit<MaintenanceRecord, "id">>
) {
  const ref = doc(db, "maintenanceRecords", id);
  await updateDoc(ref, withWriteKey(patch as Record<string, unknown>));
}

