import { NextResponse, type NextRequest } from "next/server";

const COOKIE_UNLOCKED = "dm_unlocked";
const COOKIE_FROM_DASHBOARD = "dm_from_dashboard";

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/unlock") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/manifest")
  );
}

function isProtectedPath(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dormitory/");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  if (!isProtectedPath(pathname)) return NextResponse.next();

  const unlocked = req.cookies.get(COOKIE_UNLOCKED)?.value === "1";
  if (!unlocked) {
    const url = req.nextUrl.clone();
    url.pathname = "/unlock";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 대시보드를 거치지 않고 다른 보호 페이지로 직접 접근하면 차단
  if (pathname !== "/dashboard") {
    const cameFromDashboard = req.cookies.get(COOKIE_FROM_DASHBOARD)?.value === "1";
    if (!cameFromDashboard) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 대시보드에 들어오면 "대시보드 경유" 세션 쿠키를 심어둠
  const res = NextResponse.next();
  res.cookies.set({
    name: COOKIE_FROM_DASHBOARD,
    value: "1",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};

