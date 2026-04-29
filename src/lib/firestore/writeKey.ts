const WRITE_KEY = process.env.NEXT_PUBLIC_FIREBASE_WRITE_KEY;

export function getWriteKeyOrThrow() {
  if (!WRITE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_WRITE_KEY 환경변수가 없습니다. (.env.local 확인)"
    );
  }
  return WRITE_KEY;
}

export function withWriteKey<T extends Record<string, unknown>>(data: T): T & { writeKey: string } {
  return { ...data, writeKey: getWriteKeyOrThrow() };
}

