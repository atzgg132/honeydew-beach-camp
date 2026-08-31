import { hotel } from "@/data/hotel";
import { cancellationSlabs } from "@/data/policies";
import { roundBasisPoints } from "@/domain/booking/pricing";
import { hoursUntilIst } from "@/lib/dates";
import type { CancellationQuote, CancellationSlab } from "@/types";

export function slabForHours(hoursUntilCheckIn: number): CancellationSlab {
  for (const slab of cancellationSlabs) {
    if (slab.maxHoursBeforeCheckIn === null) continue;
    if (hoursUntilCheckIn <= slab.maxHoursBeforeCheckIn) return slab;
  }
  return cancellationSlabs[cancellationSlabs.length - 1];
}

export function quoteCancellation(input: {
  checkIn: string;
  advancePaid: number;
  now?: Date;
  checkInTime?: string;
}): CancellationQuote {
  const hours = hoursUntilIst(
    input.checkIn,
    input.checkInTime ?? hotel.checkInTime,
    input.now ?? new Date(),
  );
  const slab = slabForHours(hours);
  // Mirrors the server exactly: basis points applied to integer paise. Rounding to whole
  // rupees here would quote the guest a refund the hotel is not going to pay.
  const advancePaise = Math.round(input.advancePaid * 100);
  const charge = roundBasisPoints(advancePaise, slab.deductionPercent * 100) / 100;
  const refundable = Math.max(0, input.advancePaid - charge);

  return {
    slab,
    hoursUntilCheckIn: hours,
    advancePaid: input.advancePaid,
    deductionPercent: slab.deductionPercent,
    charge,
    refundable,
    refundControlledByHotel: true,
  };
}
