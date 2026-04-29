import { AppShell } from "@/components/layout/AppShell";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // cloth 방식: 로그인 없이 사용(읽기 공개), 쓰기는 writeKey로 제어
  return <AppShell>{children}</AppShell>;
}

