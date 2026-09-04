import type { Metadata } from "next";
import Link from "next/link";
import { BookingCards } from "@/features/admin/bookings/BookingList";
import { getAdminOverview } from "@/server/services/admin-overview";
import { formatDisplayDate, formatIstDateTime } from "@/lib/dates";
import { formatInrPaise } from "@/lib/format";

export const metadata: Metadata = { title: "Today" };

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[6px] border border-line bg-cream-raised p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-xs text-ink/55">{count}</p>
      </div>
      {children}
    </section>
  );
}

function AttentionGroup({
  title,
  empty,
  children,
  count,
}: {
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      {count === 0 ? <p className="mt-2 text-sm text-ink/65">{empty}</p> : <ul className="mt-2 space-y-2 text-sm">{children}</ul>}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const data = await getAdminOverview();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Today</h1>
        <p className="mt-1 text-sm text-ink/65">{formatDisplayDate(data.today)}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Arriving" count={data.arriving.length}>
          <BookingCards bookings={data.arriving} emptyLabel="No arrivals today." />
        </Section>
        <Section title="Leaving" count={data.departing.length}>
          <BookingCards bookings={data.departing} emptyLabel="No departures today." />
        </Section>
        <Section title="In house" count={data.inHouse.length}>
          <BookingCards bookings={data.inHouse} emptyLabel="No one already in house." />
        </Section>
        <Section title="Outstanding balances" count={data.outstandingBalances.length}>
          <BookingCards bookings={data.outstandingBalances} emptyLabel="No balances due." />
        </Section>
      </div>
      <Section
        title="Attention"
        count={data.pendingRefunds.length + data.paidUnallocated.length + data.blockedToday.length + data.liveHolds.length}
      >
        <div className="grid gap-5">
          <AttentionGroup title="Refunds to review" empty="No refunds waiting." count={data.pendingRefunds.length}>
            {data.pendingRefunds.map((row) => (
              <li key={row.cancellationId}>
                <Link href={`/admin/bookings/${row.booking.id}`} className="underline-offset-2 hover:underline">
                  {row.booking.reference ?? row.booking.contactName}
                </Link>
                <span className="text-ink/65"> · {formatInrPaise(row.refundablePaise)}</span>
              </li>
            ))}
          </AttentionGroup>
          <AttentionGroup title="Paid, unallocated" empty="No late payments waiting." count={data.paidUnallocated.length}>
            {data.paidUnallocated.map((row) => (
              <li key={row.paymentOrderId}>
                <Link href={`/admin/bookings/${row.booking.id}`} className="underline-offset-2 hover:underline">
                  {row.booking.contactName}
                </Link>
                <span className="text-ink/65"> · {formatInrPaise(row.amountPaise)}</span>
              </li>
            ))}
          </AttentionGroup>
          <AttentionGroup title="Open holds" empty="No live holds." count={data.liveHolds.length}>
            {data.liveHolds.map((hold) => (
              <li key={hold.id}>
                <Link href={`/admin/bookings/${hold.id}`} className="underline-offset-2 hover:underline">
                  {hold.contactName}
                </Link>
                {hold.holdExpiresAt ? (
                  <span className="text-ink/65"> · expires {formatIstDateTime(hold.holdExpiresAt)}</span>
                ) : null}
              </li>
            ))}
          </AttentionGroup>
          <AttentionGroup title="Rooms blocked today" empty="No blocks covering today." count={data.blockedToday.length}>
            {data.blockedToday.map((block) => (
              <li key={block.id}>
                <Link href="/admin/rooms" className="underline-offset-2 hover:underline">
                  Room {block.roomNumber}
                </Link>
                <span className="text-ink/65"> · {block.reason}</span>
              </li>
            ))}
          </AttentionGroup>
        </div>
      </Section>
    </div>
  );
}
