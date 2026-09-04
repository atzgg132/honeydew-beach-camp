import Link from "next/link";
import { formatInrPaise } from "@/lib/format";
import { listPendingRefunds } from "@/server/services/admin-refunds";

export default async function AdminRefundsPage() {
  const rows = await listPendingRefunds();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-medium tracking-tight">Refunds</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-ink/65">No refunds waiting.</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li key={row.cancellationId} className="rounded-[6px] border border-line bg-cream-raised p-4">
              <Link href={`/admin/bookings/${row.booking.id}`} className="font-medium underline-offset-2 hover:underline">
                {row.booking.reference ?? row.booking.contactName}
              </Link>
              <p className="mt-1 text-sm text-ink/70">
                {row.slabLabel} · {row.refundStatus.replaceAll("_", " ").toLowerCase()} · refundable {formatInrPaise(row.refundablePaise)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
