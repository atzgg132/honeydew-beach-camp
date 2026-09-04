import Link from "next/link";
import { BookingCards } from "@/features/admin/bookings/BookingList";
import { InviteStaffForm } from "@/features/admin/settings/InviteStaffForm";
import { getAdminOverview } from "@/server/services/admin-overview";

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

export default async function AdminOverviewPage() {
  const data = await getAdminOverview();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-ink/55">Today · {data.today}</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">Desk</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Arriving" count={data.arriving.length}>
          <BookingCards bookings={data.arriving} />
        </Section>
        <Section title="Leaving" count={data.departing.length}>
          <BookingCards bookings={data.departing} />
        </Section>
        <Section title="In house" count={data.inHouse.length}>
          <BookingCards bookings={data.inHouse} />
        </Section>
        <Section title="Upcoming" count={data.upcoming.length}>
          <BookingCards bookings={data.upcoming} />
        </Section>
      </div>
      <Section title="Attention" count={data.pendingRefunds.length + data.paidUnallocated.length + data.blockedToday.length + data.liveHolds.length}>
        <ul className="space-y-2 text-sm">
          {data.pendingRefunds.map((row) => (
            <li key={row.cancellationId}>
              <Link href={`/admin/bookings/${row.booking.id}`} className="underline-offset-2 hover:underline">
                Refund queued · {row.booking.reference ?? row.booking.contactName}
              </Link>
            </li>
          ))}
          {data.paidUnallocated.map((row) => (
            <li key={row.paymentOrderId}>
              <Link href={`/admin/bookings/${row.booking.id}`} className="underline-offset-2 hover:underline">
                Paid, unallocated · {row.booking.contactName}
              </Link>
            </li>
          ))}
          {data.blockedToday.map((block) => (
            <li key={block.id}>
              Room {block.roomNumber} blocked · {block.reason}
            </li>
          ))}
          {data.liveHolds.map((hold) => (
            <li key={hold.id}>
              <Link href={`/admin/bookings/${hold.id}`} className="underline-offset-2 hover:underline">
                Open hold · {hold.contactName}
              </Link>
            </li>
          ))}
          {data.pendingRefunds.length + data.paidUnallocated.length + data.blockedToday.length + data.liveHolds.length === 0 ? (
            <li className="text-ink/65">Nothing waiting.</li>
          ) : null}
        </ul>
      </Section>
      <Section title="Outstanding balances" count={data.outstandingBalances.length}>
        <BookingCards bookings={data.outstandingBalances} />
      </Section>
      <Section title="Recent bookings" count={data.recent.length}>
        <BookingCards bookings={data.recent} />
      </Section>
      <InviteStaffForm />
    </div>
  );
}
