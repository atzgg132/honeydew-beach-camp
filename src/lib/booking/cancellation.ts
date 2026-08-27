import { hotel } from "@/data/hotel";
import { cancellationSlabs } from "@/data/policies";
import { hoursUntilIst } from "@/lib/dates";
import { roundRupee } from "@/lib/booking/pricing";
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
  const charge = roundRupee((input.advancePaid * slab.deductionPercent) / 100);
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
