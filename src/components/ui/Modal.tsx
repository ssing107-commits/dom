"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

export function Modal(props: {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const { open, onClose } = props;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="닫기"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl",
          props.className
        )}
      >
        {(props.title || props.description) && (
          <div className="mb-4">
            {props.title ? <div className="text-lg font-semibold">{props.title}</div> : null}
            {props.description ? (
              <div className="mt-1 text-sm text-zinc-600">{props.description}</div>
            ) : null}
          </div>
        )}
        {props.children}
        {props.footer ? <div className="mt-5 flex justify-end gap-2">{props.footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

