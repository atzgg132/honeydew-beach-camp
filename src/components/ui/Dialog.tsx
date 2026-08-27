"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Keep stay",
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = dialog.querySelector<HTMLElement>("button, [href], input, textarea, select");
    focusable?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const root = event.currentTarget as HTMLDialogElement;
      const items = [...root.querySelectorAll<HTMLElement>("button, [href], input, textarea, select")].filter(
        (item) => !item.hasAttribute("disabled"),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener("keydown", onKey);
    return () => {
      dialog.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="fixed inset-0 z-[60] m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[6px] border border-line bg-cream p-6 text-ink shadow-[0_16px_48px_rgb(14_74_77/0.18)] backdrop:bg-lagoon-900/80"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <h2 id={titleId} className="text-xl tracking-tight">
        {title}
      </h2>
      <div className="mt-3 text-sm leading-6 text-ink/80">{children}</div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
