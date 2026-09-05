"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { SiteImage } from "@/components/media/SiteImage";
import { GuestStepper } from "@/components/booking/GuestStepper";
import { PriceBreakdown } from "@/components/booking/PriceBreakdown";
import { CallProperty } from "@/components/booking/CallProperty";
import { hotel } from "@/data/hotel";
import { copy } from "@/data/copy";
import { occupancyContactCopy } from "@/data/booking-config";
import { getRoomGroup } from "@/data/rooms";
import { addDays, formatDisplayDate, formatTimeLabel, nightsBetween, todayIstDate } from "@/lib/dates";
import { formatInr } from "@/lib/format";
import { guestCountLabel, physicalOccupancy } from "@/lib/booking/occupancy";
import { describeArrangement, maxPartySize } from "@/lib/booking/arrangements";
import { distributeGuests } from "@/lib/booking/distribute";
import { priceBooking } from "@/lib/booking/pricing";
import { bookingHref, parseComposition } from "@/lib/booking/query";
import { guestSchema, searchSchema } from "@/lib/booking/validation";
import {
  BookingApiError,
  createCheckoutHold,
  createPaymentOrder,
  priceDtoToSnapshot,
  quoteBooking,
  searchAvailability,
  succeedDevelopmentPayment,
} from "@/lib/booking/booking-service.api";
import type { AcMode, Arrangement, Availability, BookingContact, GuestComposition, RoomAllocation } from "@/types";

const DRAFT_KEY = "honeydew.booking-intent.v3";
const LEGACY_DRAFT_KEY = "honeydew.demo.booking-draft.v2";

type Step = "dates" | "guests" | "arrangement" | "configure" | "details" | "review" | "pay";

const steps: Step[] = ["dates", "guests", "arrangement", "configure", "details", "review", "pay"];

interface Draft {
  arrangementId: string | null;
  rooms: RoomAllocation[];
}

function emptyContact(): BookingContact {
  return { fullName: "", phone: "", email: "" };
}

function emptyDraft(): Draft {
  return { arrangementId: null, rooms: [] };
}

function loadDraft(): Draft {
  try {
    sessionStorage.removeItem(LEGACY_DRAFT_KEY);
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return { arrangementId: parsed.arrangementId ?? null, rooms: parsed.rooms ?? [] };
  } catch {
    return emptyDraft();
  }
}

function saveDraft(draft: Draft) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft() {
  sessionStorage.removeItem(DRAFT_KEY);
}

export function BookingWizard() {
  const router = useRouter();
  const search = useSearchParams();
  const checkIn = search.get("checkIn") ?? "";
  const checkOut = search.get("checkOut") ?? "";
  const composition = parseComposition(search);
  const requestedStep = (search.get("step") as Step | null) ?? "dates";
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const datesOk = searchSchema.safeParse({ checkIn, checkOut, composition }).success;
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [contact, setContact] = useState<BookingContact>(emptyContact);
  const [draftReady, setDraftReady] = useState(false);
  const [previewGuests, setPreviewGuests] = useState<GuestComposition | null>(null);

  useEffect(() => {
    const stored = loadDraft();
    queueMicrotask(() => {
      setDraft(stored);
      setDraftReady(true);
    });
  }, []);

  const step: Step = useMemo(() => {
    if (!datesOk) return "dates";
    if (!steps.includes(requestedStep)) return "dates";
    if ((requestedStep === "configure" || requestedStep === "details" || requestedStep === "review" || requestedStep === "pay") && draft.rooms.length === 0) {
      return "arrangement";
    }
    if ((requestedStep === "review" || requestedStep === "pay") && !guestSchema.safeParse(contact).success) return "details";
    return requestedStep;
  }, [datesOk, requestedStep, draft.rooms.length, contact]);

  const shownComposition = step === "guests" ? (previewGuests ?? composition) : composition;
  const occupancy = physicalOccupancy(shownComposition);

  function go(next: Partial<{ step: Step; composition: GuestComposition; checkIn: string; checkOut: string }>) {
    router.push(
      bookingHref({
        checkIn: next.checkIn ?? checkIn,
        checkOut: next.checkOut ?? checkOut,
        composition: next.composition ?? composition,
        step: next.step ?? step,
      }),
    );
  }

  function updateDraft(partial: Partial<Draft>) {
    const next = { ...draft, ...partial };
    setDraft(next);
    saveDraft(next);
  }

  const needsRooms = step === "configure" || step === "details" || step === "review" || step === "pay";
  if (!draftReady && needsRooms) {
    return <p>Loading booking...</p>;
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.8fr)]">
      <div>
        <Stepper current={step} />
        {step === "dates" ? (
          <DatesStep
            checkIn={checkIn || todayIstDate()}
            checkOut={checkOut || addDays(todayIstDate(), 1)}
            composition={composition}
            onContinue={(next) => go({ ...next, step: "guests" })}
          />
        ) : null}
        {step === "guests" ? (
          <GuestsStep
            composition={composition}
            onPreview={setPreviewGuests}
            onBack={() => go({ step: "dates" })}
            onContinue={(next) => {
              updateDraft({ arrangementId: null, rooms: [] });
              go({ composition: next, step: "arrangement" });
            }}
          />
        ) : null}
        {step === "arrangement" ? (
          <ArrangementStep
            checkIn={checkIn}
            checkOut={checkOut}
            composition={composition}
            selectedId={draft.arrangementId}
            onBack={() => go({ step: "guests" })}
            onSelect={(arrangement) => {
              const rooms = distributeGuests(composition, arrangement.rooms);
              updateDraft({ arrangementId: arrangement.id, rooms });
              go({ step: "configure" });
            }}
          />
        ) : null}
        {step === "configure" ? (
          <ConfigureStep
            checkIn={checkIn}
            checkOut={checkOut}
            rooms={draft.rooms}
            onChange={(rooms) => updateDraft({ rooms })}
            onBack={() => go({ step: "arrangement" })}
            onContinue={() => go({ step: "details" })}
          />
        ) : null}
        {step === "details" ? (
          <DetailsStep
            contact={contact}
            onBack={() => go({ step: "configure" })}
            onContinue={(nextContact) => {
              setContact(nextContact);
              go({ step: "review" });
            }}
          />
        ) : null}
        {step === "review" && draft.rooms.length > 0 ? (
          <ReviewStep
            checkIn={checkIn}
            checkOut={checkOut}
            composition={composition}
            rooms={draft.rooms}
            contact={contact}
            onBack={() => go({ step: "details" })}
            onContinue={() => go({ step: "pay" })}
          />
        ) : null}
        {step === "pay" && draft.rooms.length > 0 ? (
          <PayStep
            checkIn={checkIn}
            checkOut={checkOut}
            composition={composition}
            rooms={draft.rooms}
            contact={contact}
            onBack={() => go({ step: "review" })}
          />
        ) : null}
      </div>
      <aside className="h-fit border border-line bg-cream-raised p-5 text-sm leading-6">
        <p className="font-medium">Your stay</p>
        {checkIn && checkOut ? (
          <p className="mt-3">
            {formatDisplayDate(checkIn)} to {formatDisplayDate(checkOut)}
            {nights > 0 ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""}
          </p>
        ) : (
          <p className="mt-3 text-ink/65">Choose dates to begin.</p>
        )}
        <p className="mt-2">{guestCountLabel(occupancy)}</p>
        {draft.rooms.length ? (
          <ul className="mt-3 space-y-1 text-ink/80">
            {draft.rooms.map((room, index) => (
              <li key={room.id}>
                Room {index + 1}: {getRoomGroup(room.roomGroupId)?.publicName},{" "}
                {room.acMode === "ac" ? "AC" : "Non-AC"}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-ink/70">{copy.mealsIncluded}</p>
      </aside>
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const labels: Record<Step, string> = {
    dates: "Dates",
    guests: "Guests",
    arrangement: "Rooms",
    configure: "Options",
    details: "Details",
    review: "Review",
    pay: "Advance",
  };
  const index = steps.indexOf(current) + 1;
  return (
    <div className="mb-8">
      <p className="text-sm text-ink/60">
        <span className="text-honey">{index} of {steps.length}</span>
        <span> · {labels[current]}</span>
      </p>
      <ol className="mt-3 hidden flex-wrap gap-x-4 gap-y-2 text-xs uppercase tracking-[0.14em] text-ink/45 lg:flex">
        {steps.map((item) => (
          <li key={item} className={item === current ? "text-honey" : undefined}>
            {labels[item]}
          </li>
        ))}
      </ol>
    </div>
  );
}

function DatesStep({
  checkIn,
  checkOut,
  composition,
  onContinue,
}: {
  checkIn: string;
  checkOut: string;
  composition: GuestComposition;
  onContinue: (next: { checkIn: string; checkOut: string }) => void;
}) {
  const [start, setStart] = useState(checkIn);
  const [end, setEnd] = useState(checkOut);
  const [error, setError] = useState<string | null>(null);
  const today = todayIstDate();

  return (
    <form
      className="max-w-md space-y-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = searchSchema.safeParse({ checkIn: start, checkOut: end, composition });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Check the dates.");
          return;
        }
        setError(null);
        onContinue({ checkIn: start, checkOut: end });
      }}
    >
      <div>
        <h1 className="font-serif text-3xl tracking-tight">Choose dates</h1>
        <p className="mt-3 text-ink/75">{copy.mealsIncluded}</p>
      </div>
      <Field id="checkIn" label="Check-in">
        <TextInput id="checkIn" type="date" min={today} value={start} onChange={(event) => setStart(event.target.value)} />
      </Field>
      <Field id="checkOut" label="Check-out" error={error ?? undefined}>
        <TextInput
          id="checkOut"
          type="date"
          min={addDays(start, 1)}
          value={end}
          error={Boolean(error)}
          onChange={(event) => setEnd(event.target.value)}
        />
      </Field>
      <Button type="submit">Continue</Button>
    </form>
  );
}

function GuestsStep({
  composition,
  onPreview,
  onBack,
  onContinue,
}: {
  composition: GuestComposition;
  onPreview: (composition: GuestComposition) => void;
  onBack: () => void;
  onContinue: (composition: GuestComposition) => void;
}) {
  const [value, setValue] = useState(composition);
  const occupancy = physicalOccupancy(value);

  return (
    <div className="max-w-md">
      <h1 className="font-serif text-3xl tracking-tight">Who is staying</h1>
      <div className="mt-6">
        <GuestStepper
          value={value}
          onChange={(next) => {
            setValue(next);
            onPreview(next);
          }}
        />
      </div>
      <p className="mt-4 text-sm text-ink/70">{guestCountLabel(occupancy)} in total</p>
      <p className="mt-2 text-sm text-ink/60">
        Children count toward the room. A Single-Bed Room holds up to three people; a Double-Bed Room holds four to six.
      </p>
      <div className="mt-8 flex gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={() => onContinue(value)}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function ArrangementStep({
  checkIn,
  checkOut,
  composition,
  selectedId,
  onBack,
  onSelect,
}: {
  checkIn: string;
  checkOut: string;
  composition: GuestComposition;
  selectedId: string | null;
  onBack: () => void;
  onSelect: (arrangement: Arrangement) => void;
}) {
  const [available, setAvailable] = useState<Availability | null>(null);
  const [options, setOptions] = useState<Arrangement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { adults, childrenUnder5, children5to10 } = composition;
  useEffect(() => {
    let active = true;
    searchAvailability({ checkIn, checkOut, composition: { adults, childrenUnder5, children5to10 } })
      .then((result) => {
        if (!active) return;
        setAvailable(result.availability);
        setOptions(result.arrangements);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not check availability.");
      });
    return () => {
      active = false;
    };
  }, [adults, checkIn, checkOut, children5to10, childrenUnder5]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!available || !options) return <p>Checking rooms...</p>;

  const max = maxPartySize(available);
  const party = physicalOccupancy(composition);

  if (party > max || options.length === 0) {
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="font-serif text-3xl tracking-tight">Rooms for this stay</h1>
        <Notice>{options.length === 0 ? occupancyContactCopy.none : occupancyContactCopy.tooLarge}</Notice>
        <CallProperty />
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Choose a room setup</h1>
      <p className="mt-3 max-w-xl text-ink/75">
        These are the setups that fit {guestCountLabel(party)} for the dates you chose.
      </p>
      <div className="mt-8 grid gap-4">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option)}
            className={`border p-5 text-left ${selectedId === option.id ? "border-honey" : "border-line"}`}
          >
            <p className="font-medium">{describeArrangement(option)}</p>
            <p className="mt-2 text-sm text-ink/70">
              {option.rooms.length} room{option.rooms.length === 1 ? "" : "s"} · Non-AC {formatInr(option.nightlyEstimateNonAc)} · AC {formatInr(option.nightlyEstimateAc)} a night
            </p>
            {option.labels.length ? (
              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-honey">{option.labels.join(" · ")}</p>
            ) : null}
          </button>
        ))}
      </div>
      <Button className="mt-6" variant="secondary" onClick={onBack}>
        Back
      </Button>
    </div>
  );
}

function ConfigureStep({
  checkIn,
  checkOut,
  rooms,
  onChange,
  onBack,
  onContinue,
}: {
  checkIn: string;
  checkOut: string;
  rooms: RoomAllocation[];
  onChange: (rooms: RoomAllocation[]) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const quote = priceBooking({ checkIn, checkOut, rooms });

  function setAc(id: string, acMode: AcMode) {
    onChange(rooms.map((room) => (room.id === id ? { ...room, acMode } : room)));
  }

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Air-conditioning</h1>
      <p className="mt-3 max-w-xl text-ink/75">{copy.acExplainer}</p>
      <div className="mt-8 space-y-4">
        {rooms.map((room, index) => {
          const group = getRoomGroup(room.roomGroupId);
          const image = room.roomGroupId === "double-bed" ? "two-bed-01" : "one-bed-01";
          return (
            <article key={room.id} className="grid gap-4 border border-line md:grid-cols-[10rem_minmax(0,1fr)]">
              <div className="relative min-h-32 md:min-h-full">
                <SiteImage id={image} className="absolute inset-0" />
              </div>
              <div className="p-4">
                <p className="font-medium">
                  Room {index + 1} · {group?.publicName}
                </p>
                <p className="mt-1 text-sm text-ink/70">
                  {guestCountLabel(physicalOccupancy(room.composition))}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={room.acMode === "non-ac" ? "primary" : "secondary"}
                    onClick={() => setAc(room.id, "non-ac")}
                  >
                    Non-AC
                  </Button>
                  <Button
                    type="button"
                    variant={room.acMode === "ac" ? "primary" : "secondary"}
                    onClick={() => setAc(room.id, "ac")}
                  >
                    AC included
                  </Button>
                </div>
                <p className="mt-3 text-sm">{formatInr(quote.rooms[index].nightlyTotal)} a night</p>
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-ink/70">Stay total {formatInr(quote.subtotal)}</p>
      <p className="mt-1 text-sm text-ink/60">{copy.mealsIncluded}</p>
      <div className="mt-6 flex gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function DetailsStep({
  contact,
  onBack,
  onContinue,
}: {
  contact: BookingContact;
  onBack: () => void;
  onContinue: (contact: BookingContact) => void;
}) {
  const form = useForm<BookingContact>({
    resolver: zodResolver(guestSchema),
    defaultValues: contact,
  });

  return (
    <form className="max-w-md space-y-5" onSubmit={form.handleSubmit(onContinue)}>
      <h1 className="font-serif text-3xl tracking-tight">Your details</h1>
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
          inputMode="numeric"
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
      <Notice>{copy.idReminder}</Notice>
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Continue</Button>
      </div>
    </form>
  );
}

function TermsLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-honey underline-offset-4"
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </Link>
  );
}

function ReviewStep({
  checkIn,
  checkOut,
  composition,
  rooms,
  contact,
  onBack,
  onContinue,
}: {
  checkIn: string;
  checkOut: string;
  composition: GuestComposition;
  rooms: RoomAllocation[];
  contact: BookingContact;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof quoteBooking>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const { adults, childrenUnder5, children5to10 } = composition;
  useEffect(() => {
    let active = true;
    quoteBooking({ checkIn, checkOut, composition: { adults, childrenUnder5, children5to10 }, rooms })
      .then((result) => {
        if (active) setQuote(result);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not price this stay.");
      });
    return () => {
      active = false;
    };
  }, [adults, checkIn, checkOut, children5to10, childrenUnder5, rooms]);
  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-3xl tracking-tight">Review</h1>
      <p className="mt-2 text-ink/70">
        {formatDisplayDate(checkIn)} to {formatDisplayDate(checkOut)}. Check-in{" "}
        {formatTimeLabel(hotel.checkInTime)}, check-out {formatTimeLabel(hotel.checkOutTime)}.
      </p>
      <div className="mt-6">
        {quote ? <PriceBreakdown snapshot={priceDtoToSnapshot(quote.price)} /> : <p>Preparing the current price...</p>}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
      <div className="mt-6 space-y-1 text-sm leading-6">
        <p>{contact.fullName}</p>
        <p>{contact.phone}</p>
        <p>{contact.email}</p>
      </div>
      <div className="mt-6 space-y-3">
        <Notice>{copy.idReminder}</Notice>
        <CallProperty />
        <p className="text-sm text-ink/65">
          Cancellation charges apply to the advance paid. See the{" "}
          <Link className="underline decoration-honey underline-offset-4" href="/refunds" target="_blank" rel="noreferrer">
            Refunds &amp; Cancellations policy
          </Link>{" "}
          for the timeline.
        </p>
      </div>
      <div className="mt-6 flex items-start gap-3 border border-line p-4">
        <input
          id="booking-terms"
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <label htmlFor="booking-terms" className="text-sm leading-6">
          I agree to the{" "}
          <TermsLink href="/terms">Terms &amp; Conditions</TermsLink>, the{" "}
          <TermsLink href="/refunds">Refunds &amp; Cancellations policy</TermsLink>, and the{" "}
          <TermsLink href="/privacy">Privacy Policy</TermsLink>.
        </label>
      </div>
      <div className="mt-8 flex gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onContinue} disabled={!quote || !agreed}>
          Continue to advance
        </Button>
      </div>
    </div>
  );
}

function PayStep({
  checkIn,
  checkOut,
  composition,
  rooms,
  contact,
  onBack,
}: {
  checkIn: string;
  checkOut: string;
  composition: GuestComposition;
  rooms: RoomAllocation[];
  contact: BookingContact;
  onBack: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = priceBooking({ checkIn, checkOut, rooms });
  const [authoritative, setAuthoritative] = useState<Awaited<ReturnType<typeof quoteBooking>> | null>(null);
  const [checkoutHold, setCheckoutHold] = useState<Awaited<ReturnType<typeof createCheckoutHold>> | null>(null);
  const { adults, childrenUnder5, children5to10 } = composition;

  useEffect(() => {
    let active = true;
    quoteBooking({ checkIn, checkOut, composition: { adults, childrenUnder5, children5to10 }, rooms })
      .then((result) => {
        if (active) setAuthoritative(result);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not price this stay.");
      });
    return () => {
      active = false;
    };
  }, [adults, checkIn, checkOut, children5to10, childrenUnder5, rooms]);

  async function pay() {
    if (!authoritative || !authoritative.paymentReady) return;
    setBusy(true);
    setError(null);
    try {
      const hold = checkoutHold ?? await createCheckoutHold(authoritative.quoteToken, contact);
      if (!checkoutHold) setCheckoutHold(hold);
      if (!hold.paymentReady) throw new Error("Online payment is not available. Call the camp to book.");
      const order = await createPaymentOrder(hold.holdId);
      await succeedDevelopmentPayment(order.orderId);
      clearDraft();
      router.push(`/book/confirmed?checkout=${encodeURIComponent(hold.holdId)}`);
    } catch (caught) {
      setBusy(false);
      if (caught instanceof BookingApiError && caught.code === "QUOTE_CHANGED") {
        const replacement = await quoteBooking({ checkIn, checkOut, composition, rooms }).catch(() => null);
        if (replacement) setAuthoritative(replacement);
        setError("The price changed. Review the updated advance before trying again.");
        return;
      }
      setError(caught instanceof Error ? caught.message : "Could not complete the booking.");
    }
  }

  const advance = authoritative ? authoritative.price.advancePaise / 100 : preview.advance;
  const balance = authoritative ? authoritative.price.balancePaise / 100 : preview.balance;

  return (
    <div className="max-w-md">
      <h1 className="font-serif text-3xl tracking-tight">Pay the advance</h1>
      <p className="mt-3 text-lg">{formatInr(advance)} now</p>
      <p className="mt-1 text-sm text-ink/70">
        Remaining {formatInr(balance)} is payable at Honey Dew Beach Camp. {copy.mealsIncluded}
      </p>
      <p className="mt-3 text-sm text-ink/65">
        By paying you agree to the{" "}
        <TermsLink href="/terms">Terms &amp; Conditions</TermsLink> and the{" "}
        <TermsLink href="/refunds">Refunds &amp; Cancellations policy</TermsLink>.
      </p>
      <div className="mt-6 space-y-3">
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
      <div className="mt-8 flex flex-col gap-3">
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onBack} disabled={busy}>
            Back
          </Button>
          {authoritative?.paymentReady ? (
            <Button type="button" onClick={pay} disabled={busy}>
              {busy ? "Processing" : "Pay advance"}
            </Button>
          ) : !authoritative ? (
            <Button type="button" disabled>
              Preparing quote
            </Button>
          ) : null}
        </div>
        {authoritative && !authoritative.paymentReady ? (
          <div className="space-y-3">
            <Notice>
              Online payment opens soon. To confirm these rooms today, call the camp on the numbers below — nothing is charged on this page until online payment is enabled.
            </Notice>
            <CallProperty />
          </div>
        ) : null}
      </div>
    </div>
  );
}
