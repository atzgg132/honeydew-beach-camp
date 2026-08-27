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
import { bookingConfig } from "@/data/booking-config";
import { copy } from "@/data/copy";
import { getRoomGroup } from "@/data/rooms";
import { refundNote } from "@/data/policies";
import { formatDisplayDate, todayIstDate } from "@/lib/dates";
import { formatInr } from "@/lib/format";
import { quoteCancellation } from "@/lib/booking/cancellation";
import { priceBooking } from "@/lib/booking/pricing";
import { rebalanceExistingRooms } from "@/lib/booking/rebalance";
import { getBookingService } from "@/lib/booking/mock-service";
import { guestSchema, lookupSchema } from "@/lib/booking/validation";
import type { Booking, BookingContact, GuestComposition } from "@/types";

const SESSION_KEY = "honeydew.demo.active-ref";

export function ManageBooking() {
  const search = useSearchParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const preset = search.get("ref") || (typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null);
    if (!preset) return;
    getBookingService()
      .getByReference(preset)
      .then((found) => {
        if (found) {
          setBooking(found);
          sessionStorage.setItem(SESSION_KEY, found.reference);
        }
      });
  }, [search]);

  if (booking) {
    return (
      <BookingFolio
        booking={booking}
        onChange={(next) => setBooking(next)}
        onClear={() => {
          sessionStorage.removeItem(SESSION_KEY);
          setBooking(null);
        }}
      />
    );
  }

  return <LookupForm error={error} onError={setError} onFound={setBooking} />;
}

function LookupForm({
  error,
  onError,
  onFound,
}: {
  error: string | null;
  onError: (value: string | null) => void;
  onFound: (booking: Booking) => void;
}) {
  const form = useForm({
    resolver: zodResolver(lookupSchema),
    defaultValues: { reference: "", phone: "" },
  });

  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-4xl tracking-tight">Manage booking</h1>
      <p className="mt-3 text-ink/75">Use your booking reference and the phone number on the stay.</p>
      <form
        className="mt-8 space-y-5"
        onSubmit={form.handleSubmit(async (values) => {
          const found = await getBookingService().find(values);
          if (!found) {
            onError("No demonstration booking matches that reference and phone.");
            return;
          }
          onError(null);
          sessionStorage.setItem(SESSION_KEY, found.reference);
          onFound(found);
        })}
      >
        <Field id="reference" label="Booking reference" error={form.formState.errors.reference?.message}>
          <TextInput
            id="reference"
            autoComplete="off"
            error={Boolean(form.formState.errors.reference)}
            {...form.register("reference")}
          />
        </Field>
        <Field id="phone" label="Phone" error={form.formState.errors.phone?.message}>
          <TextInput
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            error={Boolean(form.formState.errors.phone)}
            {...form.register("phone")}
          />
        </Field>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button type="submit">Find booking</Button>
      </form>

      <div className="mt-12 border-t border-line pt-8">
        <h2 className="font-serif text-xl tracking-tight">Demonstration bookings</h2>
        <p className="mt-2 text-sm text-ink/70">Phone for all examples: {bookingConfig.demoPhone}</p>
        <ul className="mt-4 space-y-2 text-sm leading-6">
          <li>HD-DEMO-8841 · Ananya · 1 guest · Single-Bed, Non-AC · October</li>
          <li>HD-DEMO-5520 · Rahul · 4 guests · two Single-Bed rooms · one Non-AC, one AC</li>
          <li>HD-DEMO-1033 · Meera · already cancelled</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {["HD-DEMO-8841", "HD-DEMO-5520", "HD-DEMO-1033"].map((reference) => (
            <Button
              key={reference}
              type="button"
              variant="secondary"
              onClick={async () => {
                const found = await getBookingService().find({
                  reference,
                  phone: bookingConfig.demoPhone,
                });
                if (found) {
                  sessionStorage.setItem(SESSION_KEY, found.reference);
                  onFound(found);
                }
              }}
            >
              Open {reference}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FolioPanel({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-line bg-cream-raised p-4 lg:border-0 lg:bg-transparent lg:p-0">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between text-left text-lg tracking-tight lg:hidden"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {title}
        <span aria-hidden className="text-ink/45">{open ? "−" : "+"}</span>
      </button>
      <h2 className="hidden text-lg tracking-tight lg:block">{title}</h2>
      <div className={`mt-4 ${open ? "block" : "hidden"} lg:block`}>{children}</div>
    </div>
  );
}

function BookingFolio({
  booking,
  onChange,
  onClear,
}: {
  booking: Booking;
  onChange: (booking: Booking) => void;
  onClear: () => void;
}) {
  const locked = booking.status === "cancelled" || booking.checkIn < todayIstDate();

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.8fr)]">
      <div>
        <p className="text-sm uppercase tracking-[0.16em] text-ink/50">Reference</p>
        <h1 className="font-serif text-3xl tracking-tight">{booking.reference}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge status={booking.status} />
          <StatusBadge status={booking.paymentStatus} kind="payment" />
        </div>
        <div className="mt-6">
          <Notice tone="demo">{copy.demoBanner}</Notice>
        </div>
        <div className="mt-8 space-y-1 text-base leading-7">
          <p>{booking.contact.fullName}</p>
          <p>{booking.contact.phone}</p>
          <p>{booking.contact.email}</p>
          <p>
            {formatDisplayDate(booking.checkIn)} to {formatDisplayDate(booking.checkOut)}
          </p>
          <p className="text-sm text-ink/65">{copy.datesLocked}</p>
        </div>
        <div className="mt-8">
          <PriceBreakdown
            snapshot={booking.pricing}
            recorded={{
              advancePaid: booking.advancePaid,
              outstanding: booking.outstanding,
              status: booking.status,
            }}
          />
        </div>
        {booking.cancellationQuote ? (
          <div className="mt-6">
            <Notice>
              {booking.cancellationQuote.slab.label}. Charge {formatInr(booking.cancellationQuote.charge)}.
              Refundable {formatInr(booking.cancellationQuote.refundable)}. {refundNote}
            </Notice>
          </div>
        ) : null}
      </div>
      <aside className="space-y-6 lg:space-y-8">
        {!locked ? (
          <>
            <FolioPanel title="Contact" defaultOpen>
              <ContactEdit booking={booking} onChange={onChange} />
            </FolioPanel>
            <FolioPanel title="Change guests">
              <ChangeGuests booking={booking} onChange={onChange} />
            </FolioPanel>
            {booking.rooms.map((room, index) =>
              room.acMode === "non-ac" ? (
                <FolioPanel
                  key={room.id}
                  title={`Air-conditioning · Room ${index + 1}`}
                >
                  <UpgradePanel
                    booking={booking}
                    roomId={room.id}
                    label={`Room ${index + 1} · ${getRoomGroup(room.roomGroupId)?.publicName}`}
                    onChange={onChange}
                  />
                </FolioPanel>
              ) : null,
            )}
            <FolioPanel title="Cancellation">
              <CancelPanel booking={booking} onChange={onChange} />
            </FolioPanel>
          </>
        ) : (
          <Notice>This booking can only be viewed.</Notice>
        )}
        <CallProperty />
        <Button type="button" variant="secondary" onClick={onClear}>
          Look up another booking
        </Button>
      </aside>
    </div>
  );
}

function ContactEdit({ booking, onChange }: { booking: Booking; onChange: (booking: Booking) => void }) {
  const [saved, setSaved] = useState(false);
  const form = useForm<BookingContact>({
    resolver: zodResolver(guestSchema),
    defaultValues: booking.contact,
  });

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (contact) => {
        const next = await getBookingService().updateContact(booking.reference, contact);
        onChange(next);
        setSaved(true);
      })}
    >
      <Field id="fullName" label="Full name" error={form.formState.errors.fullName?.message}>
        <TextInput
          id="fullName"
          autoComplete="name"
          error={Boolean(form.formState.errors.fullName)}
          {...form.register("fullName")}
        />
      </Field>
      <Field id="phone" label="Phone" error={form.formState.errors.phone?.message}>
        <TextInput
          id="phone"
          type="tel"
          autoComplete="tel"
          error={Boolean(form.formState.errors.phone)}
          {...form.register("phone")}
        />
      </Field>
      <Field id="email" label="Email" error={form.formState.errors.email?.message}>
        <TextInput
          id="email"
          type="email"
          autoComplete="email"
          error={Boolean(form.formState.errors.email)}
          {...form.register("email")}
        />
      </Field>
      {saved ? <Notice tone="success">Saved on this device.</Notice> : null}
      <Button type="submit" variant="secondary">
        Save contact
      </Button>
    </form>
  );
}

function ChangeGuests({ booking, onChange }: { booking: Booking; onChange: (booking: Booking) => void }) {
  const [composition, setComposition] = useState<GuestComposition>(booking.composition);
  const [message, setMessage] = useState<string | null>(null);
  const rebalanced = rebalanceExistingRooms(booking.rooms, composition);
  const preview = rebalanced
    ? priceBooking({ checkIn: booking.checkIn, checkOut: booking.checkOut, rooms: rebalanced })
    : null;
  const delta = preview ? preview.subtotal - booking.pricing.subtotal : null;

  return (
    <div>
      <GuestStepper value={composition} onChange={setComposition} />
      {preview && delta !== null && delta !== 0 ? (
        <p className="mt-3 text-sm leading-6 text-ink/75">
          New stay total {formatInr(preview.subtotal)}.{" "}
          {delta > 0
            ? `${formatInr(delta)} would be added to the balance at the hotel.`
            : `The hotel reviews any difference already paid.`}
        </p>
      ) : null}
      {!rebalanced ? (
        <Notice>
          This change needs a different mix of rooms. Please call Honey Dew Beach Camp.
        </Notice>
      ) : null}
      {message ? <Notice>{message}</Notice> : null}
      <Button
        type="button"
        variant="secondary"
        className="mt-3"
        onClick={async () => {
          try {
            const next = await getBookingService().changeGuests(booking.reference, composition);
            onChange(next);
            setMessage("Guest composition updated. Any extra already paid is reviewed by the hotel.");
          } catch {
            setMessage(
              "This change requires a different room arrangement. Please call Honey Dew Beach Camp.",
            );
          }
        }}
      >
        Confirm guest change
      </Button>
    </div>
  );
}

function UpgradePanel({
  booking,
  roomId,
  label,
  onChange,
}: {
  booking: Booking;
  roomId: string;
  label: string;
  onChange: (booking: Booking) => void;
}) {
  const [open, setOpen] = useState(false);
  const room = booking.rooms.find((item) => item.id === roomId);
  if (!room) return null;

  const nextRooms = booking.rooms.map((item) => ({
    id: item.id,
    roomGroupId: item.roomGroupId,
    acMode: item.id === roomId ? ("ac" as const) : item.acMode,
    composition: item.composition,
  }));
  const nextQuote = priceBooking({
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    rooms: nextRooms,
  });
  const difference = nextQuote.subtotal - booking.pricing.subtotal;
  const newOutstanding = booking.outstanding + Math.max(0, difference);

  return (
    <div>
      <p className="text-sm leading-6">
        {label} is Non-AC. Adding air-conditioning changes the stay total. The extra amount is added to the
        balance due at the hotel. The advance already paid stays the same.
      </p>
      <Button type="button" className="mt-3" onClick={() => setOpen(true)}>
        Upgrade {label}
      </Button>
      {open ? (
        <ConfirmDialog
          title="Add air-conditioning"
          confirmLabel="Confirm upgrade"
          cancelLabel="Keep Non-AC"
          onClose={() => setOpen(false)}
          onConfirm={async () => {
            onChange(await getBookingService().upgradeRoomToAc(booking.reference, roomId));
            setOpen(false);
          }}
        >
          <p>Stay total {formatInr(booking.pricing.subtotal)} → {formatInr(nextQuote.subtotal)}.</p>
          <p className="mt-2">Difference {formatInr(difference)}, added to the hotel balance.</p>
          <p className="mt-2">Advance paid stays {formatInr(booking.advancePaid)}.</p>
          <p className="mt-2">New outstanding {formatInr(newOutstanding)}.</p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function CancelPanel({ booking, onChange }: { booking: Booking; onChange: (booking: Booking) => void }) {
  const [open, setOpen] = useState(false);
  const quote = quoteCancellation({
    checkIn: booking.checkIn,
    advancePaid: booking.advancePaid,
  });

  return (
    <div>
      <p className="text-sm leading-6">
        {quote.slab.label}. Advance {formatInr(quote.advancePaid)}. Charge {formatInr(quote.charge)}. Refundable{" "}
        {formatInr(quote.refundable)}.
      </p>
      <p className="mt-2 text-sm text-ink/70">{quote.slab.explanation}</p>
      <p className="mt-2 text-sm text-ink/70">{refundNote}</p>
      <Button type="button" variant="danger" className="mt-3" onClick={() => setOpen(true)}>
        Cancel stay
      </Button>
      {open ? (
        <ConfirmDialog
          title="Cancel this stay"
          confirmLabel="Confirm cancellation"
          danger
          onClose={() => setOpen(false)}
          onConfirm={async () => {
            onChange(await getBookingService().cancel(booking.reference));
            setOpen(false);
          }}
        >
          <p>
            {quote.slab.label}. Charge {formatInr(quote.charge)}. Refundable {formatInr(quote.refundable)}.
          </p>
          <p className="mt-2">{refundNote}</p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
