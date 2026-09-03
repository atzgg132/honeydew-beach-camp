"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { adminLogin, AdminApiError } from "@/features/admin/api";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await adminLogin(email, password);
      router.replace(next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : "Sign in failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field id="email" label="Email">
        <TextInput id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </Field>
      <Field id="password" label="Password">
        <TextInput
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
