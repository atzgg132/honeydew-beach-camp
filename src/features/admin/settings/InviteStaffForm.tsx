"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { adminInvite, AdminApiError } from "@/features/admin/api";

export function InviteStaffForm() {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setUrl(null);
    try {
      const result = await adminInvite(email);
      setUrl(result.acceptUrl);
      setEmail("");
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : "Invite failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[6px] border border-line bg-cream-raised p-4">
      <h2 className="text-sm font-medium">Invite another staff member</h2>
      <p className="mt-1 text-sm text-ink/65">Email is not sent yet. Copy the link and pass it by hand.</p>
      <form onSubmit={(event) => void onSubmit(event)} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field id="invite-email" label="Email">
          <TextInput id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create invite"}
        </Button>
      </form>
      {error ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}
      {url ? (
        <div className="mt-3">
          <Notice tone="success">{url}</Notice>
        </div>
      ) : null}
    </section>
  );
}
