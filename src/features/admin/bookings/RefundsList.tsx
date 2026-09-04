"use client";

import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { RefundActions } from "@/features/admin/bookings/RefundActions";
import { useAdminAction } from "@/features/admin/ui/useAdminAction";
import { formatInrPaise } from "@/lib/format";

export function RefundsList({
  rows,
}: {
  rows: Array<{
    cancellationId: string;
    refundStatus: string;
    refundablePaise: number;
    slabLabel: string;
    booking: { id: string; reference: string | null; contactName: string };
  }>;
}) {
  const { error, message, pending, wrap } = useAdminAction();
  if (rows.length === 0) {
    return <p className="text-sm text-ink/65">No refunds waiting.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
      <ul className="grid gap-3">
        {rows.map((row) => (
          <li key={row.cancellationId} className="rounded-[6px] border border-line bg-cream-raised p-4">
            <Link href={`/admin/bookings/${row.booking.id}`} className="font-medium underline-offset-2 hover:underline">
              {row.booking.reference ?? row.booking.contactName}
            </Link>
            <p className="mt-1 text-sm text-ink/70">
              {row.slabLabel} · {row.refundStatus.replaceAll("_", " ").toLowerCase()} · refundable {formatInrPaise(row.refundablePaise)}
            </p>
            <div className="mt-3">
              <RefundActions
                cancellationId={row.cancellationId}
                refundStatus={row.refundStatus}
                refundablePaise={row.refundablePaise}
                slabLabel={row.slabLabel}
                pending={pending}
                onRun={(action, success) => void wrap(action, success)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
