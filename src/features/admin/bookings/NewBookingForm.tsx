"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { GuestStepper } from "@/components/booking/GuestStepper";
import { adminCreateBooking, adminQuote, adminSearchAvailability, AdminApiError } from "@/features/admin/api";
import { distributeGuests } from "@/lib/booking/distribute";
import { formatInrPaise } from "@/lib/format";
import type { GuestComposition, RoomShape } from "@/types";

type Arrangement = {
  id: string;
  rooms: RoomShape[];
  nightlyEstimateAcPaise: number;
  nightlyEstimateNonAcPaise: number;
  labels: string[];
};

export function NewBookingForm({ checkIn: initialCheckIn, checkOut: initialCheckOut }: { checkIn: string; checkOut: string }) {
  const router = useRouter();
  const [source, setSource] = useState<"PHONE" | "WALK_IN">("WALK_IN");
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [composition, setComposition] = useState<GuestComposition>({ adults: 2, childrenUnder5: 0, children5to10: 0 });
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [selected, setSelected] = useState<Arrangement | null>(null);
  const [acModes, setAcModes] = useState<Array<"ac" | "non-ac">>([]);
  const [quoteToken, setQuoteToken] = useState<string | null>(null);
  const [subtotalPaise, setSubtotalPaise] = useState(0);
  const [collectedRupees, setCollectedRupees] = useState("0");
  const [contact, setContact] = useState({ fullName: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function search() {
    setError(null);
    setPending(true);
    try {
      const result = await adminSearchAvailability({ checkIn, checkOut, composition });
      setArrangements(result.arrangements);
      setSelected(null);
      setQuoteToken(null);
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : "Search failed.");
    } finally {
      setPending(false);
    }
  }

  async function quote(arrangement: Arrangement, modes: Array<"ac" | "non-ac">) {
    setError(null);
    setPending(true);
    try {
      const rooms = distributeGuests(composition, arrangement.rooms).map((room, index) => ({
        clientId: `${arrangement.id}-${index}`,
        roomGroupId: room.roomGroupId,
        acMode: modes[index] ?? "non-ac",
        composition: room.composition,
      }));
      const result = await adminQuote({ checkIn, checkOut, composition, rooms });
      setQuoteToken(result.quoteToken);
      setSubtotalPaise(result.price.subtotalPaise);
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : "Quote failed.");
    } finally {
      setPending(false);
    }
  }

  async function create() {
    if (!quoteToken) return;
    setError(null);
    setPending(true);
    try {
      const booking = await adminCreateBooking({
        source,
        quoteToken,
        contact,
        collectedPaise: Math.max(0, Math.round(Number(collectedRupees) * 100)),
      });
      router.push(`/admin/bookings/${booking.id}`);
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : "Could not create the booking.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <section className="rounded-[6px] border border-line bg-cream-raised p-4">
        <h2 className="text-sm font-medium">Source</h2>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant={source === "WALK_IN" ? "primary" : "secondary"} onClick={() => setSource("WALK_IN")}>
            Walk-in
          </Button>
          <Button type="button" variant={source === "PHONE" ? "primary" : "secondary"} onClick={() => setSource("PHONE")}>
            Phone
          </Button>
        </div>
      </section>
      <section className="grid gap-3 rounded-[6px] border border-line bg-cream-raised p-4 md:grid-cols-2">
        <Field id="checkIn" label="Check-in">
          <TextInput id="checkIn" type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} />
        </Field>
        <Field id="checkOut" label="Check-out">
          <TextInput id="checkOut" type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <GuestStepper value={composition} onChange={setComposition} />
        </div>
        <Button type="button" onClick={() => void search()} disabled={pending}>
          Check availability
        </Button>
      </section>
      {arrangements.length > 0 ? (
        <section className="rounded-[6px] border border-line bg-cream-raised p-4">
          <h2 className="text-sm font-medium">Arrangement</h2>
          <ul className="mt-3 space-y-2">
            {arrangements.map((arrangement) => (
              <li key={arrangement.id}>
                <button
                  type="button"
                  className="w-full rounded-[6px] border border-line px-3 py-3 text-left text-sm hover:border-lagoon-900"
                  onClick={() => {
                    setSelected(arrangement);
                    const modes = arrangement.rooms.map(() => "non-ac" as const);
                    setAcModes(modes);
                    void quote(arrangement, modes);
                  }}
                >
                  {arrangement.labels.join(" · ")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {selected ? (
        <section className="rounded-[6px] border border-line bg-cream-raised p-4">
          <h2 className="text-sm font-medium">Air-conditioning</h2>
          <ul className="mt-3 space-y-2">
            {selected.rooms.map((room, index) => (
              <li key={`${room.roomGroupId}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {room.roomGroupId === "single-bed" ? "Single-bed" : "Double-bed"} · {room.occupancy}{" "}
                  {room.occupancy === 1 ? "guest" : "guests"}
                </span>
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => {
                    const next = acModes.map((mode, modeIndex) => (modeIndex === index ? (mode === "ac" ? "non-ac" : "ac") : mode));
                    setAcModes(next);
                    void quote(selected, next);
                  }}
                >
                  {acModes[index] === "ac" ? "AC" : "Non-AC"}
                </button>
              </li>
            ))}
          </ul>
          {quoteToken ? <p className="mt-3 text-sm">Stay total {formatInrPaise(subtotalPaise)}</p> : null}
        </section>
      ) : null}
      <section className="grid gap-3 rounded-[6px] border border-line bg-cream-raised p-4">
        <h2 className="text-sm font-medium">Guest</h2>
        <Field id="fullName" label="Name">
          <TextInput id="fullName" value={contact.fullName} onChange={(event) => setContact({ ...contact, fullName: event.target.value })} required />
        </Field>
        <Field id="phone" label="Phone">
          <TextInput id="phone" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} required />
        </Field>
        <Field id="email" label="Email">
          <TextInput id="email" type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} required />
        </Field>
        <Field id="collected" label="Collected now (₹)">
          <TextInput id="collected" type="number" min={0} value={collectedRupees} onChange={(event) => setCollectedRupees(event.target.value)} />
        </Field>
        <Button type="button" onClick={() => void create()} disabled={!quoteToken || pending}>
          Confirm booking
        </Button>
      </section>
    </div>
  );
}
