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
import { getCheckout } from "@/lib/booking/booking-service.api";
import type { Booking } from "@/types";

export function ConfirmationView() {
  const search = useSearchParams();
  const checkout = search.get("checkout");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [state, setState] = useState<"loading" | "pending" | "missing">(checkout ? "loading" : "missing");

  useEffect(() => {
    if (!checkout) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const result = await getCheckout(checkout);
        if (cancelled) return;
        if (result.booking) {
          setBooking(result.booking);
          return;
        }
        if (result.status === "pending_payment") {
          setState("pending");
          timer = setTimeout(load, 2_000);
          return;
        }
        setState("missing");
      } catch {
        if (!cancelled) setState("missing");
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [checkout]);

  if (!checkout || state === "missing") {
    return (
      <div className="max-w-lg">
        <h1 className="font-serif text-3xl tracking-tight">Confirmation unavailable</h1>
        <p className="mt-3 text-ink/70">This confirmation needs the secure checkout session. Use Manage booking if you already have a reference.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/manage-booking">Manage booking</Button>
          <Button href="/book" variant="secondary">
            Book now
          </Button>
        </div>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="max-w-lg">
        <h1 className="font-serif text-3xl tracking-tight">Confirming payment</h1>
        <p className="mt-3 text-ink/70">Your rooms are held while the verified payment result arrives. This page updates automatically.</p>
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
