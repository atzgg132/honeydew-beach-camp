"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminApiError, adminRetryNotification } from "@/features/admin/api";

export function RetryNotificationButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await adminRetryNotification(id);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : "Retrying failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void retry()}
        disabled={pending}
        className="inline-flex min-h-9 items-center rounded-[6px] border border-lagoon-900/30 px-3 text-xs font-medium text-lagoon-900 hover:border-lagoon-900 disabled:opacity-50"
      >
        {pending ? "Queueing…" : "Retry delivery"}
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
