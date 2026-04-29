import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { MoveRecord, MoveRecordType } from "@/lib/types";
import { withWriteKey } from "@/lib/firestore/writeKey";

const colRef = collection(db, "moveRecords");

export async function listMoveRecords(dormitoryId: string): Promise<MoveRecord[]> {
  // 인덱스 없이도 동작하도록 서버 orderBy를 제거하고 클라이언트에서 정렬합니다.
  const q = query(colRef, where("dormitoryId", "==", dormitoryId));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MoveRecord, "id">) }));
  return list.sort((a, b) => b.date.toMillis() - a.date.toMillis());
}

export async function createMoveRecord(input: {
  dormitoryId: string;
  residentId: string;
  residentName: string;
  type: MoveRecordType;
  date: Timestamp;
  note: string;
}) {
  const res = await addDoc(colRef, withWriteKey({ ...input, createdAt: serverTimestamp() }));
  return res.id;
}

export async function updateMoveRecord(
  id: string,
  patch: Partial<Pick<MoveRecord, "residentName" | "type" | "date" | "note">>
) {
  const ref = doc(db, "moveRecords", id);
  await updateDoc(ref, withWriteKey(patch as Record<string, unknown>));
}

export async function deleteMoveRecord(id: string) {
  const ref = doc(db, "moveRecords", id);
  // 예전 문서(writeKey 누락)도 삭제 가능하도록 먼저 writeKey를 보정합니다.
  await updateDoc(ref, withWriteKey({}));
  await deleteDoc(ref);
}

