import type { GuestComposition } from "@/types";

export interface BookingQuery {
  checkIn?: string;
  checkOut?: string;
  composition: GuestComposition;
  step?: string;
}

export function parseComposition(search: URLSearchParams): GuestComposition {
  const num = (key: string, fallback: number) => {
    const raw = search.get(key);
    if (raw === null || raw === "") return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  return {
    adults: Math.max(1, num("adults", 2)),
    childrenUnder5: num("childrenUnder5", 0),
    children5to10: num("children5to10", 0),
  };
}

export function bookingHref(input: {
  checkIn?: string;
  checkOut?: string;
  composition?: GuestComposition;
  step?: string;
}): string {
  const params = new URLSearchParams();
  if (input.checkIn) params.set("checkIn", input.checkIn);
  if (input.checkOut) params.set("checkOut", input.checkOut);
  const composition = input.composition ?? { adults: 2, childrenUnder5: 0, children5to10: 0 };
  params.set("adults", String(composition.adults));
  params.set("childrenUnder5", String(composition.childrenUnder5));
  params.set("children5to10", String(composition.children5to10));
  if (input.step) params.set("step", input.step);
  const qs = params.toString();
  return qs ? `/book?${qs}` : "/book";
}
