"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminApiError } from "@/features/admin/api";

export function useAdminAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function wrap(action: () => Promise<unknown>, success: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : "That action failed.");
    } finally {
      setPending(false);
    }
  }

  return { error, message, pending, wrap, setError, setMessage };
}
