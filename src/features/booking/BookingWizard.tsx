"use client";

import { useEffect, useMemo, useState } from "react";
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
import { describeArrangement, generateArrangements, maxPartySize } from "@/lib/booking/arrangements";
import { distributeGuests } from "@/lib/booking/distribute";
import { priceBooking } from "@/lib/booking/pricing";
import { bookingHref, parseComposition } from "@/lib/booking/query";
import { guestSchema, searchSchema } from "@/lib/booking/validation";
import { getBookingService } from "@/lib/booking/mock-service";
import type { AcMode, Arrangement, Availability, BookingContact, GuestComposition, RoomAllocation } from "@/types";

const DRAFT_KEY = "honeydew.demo.booking-draft.v2";

type Step = "dates" | "guests" | "arrangement" | "configure" | "details" | "review" | "pay";

const steps: Step[] = ["dates", "guests", "arrangement", "configure", "details", "review", "pay"];

interface Draft {
  arrangementId: string | null;
  rooms: RoomAllocation[];
  contact: BookingContact;
}

function emptyContact(): BookingContact {
  return { fullName: "", phone: "", email: "" };
}

function emptyDraft(): Draft {
  return { arrangementId: null, rooms: [], contact: emptyContact() };
}

function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : emptyDraft();
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
    return requestedStep;
  }, [datesOk, requestedStep, draft.rooms.length]);

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
            contact={draft.contact}
            onBack={() => go({ step: "configure" })}
            onContinue={(contact) => {
              updateDraft({ contact });
              go({ step: "review" });
            }}
          />
        ) : null}
        {step === "review" && draft.rooms.length > 0 ? (
          <ReviewStep
            checkIn={checkIn}
            checkOut={checkOut}
            rooms={draft.rooms}
            contact={draft.contact}
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
            contact={draft.contact}
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
  useEffect(() => {
    getBookingService()
      .availability(checkIn, checkOut)
      .then(setAvailable);
  }, [checkIn, checkOut]);

  if (!available) return <p>Checking rooms...</p>;

  const options = generateArrangements(composition, available);
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

function ReviewStep({
  checkIn,
  checkOut,
  rooms,
  contact,
  onBack,
  onContinue,
}: {
  checkIn: string;
  checkOut: string;
  rooms: RoomAllocation[];
  contact: BookingContact;
  onBack: () => void;
  onContinue: () => void;
}) {
  const quote = priceBooking({ checkIn, checkOut, rooms });
  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-3xl tracking-tight">Review</h1>
      <p className="mt-2 text-ink/70">
        {formatDisplayDate(checkIn)} to {formatDisplayDate(checkOut)}. Check-in{" "}
        {formatTimeLabel(hotel.checkInTime)}, check-out {formatTimeLabel(hotel.checkOutTime)}.
      </p>
      <div className="mt-6">
        <PriceBreakdown snapshot={quote} />
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
          Cancellation charges apply to the advance paid. See policies for the timeline.
        </p>
      </div>
      <div className="mt-8 flex gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onContinue}>
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
  const quote = priceBooking({ checkIn, checkOut, rooms });
  const fail = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("failPayment") === "1";

  async function pay() {
    setBusy(true);
    setError(null);
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (fail) {
      setBusy(false);
      setError("The demonstration payment did not complete. Try again.");
      return;
    }
    try {
      const booking = await getBookingService().create({
        checkIn,
        checkOut,
        composition,
        contact,
        rooms,
      });
      clearDraft();
      router.push(`/book/confirmed?ref=${booking.reference}`);
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : "Could not create the demonstration booking.");
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="font-serif text-3xl tracking-tight">Pay the advance</h1>
      <p className="mt-3 text-lg">{formatInr(quote.advance)} now</p>
      <p className="mt-1 text-sm text-ink/70">
        Remaining {formatInr(quote.balance)} is payable at Honey Dew Beach Camp. {copy.mealsIncluded}
      </p>
      <div className="mt-6 space-y-3">
        <Notice tone="demo">{copy.demoBanner}</Notice>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
      <div className="mt-8 flex gap-3">
        <Button type="button" variant="secondary" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button type="button" onClick={pay} disabled={busy}>
          {busy ? "Processing" : "Pay advance"}
        </Button>
      </div>
    </div>
  );
}
