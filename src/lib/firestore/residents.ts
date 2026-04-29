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
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Resident } from "@/lib/types";
import { withWriteKey } from "@/lib/firestore/writeKey";

const residentsCol = collection(db, "residents");
const moveRecordsCol = collection(db, "moveRecords");

export async function listResidentsByDormitory(dormitoryId: string): Promise<Resident[]> {
  // 인덱스 없이도 동작하도록 서버 orderBy를 제거하고 클라이언트에서 정렬합니다.
  const q = query(residentsCol, where("dormitoryId", "==", dormitoryId));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Resident, "id">) }));
  return list.sort((a, b) => a.moveInDate.toMillis() - b.moveInDate.toMillis());
}

export async function createResident(input: Omit<Resident, "id" | "createdAt">) {
  const res = await addDoc(
    residentsCol,
    withWriteKey({ ...input, createdAt: serverTimestamp() })
  );
  return res.id;
}

export async function updateResident(
  id: string,
  patch: Partial<Omit<Resident, "id" | "createdAt">>
) {
  const ref = doc(db, "residents", id);
  await updateDoc(ref, withWriteKey(patch as Record<string, unknown>));
}

export async function markResidentMovedOut(params: {
  residentId: string;
  dormitoryId: string;
  residentName: string;
  moveOutDate: Timestamp;
  note?: string;
}) {
  const batch = writeBatch(db);

  batch.update(doc(db, "residents", params.residentId), withWriteKey({
    status: "moved_out",
    moveOutDate: params.moveOutDate,
  }));

  const moveRef = doc(moveRecordsCol);
  batch.set(moveRef, withWriteKey({
    dormitoryId: params.dormitoryId,
    residentId: params.residentId,
    residentName: params.residentName,
    type: "move_out",
    date: params.moveOutDate,
    note: params.note ?? "",
    createdAt: serverTimestamp(),
  }));

  await batch.commit();
}

export async function recordMoveIn(params: {
  dormitoryId: string;
  residentId: string;
  residentName: string;
  date: Timestamp;
  note?: string;
}) {
  await addDoc(moveRecordsCol, withWriteKey({
    dormitoryId: params.dormitoryId,
    residentId: params.residentId,
    residentName: params.residentName,
    type: "move_in",
    date: params.date,
    note: params.note ?? "",
    createdAt: serverTimestamp(),
  }));
}

export function timestampFromDateInput(value: string): Timestamp {
  // yyyy-mm-dd
  const [y, m, d] = value.split("-").map((v) => Number(v));
  return Timestamp.fromDate(new Date(y, m - 1, d));
}

