"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { last10Digits } from "@/lib/format";

const extraKeys = ["email", "from", "to", "status", "paymentView", "source", "roomGroupId", "roomNumber"] as const;

export function BookingFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const extrasOpen = extraKeys.some((key) => Boolean(params.get(key)));
  const [moreOpen, setMoreOpen] = useState(extrasOpen);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") ?? "").trim();
    const from = String(form.get("from") ?? "").trim();
    const to = String(form.get("to") ?? "").trim();
    if (phone && last10Digits(phone).length !== 10) {
      setError("Phone needs the last 10 digits.");
      return;
    }
    if ((from && !to) || (!from && to)) {
      setError("Set both dates or neither.");
      return;
    }
    setError(null);
    const next = new URLSearchParams();
    for (const [key, value] of form.entries()) {
      if (typeof value === "string" && value.trim()) next.set(key, value.trim());
    }
    const query = next.toString();
    router.push(query ? `/admin/bookings?${query}` : "/admin/bookings");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-[6px] border border-line bg-cream-raised p-4 md:grid-cols-4">
      {error ? (
        <div className="md:col-span-4">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      <Field id="reference" label="Reference">
        <TextInput id="reference" name="reference" defaultValue={params.get("reference") ?? ""} />
      </Field>
      <Field id="name" label="Name">
        <TextInput id="name" name="name" defaultValue={params.get("name") ?? ""} />
      </Field>
      <Field id="phone" label="Phone" hint="Last 10 digits.">
        <TextInput id="phone" name="phone" inputMode="numeric" autoComplete="tel" defaultValue={params.get("phone") ?? ""} />
      </Field>
      <div className="flex flex-wrap items-end gap-2">
        <Button type="submit">Filter</Button>
        <Button href="/admin/bookings" variant="secondary">
          Clear
        </Button>
      </div>
      <details
        className="md:col-span-4"
        open={moreOpen}
        onToggle={(event) => setMoreOpen(event.currentTarget.open)}
      >
        <summary className="min-h-11 cursor-pointer text-sm font-medium">More filters</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <Field id="email" label="Email">
            <TextInput id="email" name="email" type="email" defaultValue={params.get("email") ?? ""} />
          </Field>
          <Field id="from" label="From">
            <TextInput id="from" name="from" type="date" defaultValue={params.get("from") ?? ""} />
          </Field>
          <Field id="to" label="To">
            <TextInput id="to" name="to" type="date" defaultValue={params.get("to") ?? ""} />
          </Field>
          <Field id="status" label="Status">
            <Select id="status" name="status" defaultValue={params.get("status") ?? ""}>
              <option value="">Any</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PENDING_PAYMENT">Hold</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="EXPIRED">Expired</option>
              <option value="COMPLETED">Completed</option>
            </Select>
          </Field>
          <Field id="paymentView" label="Payment">
            <Select id="paymentView" name="paymentView" defaultValue={params.get("paymentView") ?? ""}>
              <option value="">Any</option>
              <option value="balance_due">Balance due</option>
              <option value="settled">Settled</option>
              <option value="refund_pending">Refund queued</option>
              <option value="paid_unallocated">Paid, unallocated</option>
            </Select>
          </Field>
          <Field id="source" label="Source">
            <Select id="source" name="source" defaultValue={params.get("source") ?? ""}>
              <option value="">Any</option>
              <option value="ONLINE">Online</option>
              <option value="PHONE">Phone</option>
              <option value="WALK_IN">Walk-in</option>
            </Select>
          </Field>
          <Field id="roomGroupId" label="Room group">
            <Select id="roomGroupId" name="roomGroupId" defaultValue={params.get("roomGroupId") ?? ""}>
              <option value="">Any</option>
              <option value="single-bed">Single-bed</option>
              <option value="double-bed">Double-bed</option>
            </Select>
          </Field>
          <Field id="roomNumber" label="Room number">
            <TextInput id="roomNumber" name="roomNumber" defaultValue={params.get("roomNumber") ?? ""} />
          </Field>
        </div>
      </details>
    </form>
  );
}
