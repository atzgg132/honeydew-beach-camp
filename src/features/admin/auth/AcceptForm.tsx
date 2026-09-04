"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { adminAccept, AdminApiError } from "@/features/admin/api";

export function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await adminAccept(token, password);
      router.replace("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : "The invitation could not be used.");
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return <Notice tone="error">This invitation link is missing its token.</Notice>;
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field id="password" label="Choose a password" hint="At least 12 characters.">
        <TextInput
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Set password and continue"}
      </Button>
    </form>
  );
}
