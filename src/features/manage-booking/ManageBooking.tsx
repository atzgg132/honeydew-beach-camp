"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { PriceBreakdown } from "@/components/booking/PriceBreakdown";
import { GuestStepper } from "@/components/booking/GuestStepper";
import { CallProperty } from "@/components/booking/CallProperty";
import { copy } from "@/data/copy";
import { getRoomGroup } from "@/data/rooms";
import { refundNote } from "@/data/policies";
import { formatDisplayDate, istDateTime } from "@/lib/dates";
import { formatInr } from "@/lib/format";
import { priceBooking } from "@/lib/booking/pricing";
import { rebalanceExistingRooms } from "@/lib/booking/rebalance";
import {
  applyManagedAcUpgrade,
  applyManagedGuestChange,
  cancelManagedBooking,
  getManagedBooking,
  logoutManagedBooking,
  quoteManagedAcUpgrade,
  quoteManagedCancellation,
  quoteManagedGuestChange,
  updateManagedContact,
  verifyManagedBooking,
} from "@/lib/booking/booking-service.api";
import { guestSchema, lookupSchema } from "@/lib/booking/validation";
import type { Booking, BookingContact, CancellationQuote, GuestComposition } from "@/types";

export function ManageBooking() {
  const search = useSearchParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getManagedBooking()
      .then((found) => {
        if (active) setBooking(found);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (checkingSession) return <p>Checking your secure session...</p>;

  if (booking) {
    return (
      <BookingFolio
        booking={booking}
        onChange={setBooking}
        onClear={async () => {
          await logoutManagedBooking().catch(() => undefined);
          setBooking(null);
        }}
      />
    );
  }

  return <LookupForm initialReference={search.get("ref") ?? ""} error={error} onError={setError} onFound={setBooking} />;
}

function LookupForm({ initialReference, error, onError, onFound }: {
  initialReference: string;
  error: string | null;
  onError: (value: string | null) => void;
  onFound: (booking: Booking) => void;
}) {
  const form = useForm({ resolver: zodResolver(lookupSchema), defaultValues: { reference: initialReference, phone: "" } });
  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-4xl tracking-tight">Manage booking</h1>
      <p className="mt-3 text-ink/75">Use your booking reference and the phone number on the stay.</p>
      <form className="mt-8 space-y-5" onSubmit={form.handleSubmit(async (values) => {
        try {
          const result = await verifyManagedBooking(values.reference, values.phone);
          onError(null);
          onFound(result.booking);
        } catch (caught) {
          onError(caught instanceof Error ? caught.message : "No booking matches those details.");
        }
      })}>
        <Field id="reference" label="Booking reference" error={form.formState.errors.reference?.message}>
          <TextInput id="reference" autoComplete="off" error={Boolean(form.formState.errors.reference)} {...form.register("reference")} />
        </Field>
        <Field id="phone" label="Phone" error={form.formState.errors.phone?.message}>
          <TextInput id="phone" type="tel" inputMode="numeric" autoComplete="tel" error={Boolean(form.formState.errors.phone)} {...form.register("phone")} />
        </Field>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Verifying" : "Find booking"}</Button>
      </form>
    </div>
  );
}

function FolioPanel({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-line bg-cream-raised p-4 lg:border-0 lg:bg-transparent lg:p-0">
      <button type="button" className="flex min-h-11 w-full items-center justify-between text-left text-lg tracking-tight lg:hidden" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {title}<span aria-hidden className="text-ink/45">{open ? "−" : "+"}</span>
      </button>
      <h2 className="hidden text-lg tracking-tight lg:block">{title}</h2>
      <div className={`mt-4 ${open ? "block" : "hidden"} lg:block`}>{children}</div>
    </div>
  );
}

function BookingFolio({ booking, onChange, onClear }: { booking: Booking; onChange: (booking: Booking) => void; onClear: () => void }) {
  const locked = booking.status === "cancelled" || new Date() >= istDateTime(booking.checkIn, "11:00");
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.8fr)]">
      <div>
        <p className="text-sm uppercase tracking-[0.16em] text-ink/50">Reference</p>
        <h1 className="font-serif text-3xl tracking-tight">{booking.reference}</h1>
        <div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={booking.status} /><StatusBadge status={booking.paymentStatus} kind="payment" /></div>
        <div className="mt-8 space-y-1 text-base leading-7">
          <p>{booking.contact.fullName}</p><p>{booking.contact.phone}</p><p>{booking.contact.email}</p>
          <p>{formatDisplayDate(booking.checkIn)} to {formatDisplayDate(booking.checkOut)}</p>
          <p className="text-sm text-ink/65">{copy.datesLocked}</p>
        </div>
        <div className="mt-8"><PriceBreakdown snapshot={booking.pricing} recorded={{ advancePaid: booking.advancePaid, outstanding: booking.outstanding, status: booking.status }} /></div>
        {booking.cancellationQuote ? <div className="mt-6"><Notice>{booking.cancellationQuote.slab.label}. Charge {formatInr(booking.cancellationQuote.charge)}. Refundable {formatInr(booking.cancellationQuote.refundable)}. {refundNote}</Notice></div> : null}
      </div>
      <aside className="space-y-6 lg:space-y-8">
        {!locked ? <>
          <FolioPanel title="Contact" defaultOpen><ContactEdit booking={booking} onChange={onChange} /></FolioPanel>
          <FolioPanel title="Change guests"><ChangeGuests booking={booking} onChange={onChange} /></FolioPanel>
          {booking.rooms.map((room, index) => room.acMode === "non-ac" ? (
            <FolioPanel key={room.id} title={`Air-conditioning · Room ${index + 1}`}>
              <UpgradePanel booking={booking} roomId={room.id} label={`Room ${index + 1} · ${getRoomGroup(room.roomGroupId)?.publicName}`} onChange={onChange} />
            </FolioPanel>
          ) : null)}
          <FolioPanel title="Cancellation"><CancelPanel onChange={onChange} /></FolioPanel>
        </> : <Notice>This booking can only be viewed.</Notice>}
        <CallProperty />
        <Button type="button" variant="secondary" onClick={onClear}>Look up another booking</Button>
      </aside>
    </div>
  );
}

function ContactEdit({ booking, onChange }: { booking: Booking; onChange: (booking: Booking) => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<BookingContact>({ resolver: zodResolver(guestSchema), defaultValues: booking.contact });
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(async (contact) => {
      try { onChange(await updateManagedContact(contact)); setMessage("Contact details saved."); }
      catch (caught) { setMessage(caught instanceof Error ? caught.message : "Could not save contact details."); }
    })}>
      <Field id="fullName" label="Full name" error={form.formState.errors.fullName?.message}><TextInput id="fullName" autoComplete="name" error={Boolean(form.formState.errors.fullName)} {...form.register("fullName")} /></Field>
      <Field id="phone" label="Phone" error={form.formState.errors.phone?.message}><TextInput id="phone" type="tel" autoComplete="tel" error={Boolean(form.formState.errors.phone)} {...form.register("phone")} /></Field>
      <Field id="email" label="Email" error={form.formState.errors.email?.message}><TextInput id="email" type="email" autoComplete="email" error={Boolean(form.formState.errors.email)} {...form.register("email")} /></Field>
      {message ? <Notice>{message}</Notice> : null}
      <Button type="submit" variant="secondary" disabled={form.formState.isSubmitting}>Save contact</Button>
    </form>
  );
}

function ChangeGuests({ booking, onChange }: { booking: Booking; onChange: (booking: Booking) => void }) {
  const [composition, setComposition] = useState<GuestComposition>(booking.composition);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rebalanced = rebalanceExistingRooms(booking.rooms, composition);
  const preview = rebalanced ? priceBooking({ checkIn: booking.checkIn, checkOut: booking.checkOut, rooms: rebalanced }) : null;
  return (
    <div>
      <GuestStepper value={composition} onChange={setComposition} />
      {preview && preview.subtotal !== booking.pricing.subtotal ? <p className="mt-3 text-sm leading-6 text-ink/75">Preview total {formatInr(preview.subtotal)}. The server will confirm the final amount.</p> : null}
      {!rebalanced ? <Notice>This change needs a different mix of rooms. Please call Honey Dew Beach Camp.</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}
      <Button type="button" variant="secondary" className="mt-3" disabled={busy || !rebalanced} onClick={async () => {
        setBusy(true); setMessage(null);
        try {
          const quote = await quoteManagedGuestChange(composition);
          onChange(await applyManagedGuestChange(quote.quoteToken));
          setMessage("Guest composition updated. Any paid excess is reviewed by the hotel.");
        } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Could not update the guests."); }
        finally { setBusy(false); }
      }}>{busy ? "Confirming" : "Confirm guest change"}</Button>
    </div>
  );
}

function UpgradePanel({ booking, roomId, label, onChange }: { booking: Booking; roomId: string; label: string; onChange: (booking: Booking) => void }) {
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof quoteManagedAcUpgrade>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <p className="text-sm leading-6">{label} is Non-AC. The server prices this one-way upgrade using the booking&apos;s original tariff revision.</p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="button" className="mt-3" disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        try { setQuote(await quoteManagedAcUpgrade(roomId)); }
        catch (caught) { setError(caught instanceof Error ? caught.message : "Could not quote the upgrade."); }
        finally { setBusy(false); }
      }}>{busy ? "Pricing" : `Upgrade ${label}`}</Button>
      {quote ? <ConfirmDialog title="Add air-conditioning" confirmLabel="Confirm upgrade" cancelLabel="Keep Non-AC" onClose={() => setQuote(null)} onConfirm={async () => {
        try { onChange(await applyManagedAcUpgrade(roomId, quote.quoteToken)); setQuote(null); }
        catch (caught) { setError(caught instanceof Error ? caught.message : "Could not apply the upgrade."); }
      }}>
        <p>New stay total {formatInr(quote.price.subtotalPaise / 100)}.</p>
        <p className="mt-2">Difference {formatInr(quote.deltaPaise / 100)}, added to the hotel balance.</p>
        <p className="mt-2">Advance paid stays {formatInr(booking.advancePaid)}.</p>
      </ConfirmDialog> : null}
    </div>
  );
}

function CancelPanel({ onChange }: { onChange: (booking: Booking) => void }) {
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    quoteManagedCancellation().then(setQuote).catch((caught) => setMessage(caught instanceof Error ? caught.message : "Could not calculate cancellation."));
  }, []);
  return (
    <div>
      {quote ? <><p className="text-sm leading-6">{quote.slab.label}. Advance {formatInr(quote.advancePaid)}. Charge {formatInr(quote.charge)}. Refundable {formatInr(quote.refundable)}.</p><p className="mt-2 text-sm text-ink/70">{refundNote}</p></> : <p className="text-sm text-ink/70">Calculating the current cancellation amount...</p>}
      {message ? <Notice tone="error">{message}</Notice> : null}
      <Button type="button" variant="danger" className="mt-3" disabled={!quote} onClick={async () => {
        try { setQuote(await quoteManagedCancellation()); setOpen(true); }
        catch (caught) { setMessage(caught instanceof Error ? caught.message : "Could not calculate cancellation."); }
      }}>Cancel stay</Button>
      {open && quote ? <ConfirmDialog title="Cancel this stay" confirmLabel="Confirm cancellation" danger onClose={() => setOpen(false)} onConfirm={async () => {
        try { onChange(await cancelManagedBooking()); setOpen(false); }
        catch (caught) { setMessage(caught instanceof Error ? caught.message : "Could not cancel the stay."); }
      }}>
        <p>{quote.slab.label}. Charge {formatInr(quote.charge)}. Refundable {formatInr(quote.refundable)}.</p>
        <p className="mt-2">The server recalculates this amount at cancellation time. {refundNote}</p>
      </ConfirmDialog> : null}
    </div>
  );
}
