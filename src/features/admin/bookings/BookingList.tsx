import Link from "next/link";
import { formatDisplayDate } from "@/lib/dates";
import { formatInrPaise } from "@/lib/format";
import type { StaffBookingListItem } from "@/features/admin/types";
import { BookingStatusBadge, PaymentStatusBadge, SourceBadge } from "@/features/admin/ui/AdminStatusBadge";

export function BookingCards({ bookings }: { bookings: StaffBookingListItem[] }) {
  if (bookings.length === 0) {
    return <p className="text-sm text-ink/65">Nothing here.</p>;
  }
  return (
    <>
      <ul className="grid gap-3 lg:hidden">
        {bookings.map((booking) => (
          <li key={booking.id}>
            <Link href={`/admin/bookings/${booking.id}`} className="block rounded-[6px] border border-line bg-cream-raised p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{booking.reference ?? "No reference"}</p>
                <BookingStatusBadge status={booking.status} />
                <PaymentStatusBadge status={booking.paymentView} />
              </div>
              <p className="mt-2 text-sm">{booking.contactName}</p>
              <p className="text-sm text-ink/65">
                {formatDisplayDate(booking.checkIn)} – {formatDisplayDate(booking.checkOut)}
              </p>
              <p className="mt-1 text-sm text-ink/65">
                {booking.assignedRooms.length > 0 ? booking.assignedRooms.join(", ") : "Unassigned"} · {formatInrPaise(booking.outstandingPaise)} due
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/60">
              <th className="py-2 pr-3 font-medium">Reference</th>
              <th className="py-2 pr-3 font-medium">Guest</th>
              <th className="py-2 pr-3 font-medium">Dates</th>
              <th className="py-2 pr-3 font-medium">Rooms</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Due</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id} className="border-b border-line/70">
                <td className="py-3 pr-3">
                  <Link href={`/admin/bookings/${booking.id}`} className="font-medium underline-offset-2 hover:underline">
                    {booking.reference ?? "No reference"}
                  </Link>
                  <div className="mt-1">
                    <SourceBadge source={booking.source} />
                  </div>
                </td>
                <td className="py-3 pr-3">
                  <p>{booking.contactName}</p>
                  <p className="text-ink/60">{booking.contactPhone}</p>
                </td>
                <td className="py-3 pr-3">
                  {formatDisplayDate(booking.checkIn)}
                  <span className="text-ink/45"> → </span>
                  {formatDisplayDate(booking.checkOut)}
                </td>
                <td className="py-3 pr-3">{booking.assignedRooms.join(", ") || "Unassigned"}</td>
                <td className="py-3 pr-3">
                  <div className="flex flex-wrap gap-1">
                    <BookingStatusBadge status={booking.status} />
                    <PaymentStatusBadge status={booking.paymentView} />
                  </div>
                </td>
                <td className="py-3 pr-3 tabular-nums">{formatInrPaise(booking.outstandingPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
