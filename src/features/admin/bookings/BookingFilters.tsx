"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function BookingFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const [key, value] of form.entries()) {
      if (typeof value === "string" && value.trim()) next.set(key, value.trim());
    }
    const query = next.toString();
    router.push(query ? `/admin/bookings?${query}` : "/admin/bookings");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-[6px] border border-line bg-cream-raised p-4 md:grid-cols-3 xl:grid-cols-4">
      <label className="text-xs">
        Reference
        <input name="reference" defaultValue={params.get("reference") ?? ""} className="mt-1 h-11 w-full rounded-[6px] border border-line bg-cream px-3 text-sm" />
      </label>
      <label className="text-xs">
        Name
        <input name="name" defaultValue={params.get("name") ?? ""} className="mt-1 h-11 w-full rounded-[6px] border border-line bg-cream px-3 text-sm" />
      </label>
      <label className="text-xs">
        Phone
        <input name="phone" defaultValue={params.get("phone") ?? ""} className="mt-1 h-11 w-full rounded-[6px] border border-line bg-cream px-3 text-sm" />
      </label>
      <label className="text-xs">
        Email
        <input name="email" defaultValue={params.get("email") ?? ""} className="mt-1 h-11 w-full rounded-[6px] border border-line bg-cream px-3 text-sm" />
      </label>
      <label className="text-xs">
        From
        <input type="date" name="from" defaultValue={params.get("from") ?? ""} className="mt-1 h-11 w-full rounded-[6px] border border-line bg-cream px-3 text-sm" />
      </label>
      <label className="text-xs">
        To
        <input type="date" name="to" defaultValue={params.get("to") ?? ""} className="mt-1 h-11 w-full rounded-[6px] border border-line bg-cream px-3 text-sm" />
      </label>
      <label className="text-xs">
        Status
        <select name="status" defaultValue={params.get("status") ?? ""} className="mt-1 h-11 w-full rounded-[6px] border border-line bg-cream px-3 text-sm">
          <option value="">Any</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PENDING_PAYMENT">Hold</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </label>
      <label className="text-xs">
        Payment
        <select name="paymentView" defaultValue={params.get("paymentView") ?? ""} className="mt-1 h-11 w-full rounded-[6px] border border-line bg-cream px-3 text-sm">
          <option value="">Any</option>
          <option value="balance_due">Balance due</option>
          <option value="settled">Settled</option>
          <option value="refund_pending">Refund queued</option>
          <option value="paid_unallocated">Paid, unallocated</option>
        </select>
      </label>
      <label className="text-xs">
        Source
        <select name="source" defaultValue={params.get("source") ?? ""} className="mt-1 h-11 w-full rounded-[6px] border border-line bg-cream px-3 text-sm">
          <option value="">Any</option>
          <option value="ONLINE">Online</option>
          <option value="PHONE">Phone</option>
          <option value="WALK_IN">Walk-in</option>
        </select>
      </label>
      <label className="text-xs">
        Room group
        <select name="roomGroupId" defaultValue={params.get("roomGroupId") ?? ""} className="mt-1 h-11 w-full rounded-[6px] border border-line bg-cream px-3 text-sm">
          <option value="">Any</option>
          <option value="single-bed">Single-bed</option>
          <option value="double-bed">Double-bed</option>
        </select>
      </label>
      <label className="text-xs">
        Room number
        <input name="roomNumber" defaultValue={params.get("roomNumber") ?? ""} className="mt-1 h-11 w-full rounded-[6px] border border-line bg-cream px-3 text-sm" />
      </label>
      <div className="flex items-end">
        <Button type="submit">Filter</Button>
      </div>
    </form>
  );
}
