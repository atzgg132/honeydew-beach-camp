"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriceBreakdown } from "@/components/booking/PriceBreakdown";
import { CallProperty } from "@/components/booking/CallProperty";
import { copy } from "@/data/copy";
import { hotel } from "@/data/hotel";
import { formatDisplayDate, formatTimeLabel } from "@/lib/dates";
import { getBookingService } from "@/lib/booking/mock-service";
import type { Booking } from "@/types";

export function ConfirmationView() {
  const search = useSearchParams();
  const ref = search.get("ref");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [missing, setMissing] = useState(!ref);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    getBookingService()
      .getByReference(ref)
      .then((found) => {
        if (cancelled) return;
        if (!found) setMissing(true);
        else setBooking(found);
      });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  if (!ref || missing) {
    return (
      <div className="max-w-lg">
        <h1 className="font-serif text-3xl tracking-tight">No demonstration booking found</h1>
        <p className="mt-3 text-ink/70">Use Manage booking if you already have a reference, or start a new stay.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/manage-booking">Manage booking</Button>
          <Button href="/book" variant="secondary">
            Book now
          </Button>
        </div>
      </div>
    );
  }

  if (!booking) return <p>Loading confirmation...</p>;

  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-3xl tracking-tight">Stay reserved</h1>
      <p className="mt-6 text-sm uppercase tracking-[0.16em] text-ink/50">Reference</p>
      <p className="text-2xl tracking-tight">{booking.reference}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge status={booking.status} />
        <StatusBadge status={booking.paymentStatus} kind="payment" />
      </div>
      <div className="mt-6">
        <Notice tone="demo">{copy.demoBanner}</Notice>
      </div>
      <p className="mt-6">
        {booking.contact.fullName}
        <br />
        {formatDisplayDate(booking.checkIn)} to {formatDisplayDate(booking.checkOut)}
        <br />
        Check-in {formatTimeLabel(hotel.checkInTime)}. Check-out {formatTimeLabel(hotel.checkOutTime)}.
        <br />
        {booking.rooms.length} room{booking.rooms.length === 1 ? "" : "s"}
      </p>
      <div className="mt-6">
        <PriceBreakdown
          snapshot={booking.pricing}
          recorded={{
            advancePaid: booking.advancePaid,
            outstanding: booking.outstanding,
            status: booking.status,
          }}
        />
      </div>
      <div className="mt-6">
        <Notice>{copy.idReminder}</Notice>
      </div>
      <div className="mt-4">
        <CallProperty />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button href={`/manage-booking?ref=${booking.reference}`}>Manage booking</Button>
        <Button href="/" variant="secondary">
          Home
        </Button>
      </div>
    </div>
  );
}
