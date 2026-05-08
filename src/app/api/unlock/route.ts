import { NextResponse } from "next/server";
import crypto from "crypto";

const COOKIE_UNLOCKED = "dm_unlocked";

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export async function POST(req: Request) {
  const expected = process.env.DASHBOARD_PASSWORD ?? "";
  if (!expected) {
    return NextResponse.json(
      { ok: false, message: "서버에 DASHBOARD_PASSWORD가 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const password = typeof (body as any)?.password === "string" ? String((body as any).password) : "";
  if (!password || !safeEqual(password, expected)) {
    return NextResponse.json({ ok: false, message: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_UNLOCKED,
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  });
  return res;
}

