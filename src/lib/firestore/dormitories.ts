import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Dormitory } from "@/lib/types";
import { withWriteKey } from "@/lib/firestore/writeKey";

const colRef = collection(db, "dormitories");

async function deleteDocumentsWhereDormitoryId(
  collectionName: "residents" | "moveRecords" | "maintenanceRecords",
  dormitoryId: string
) {
  const col = collection(db, collectionName);
  const q = query(col, where("dormitoryId", "==", dormitoryId));
  const snap = await getDocs(q);
  for (const row of snap.docs) {
    const ref = doc(db, collectionName, row.id);
    // 예전 문서(writeKey 누락)도 삭제 가능하도록 먼저 writeKey를 보정합니다.
    await updateDoc(ref, withWriteKey({}));
    await deleteDoc(ref);
  }
}

export async function listDormitories(): Promise<Dormitory[]> {
  const q = query(colRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Dormitory, "id">) }));
}

export async function getDormitory(id: string): Promise<Dormitory | null> {
  const ref = doc(db, "dormitories", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Dormitory, "id">) };
}

export async function createDormitory(
  input: Omit<Dormitory, "id" | "createdAt">
): Promise<string> {
  const res = await addDoc(colRef, withWriteKey({ ...input, createdAt: serverTimestamp() }));
  return res.id;
}

export async function updateDormitory(
  id: string,
  patch: Partial<Omit<Dormitory, "id" | "createdAt">>
) {
  const ref = doc(db, "dormitories", id);
  await updateDoc(ref, withWriteKey(patch as Record<string, unknown>));
}

/** 하위 residents / moveRecords / maintenanceRecords 를 모두 삭제한 뒤 기숙사 문서를 삭제합니다. */
export async function deleteDormitoryCascade(dormitoryId: string) {
  await deleteDocumentsWhereDormitoryId("residents", dormitoryId);
  await deleteDocumentsWhereDormitoryId("moveRecords", dormitoryId);
  await deleteDocumentsWhereDormitoryId("maintenanceRecords", dormitoryId);
  const dormRef = doc(db, "dormitories", dormitoryId);
  await updateDoc(dormRef, withWriteKey({}));
  await deleteDoc(dormRef);
}

