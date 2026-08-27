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
    "h-11 w-full bg-transparent text-base text-inherit outline-none sm:h-12";

  return (
    <form
      id="booking-desk"
      onSubmit={submit}
      className={cn(
        "grid gap-3 rounded-[6px] p-3 md:grid-cols-[1.1fr_1.1fr_1.2fr_auto] md:items-end md:gap-0 md:p-0",
        tone === "cream"
          ? "border border-line bg-cream text-ink md:border-0 md:bg-cream"
          : "bg-cream text-ink",
      )}
    >
      <label className="flex flex-col gap-1 border-b border-line px-4 py-2.5 sm:py-3 md:border-b-0 md:border-r">
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
      <label className="flex flex-col gap-1 border-b border-line px-4 py-2.5 sm:py-3 md:border-b-0 md:border-r">
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
      <div className="relative border-b border-line px-4 py-2.5 sm:py-3 md:border-b-0 md:border-r">
        <button
          type="button"
          className="flex w-full min-h-11 flex-col items-start gap-1 text-left"
          onClick={() => setOpenGuests((value) => !value)}
          aria-expanded={openGuests}
        >
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink/60">
            Guests
          </span>
          <span className="text-base">{guestLabel}</span>
        </button>
        {openGuests ? (
          <div className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-[6px] border border-line bg-cream p-4 shadow-[0_12px_40px_rgb(14_74_77/0.12)] md:bottom-auto md:top-full md:mb-0 md:mt-2">
            <GuestStepper value={composition} onChange={setComposition} />
            <p className="pt-2 text-xs text-ink/60">{guestCountLabel(occupancy)} in total</p>
          </div>
        ) : null}
      </div>
      <div className="p-2 md:p-2">
        <Button type="submit" className="w-full min-h-11 sm:min-h-12 md:min-w-36">
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
