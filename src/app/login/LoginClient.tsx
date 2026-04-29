"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastProvider";

export default function LoginClient() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="text-xl font-semibold">로그인</div>
        <div className="mt-1 text-sm text-zinc-600">
          Google 계정 또는 이메일/비밀번호로 로그인합니다.
        </div>

        <div className="mt-6 space-y-3">
          <Button
            type="button"
            className="w-full"
            variant="secondary"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const [{ GoogleAuthProvider, signInWithPopup }, { auth }] = await Promise.all([
                  import("firebase/auth"),
                  import("@/lib/firebase"),
                ]);
                const provider = new GoogleAuthProvider();
                await signInWithPopup(auth, provider);
                toast({ title: "로그인 완료", variant: "success" });
                router.replace(next);
              } catch (err) {
                toast({
                  title: "Google 로그인 실패",
                  description: err instanceof Error ? err.message : "다시 시도해주세요.",
                  variant: "error",
                });
              } finally {
                setLoading(false);
              }
            }}
          >
            Google로 로그인
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="h-px w-full bg-zinc-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-xs text-zinc-500">또는</span>
            </div>
          </div>
        </div>

        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              const [{ signInWithEmailAndPassword }, { auth }] = await Promise.all([
                import("firebase/auth"),
                import("@/lib/firebase"),
              ]);
              await signInWithEmailAndPassword(auth, email.trim(), password);
              toast({ title: "로그인 완료", variant: "success" });
              router.replace(next);
            } catch (err) {
              toast({
                title: "로그인 실패",
                description:
                  err instanceof Error ? err.message : "이메일/비밀번호를 확인해주세요.",
                variant: "error",
              });
            } finally {
              setLoading(false);
            }
          }}
        >
          <div>
            <div className="mb-1 text-sm font-medium">이메일</div>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              required
            />
          </div>
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
            {loading ? "로그인 중..." : "로그인"}
          </Button>

          <div className="text-xs text-zinc-500">
            Google 로그인 사용 전, Firebase 콘솔에서 Authentication → Google 제공자를 활성화하세요.
          </div>
        </form>
      </div>
    </div>
  );
}

