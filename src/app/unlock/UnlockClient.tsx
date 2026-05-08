"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";

export default function UnlockClient() {
  const router = useRouter();
  const search = useSearchParams();
  const next = useMemo(() => search.get("next") || "/dashboard", [search]);
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="text-xl font-semibold">대시보드 잠금해제</div>
        <div className="mt-1 text-sm text-zinc-600">비밀번호를 입력하면 대시보드로 이동합니다.</div>

        <form
          className="mt-6 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              const res = await fetch("/api/unlock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
              });

              const data = (await res.json().catch(() => null)) as null | { ok?: boolean; message?: string };
              if (!res.ok) {
                toast({
                  title: "잠금해제 실패",
                  description: data?.message || "비밀번호를 확인해주세요.",
                  variant: "error",
                });
                return;
              }

              toast({ title: "잠금해제 완료", variant: "success" });
              router.replace(next);
            } catch (err) {
              toast({
                title: "잠금해제 실패",
                description: err instanceof Error ? err.message : "다시 시도해주세요.",
                variant: "error",
              });
            } finally {
              setLoading(false);
            }
          }}
        >
          <div>
            <div className="mb-1 text-sm font-medium">비밀번호</div>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "확인 중..." : "확인"}
          </Button>

          <Button
            type="button"
            className="w-full"
            variant="secondary"
            disabled={loading}
            onClick={() => router.replace("/")}
          >
            홈으로
          </Button>
        </form>
      </div>
    </div>
  );
}

