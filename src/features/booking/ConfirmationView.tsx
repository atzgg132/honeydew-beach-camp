"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriceBreakdown } from "@/components/booking/PriceBreakdown";
import { RefundReceipt } from "@/features/booking/RefundReceipt";
import { CallProperty } from "@/components/booking/CallProperty";
import { copy } from "@/data/copy";
import { hotel } from "@/data/hotel";
import { formatInr } from "@/lib/format";
import { formatDisplayDate, formatTimeLabel } from "@/lib/dates";
import { getCheckout } from "@/lib/booking/booking-service.api";
import type { Booking } from "@/types";

const POLL_MS = 2_000;
const MAX_POLLS = 20;

export function ConfirmationView() {
  const search = useSearchParams();
  const checkout = search.get("checkout");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [state, setState] = useState<"loading" | "pending" | "missing" | "timeout" | "paid_unallocated" | "expired">(
    checkout ? "loading" : "missing",
  );
  const [exception, setException] = useState<{ amountPaid: number; paidAt: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!checkout) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const load = async () => {
      try {
        const result = await getCheckout(checkout);
        if (cancelled) return;
        // Money settlement recorded but could not attach to rooms (paid after the hold
        // expired). The booking stays unconfirmed; only the camp can resolve it from here.
        if (result.paymentException) {
          setException({ amountPaid: result.paymentException.amountPaid, paidAt: result.paymentException.paidAt });
          setState("paid_unallocated");
          return;
        }
        if (result.booking) {
          setBooking(result.booking);
          setState("loading");
          return;
        }
        if (result.status === "pending_payment") {
          attempts += 1;
          if (attempts >= MAX_POLLS) {
            setState("timeout");
            return;
          }
          setState("pending");
          timer = setTimeout(load, POLL_MS);
          return;
        }
        if (result.status === "expired") {
          setState("expired");
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

  if (booking) {
    return (
      <div className="max-w-lg">
        <h1 className="font-serif text-3xl tracking-tight">Stay reserved</h1>
        <p className="mt-6 text-sm uppercase tracking-[0.16em] text-ink/50">Reference</p>
        <p className="text-2xl tracking-tight">{booking.reference}</p>
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() => {
            void navigator.clipboard.writeText(booking.reference).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy reference"}
        </Button>
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
        {booking.cancellationQuote?.refund ? (
          <div className="mt-6">
            <RefundReceipt refund={booking.cancellationQuote.refund} />
          </div>
        ) : null}
        <div className="mt-6">
          <Notice>{copy.idReminder}</Notice>
        </div>
        <div className="mt-4">
          <CallProperty />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href={`/manage-booking?ref=${booking.reference}`}>Manage booking</Button>
          {checkout ? (
            <Button href={`/api/checkout/holds/${encodeURIComponent(checkout)}/voucher`} variant="secondary">
              Download voucher (PDF)
            </Button>
          ) : null}
          <Button href="/" variant="secondary">
            Home
          </Button>
        </div>
      </div>
    );
  }

  if (state === "paid_unallocated") {
    return (
      <div className="max-w-lg" aria-live="polite">
        <h1 className="font-serif text-3xl tracking-tight">Payment received â€” the camp will confirm it</h1>
        <p className="mt-3 text-ink/70">
          {exception ? <>We recorded your payment of {formatInr(exception.amountPaid)}. </> : null}
          It arrived after the room hold expired, so it is not attached to rooms yet. Nothing more is
          needed from you right now: do not pay again. The camp will either confirm rooms or refund the
          amount â€” only the camp can take it from here.
        </p>
        <div className="mt-6">
          <CallProperty />
        </div>
        <p className="mt-4 text-sm leading-6 text-ink/70">
          When you call, quote your stay dates and the amount paid
          {exception?.paidAt ? <> (paid {new Date(exception.paidAt).toLocaleString("en-IN")})</> : null}.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/contact">Contact the camp</Button>
          <Button href="/" variant="secondary">
            Home
          </Button>
        </div>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className="max-w-lg" aria-live="polite">
        <h1 className="font-serif text-3xl tracking-tight">Hold expired</h1>
        <p className="mt-3 text-ink/70">
          The room hold lapsed before payment completed, so the rooms were released and nothing was
          booked. If no money left your account, start a new search with Book now. If you were
          charged, do not pay again â€” reopen this page and a late payment appears here for the
          camp&apos;s review.
        </p>
        <div className="mt-6">
          <CallProperty />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/book">Book now</Button>
          <Button href="/contact" variant="secondary">
            Contact the camp
          </Button>
        </div>
      </div>
    );
  }

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

  if (state === "timeout") {
    return (
      <div className="max-w-lg" aria-live="polite">
        <h1 className="font-serif text-3xl tracking-tight">Still confirming</h1>
        <p className="mt-3 text-ink/70">
          The payment result has not arrived yet â€” this happens when the provider&apos;s confirmation is
          delayed. If your bank shows a charge, do not pay again: wait a few minutes, reopen this page
          from the same link, and a late payment appears here for the camp&apos;s review. If there is
          still no confirmation, call the camp with your dates and the charged amount.
        </p>
        <div className="mt-6">
          <CallProperty />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/contact" variant="secondary">
            Contact the camp
          </Button>
        </div>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="max-w-lg" aria-live="polite">
        <h1 className="font-serif text-3xl tracking-tight">Confirming payment</h1>
        <p className="mt-3 text-ink/70">Your rooms are held while the verified payment result arrives. This page updates automatically â€” keep it open and do not pay again or start a new booking while you wait.</p>
      </div>
    );
  }

  return <p aria-live="polite">Loading confirmation...</p>;
}
