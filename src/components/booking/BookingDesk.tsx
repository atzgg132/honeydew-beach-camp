"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { GuestStepper } from "@/components/booking/GuestStepper";
import { addDays, todayIstDate } from "@/lib/dates";
import { bookingHref } from "@/lib/booking/query";
import { guestCountLabel, physicalOccupancy } from "@/lib/booking/occupancy";
import { searchSchema } from "@/lib/booking/validation";
import type { GuestComposition } from "@/types";
import { cn } from "@/lib/cn";

export function BookingDesk({
  tone = "cream",
  defaultCheckIn,
  defaultCheckOut,
  defaultComposition,
}: {
  tone?: "cream" | "on-dark";
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultComposition?: GuestComposition;
}) {
  const router = useRouter();
  const today = todayIstDate();
  const [checkIn, setCheckIn] = useState(defaultCheckIn ?? today);
  const [checkOut, setCheckOut] = useState(defaultCheckOut ?? addDays(today, 1));
  const [composition, setComposition] = useState<GuestComposition>(
    defaultComposition ?? { adults: 2, childrenUnder5: 0, children5to10: 0 },
  );
  const [openGuests, setOpenGuests] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const occupancy = physicalOccupancy(composition);
  const guestLabel = useMemo(() => {
    const bits = [`${composition.adults} adult${composition.adults === 1 ? "" : "s"}`];
    const children = composition.childrenUnder5 + composition.children5to10;
    if (children) bits.push(`${children} child${children === 1 ? "" : "ren"}`);
    return bits.join(", ");
  }, [composition]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = searchSchema.safeParse({ checkIn, checkOut, composition });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the dates and guests.");
      return;
    }
    setError(null);
    router.push(bookingHref({ checkIn, checkOut, composition, step: "arrangement" }));
  }

  const fieldClass =
    "h-7 w-full min-w-0 bg-transparent text-base leading-7 text-ink outline-none";
  const fieldShell =
    "flex min-h-[4.75rem] flex-col justify-center gap-1 border-b border-line px-4 py-3 md:border-b-0 md:border-r md:border-line";

  return (
    <form
      id="booking-desk"
      onSubmit={submit}
      className={cn(
        "grid rounded-[6px] bg-cream text-ink md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_auto] md:items-stretch",
        tone === "cream" ? "border border-line md:border-0" : "",
      )}
    >
      <label className={fieldShell}>
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink/60">
          Check-in
        </span>
        <input
          type="date"
          min={today}
          value={checkIn}
          onChange={(event) => {
            const next = event.target.value;
            setCheckIn(next);
            if (checkOut <= next) setCheckOut(addDays(next, 1));
          }}
          className={fieldClass}
          required
        />
      </label>
      <label className={fieldShell}>
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink/60">
          Check-out
        </span>
        <input
          type="date"
          min={addDays(checkIn, 1)}
          value={checkOut}
          onChange={(event) => setCheckOut(event.target.value)}
          className={fieldClass}
          required
        />
      </label>
      <div className="relative flex md:border-r md:border-line">
        <button
          type="button"
          className={cn(fieldShell, "w-full border-b text-left md:border-b-0 md:border-r-0")}
          onClick={() => setOpenGuests((value) => !value)}
          aria-expanded={openGuests}
        >
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink/60">
            Guests
          </span>
          <span className="flex h-7 items-center text-base leading-7">{guestLabel}</span>
        </button>
        {openGuests ? (
          <div className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-[6px] border border-line bg-cream p-4 shadow-[0_12px_40px_rgb(14_74_77/0.12)] md:bottom-auto md:top-full md:mb-0 md:mt-2">
            <GuestStepper value={composition} onChange={setComposition} />
            <p className="pt-2 text-xs text-ink/60">{guestCountLabel(occupancy)} in total</p>
          </div>
        ) : null}
      </div>
      <div className="flex items-stretch p-3 md:p-2">
        <Button type="submit" className="h-full min-h-12 w-full md:min-w-36">
          Search
        </Button>
      </div>
      {error ? (
        <p className="px-4 pb-3 text-sm text-danger md:col-span-4" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
