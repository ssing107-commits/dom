import { Suspense } from "react";

import UnlockClient from "./UnlockClient";

export default function UnlockPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="h-6 w-40 rounded bg-zinc-100" />
            <div className="mt-6 space-y-3">
              <div className="h-10 rounded-xl bg-zinc-100" />
              <div className="h-10 rounded-xl bg-zinc-100" />
            </div>
          </div>
        </div>
      }
    >
      <UnlockClient />
    </Suspense>
  );
}

