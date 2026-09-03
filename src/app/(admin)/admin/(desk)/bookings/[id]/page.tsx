import { notFound } from "next/navigation";
import { BookingActions } from "@/features/admin/bookings/BookingActions";
import { BookingStatusBadge, PaymentStatusBadge, SourceBadge } from "@/features/admin/ui/AdminStatusBadge";
import { Money } from "@/features/admin/ui/Money";
import { formatDisplayDate } from "@/lib/dates";
import { requireUuidParam } from "@/server/http";
import { getStaffBooking } from "@/server/services/admin-booking-query";
import { ApiError } from "@/contracts/errors";

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let booking;
  try {
    booking = await getStaffBooking(requireUuidParam((await params).id, "id"));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-ink/55">{booking.reference ?? "Unreferenced"}</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">{booking.contact.fullName}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <BookingStatusBadge status={booking.status} />
          <PaymentStatusBadge status={booking.paymentView} />
          <SourceBadge source={booking.source} />
        </div>
      </div>
      <dl className="grid gap-3 rounded-[6px] border border-line bg-cream-raised p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink/55">Stay</dt>
          <dd>
            {formatDisplayDate(booking.checkIn)} – {formatDisplayDate(booking.checkOut)} · {booking.nights} nights
          </dd>
        </div>
        <div>
          <dt className="text-ink/55">Contact</dt>
          <dd>
            {booking.contact.phone}
            <br />
            {booking.contact.email}
          </dd>
        </div>
        <div>
          <dt className="text-ink/55">Guests</dt>
          <dd>
            {booking.composition.adults} adults
            {booking.composition.childrenUnder5 ? `, ${booking.composition.childrenUnder5} under 5` : ""}
            {booking.composition.children5to10 ? `, ${booking.composition.children5to10} aged 5–10` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-ink/55">Money</dt>
          <dd>
            Total <Money paise={booking.subtotalPaise} /> · Advance {booking.advanceBasisPoints / 100}% · Paid{" "}
            <Money paise={booking.advancePaidPaise} /> · Due <Money paise={booking.outstandingPaise} />
          </dd>
        </div>
      </dl>
      <section className="rounded-[6px] border border-line bg-cream-raised p-4">
        <h2 className="text-sm font-medium">Rooms</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {booking.rooms.map((room) => (
            <li key={room.id}>
              {room.assignedPhysicalRoomNumber ?? "Unassigned"} · {room.roomGroupName} · {room.acMode === "ac" ? "AC" : "Non-AC"} ·{" "}
              <Money paise={room.stayTotalPaise} />
            </li>
          ))}
        </ul>
      </section>
      {booking.cancellation ? (
        <section className="rounded-[6px] border border-line bg-cream-raised p-4 text-sm">
          <h2 className="text-sm font-medium">Cancellation</h2>
          <p className="mt-2">
            {booking.cancellation.slabLabel}. Deduction <Money paise={booking.cancellation.deductionPaise} />. Refundable{" "}
            <Money paise={booking.cancellation.refundablePaise} />. Status {booking.cancellation.refundStatus}.
          </p>
        </section>
      ) : null}
      <section className="rounded-[6px] border border-line bg-cream-raised p-4">
        <h2 className="text-sm font-medium">Activity</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {booking.events.map((event) => (
            <li key={event.id}>
              <span className="text-ink/55">{event.createdAt.slice(0, 16).replace("T", " ")}</span> · {event.type} · {event.actorType}
            </li>
          ))}
        </ol>
      </section>
      <BookingActions booking={booking} />
    </div>
  );
}
