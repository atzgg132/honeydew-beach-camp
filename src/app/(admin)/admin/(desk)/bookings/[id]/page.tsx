import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingActions } from "@/features/admin/bookings/BookingActions";
import { BookingStatusBadge, PaymentStatusBadge, SourceBadge } from "@/features/admin/ui/AdminStatusBadge";
import { actorLabel, eventLabel } from "@/features/admin/ui/activity";
import { Money } from "@/features/admin/ui/Money";
import { formatDisplayDate, formatIstDateTime } from "@/lib/dates";
import { requireUuidParam } from "@/server/http";
import { getStaffBooking } from "@/server/services/admin-booking-query";
import { ApiError } from "@/contracts/errors";

export const metadata: Metadata = { title: "Stay" };

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
      <p>
        <Link href="/admin/bookings" className="text-sm underline-offset-2 hover:underline">
          Back to bookings
        </Link>
      </p>
      <div>
        <p className="text-sm text-ink/55">{booking.reference ?? "Unreferenced"}</p>
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
            {formatDisplayDate(booking.checkIn)} to {formatDisplayDate(booking.checkOut)} · {booking.nights} nights
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
            {booking.composition.children5to10 ? `, ${booking.composition.children5to10} aged 5 to 10` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-ink/55">Money</dt>
          <dd>
            Total <Money paise={booking.subtotalPaise} /> · Advance {booking.advanceBasisPoints / 100}% · Paid{" "}
            <Money paise={booking.advancePaidPaise} /> · Due <Money paise={booking.outstandingPaise} />
          </dd>
        </div>
        {booking.holdExpiresAt ? (
          <div>
            <dt className="text-ink/55">Hold expires</dt>
            <dd>{formatIstDateTime(booking.holdExpiresAt)}</dd>
          </div>
        ) : null}
      </dl>
      {booking.cancellation ? (
        <section className="rounded-[6px] border border-line bg-cream-raised p-4 text-sm">
          <h2 className="text-sm font-medium">Cancellation</h2>
          <p className="mt-2">
            {booking.cancellation.slabLabel}. Deduction <Money paise={booking.cancellation.deductionPaise} />. Refundable{" "}
            <Money paise={booking.cancellation.refundablePaise} />. Status {booking.cancellation.refundStatus.replaceAll("_", " ").toLowerCase()}.
          </p>
        </section>
      ) : null}
      {booking.payments.length > 0 ? (
        <section className="rounded-[6px] border border-line bg-cream-raised p-4">
          <h2 className="text-sm font-medium">Payments</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {booking.payments.map((payment) => (
              <li key={payment.id}>
                {formatIstDateTime(payment.createdAt)} · {payment.provider} · {payment.status.replaceAll("_", " ").toLowerCase()} ·{" "}
                <Money paise={payment.amountPaise} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <BookingActions booking={booking} />
      <section className="rounded-[6px] border border-line bg-cream-raised p-4">
        <h2 className="text-sm font-medium">Activity</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {booking.events.map((event) => (
            <li key={event.id}>
              <span className="text-ink/55">{formatIstDateTime(event.createdAt)}</span>
              {" · "}
              {eventLabel(event.type)}
              {" · "}
              {actorLabel(event.actorType)}
              {event.deltaPaise != null ? (
                <>
                  {" · "}
                  <Money paise={event.deltaPaise} />
                </>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
