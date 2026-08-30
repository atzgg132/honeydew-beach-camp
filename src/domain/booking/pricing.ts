import type { BookingPriceDto, QuoteRequestInput, RoomPriceDto } from "@/contracts/booking";
import { nightsBetween } from "@/lib/dates";

export interface TariffRateValue {
  roomGroupId: string;
  tariffOccupancy: number;
  acMode: "ac" | "non-ac";
  ratePerPersonPaise: number;
}

export function physicalOccupancy(composition: QuoteRequestInput["composition"]): number {
  return composition.adults + composition.childrenUnder5 + composition.children5to10;
}

export function billingHalfUnits(composition: QuoteRequestInput["composition"]): number {
  return composition.adults * 2 + composition.children5to10;
}

export function tariffOccupancy(roomGroupId: string, occupancy: number): number {
  if (roomGroupId === "single-bed" && occupancy >= 1 && occupancy <= 2) return 2;
  if (roomGroupId === "single-bed" && occupancy === 3) return 3;
  if (roomGroupId === "double-bed" && occupancy >= 4 && occupancy <= 6) return occupancy;
  throw new Error("INVALID_ROOM_OCCUPANCY");
}

export function roundBasisPoints(amountPaise: number, basisPoints: number): number {
  return Math.floor((amountPaise * basisPoints + 5_000) / 10_000);
}

export function priceBookingPaise(
  input: QuoteRequestInput,
  rates: TariffRateValue[],
  advanceBasisPoints: number,
): BookingPriceDto {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  if (nights < 1) throw new Error("INVALID_STAY");

  const rooms: RoomPriceDto[] = input.rooms.map((room) => {
    const physical = physicalOccupancy(room.composition);
    const tier = tariffOccupancy(room.roomGroupId, physical);
    const rate = rates.find(
      (candidate) =>
        candidate.roomGroupId === room.roomGroupId &&
        candidate.tariffOccupancy === tier &&
        candidate.acMode === room.acMode,
    );
    if (!rate) throw new Error("TARIFF_NOT_CONFIGURED");
    if (rate.ratePerPersonPaise % 2 !== 0) throw new Error("INVALID_TARIFF_PRECISION");
    const halfUnits = billingHalfUnits(room.composition);
    const nightlyTotalPaise = (rate.ratePerPersonPaise * halfUnits) / 2;
    return {
      clientId: room.clientId,
      roomGroupId: room.roomGroupId,
      acMode: room.acMode,
      composition: room.composition,
      physicalOccupancy: physical,
      billingHalfUnits: halfUnits,
      tariffOccupancy: tier,
      ratePerPersonPaise: rate.ratePerPersonPaise,
      nightlyTotalPaise,
      nights,
      stayTotalPaise: nightlyTotalPaise * nights,
    };
  });

  const subtotalPaise = rooms.reduce((sum, room) => sum + room.stayTotalPaise, 0);
  const advancePaise = roundBasisPoints(subtotalPaise, advanceBasisPoints);
  return {
    rooms,
    nights,
    subtotalPaise,
    advanceBasisPoints,
    advancePaise,
    balancePaise: subtotalPaise - advancePaise,
    currency: "INR",
  };
}
