import { z } from "zod";
import { bookingConfig } from "@/data/booking-config";
import { nightsBetween, todayIstDate } from "@/lib/dates";
import { last10Digits } from "@/lib/format";

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const compositionContract = z.object({
  adults: z.number().int().min(1).max(30),
  childrenUnder5: z.number().int().min(0).max(30),
  children5to10: z.number().int().min(0).max(30),
});

export const roomCompositionContract = z.object({
  adults: z.number().int().min(0).max(30),
  childrenUnder5: z.number().int().min(0).max(30),
  children5to10: z.number().int().min(0).max(30),
});

export const stayContract = z
  .object({
    checkIn: dateOnlySchema,
    checkOut: dateOnlySchema,
  })
  .superRefine((value, context) => {
    const nights = nightsBetween(value.checkIn, value.checkOut);
    if (value.checkIn < todayIstDate()) {
      context.addIssue({ code: "custom", path: ["checkIn"], message: "Check-in cannot be in the past." });
    }
    if (nights < bookingConfig.minNights || nights > bookingConfig.maxNights) {
      context.addIssue({ code: "custom", path: ["checkOut"], message: "Choose a stay from 1 to 30 nights." });
    }
  });

export const roomIntentContract = z.object({
  clientId: z.string().trim().min(1).max(80),
  roomGroupId: z.enum(["single-bed", "double-bed"]),
  acMode: z.enum(["ac", "non-ac"]),
  composition: roomCompositionContract,
});

export const availabilitySearchContract = stayContract.and(
  z.object({ composition: compositionContract }),
);

export const quoteRequestContract = stayContract.and(
  z.object({
    composition: compositionContract,
    rooms: z.array(roomIntentContract).min(1).max(7),
  }),
);

export const bookingContactContract = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .refine((value) => {
      const digits = last10Digits(value);
      return digits.length === 10 && /^[6-9]/.test(digits);
    }, "Enter a valid 10-digit Indian mobile number."),
  email: z.string().trim().email().max(254),
});

export const createHoldContract = z.object({
  quoteToken: z.string().min(32).max(16_000),
  contact: bookingContactContract,
});

export type CompositionInput = z.infer<typeof compositionContract>;
export type RoomIntentInput = z.infer<typeof roomIntentContract>;
export type QuoteRequestInput = z.infer<typeof quoteRequestContract>;
export type BookingContactInput = z.infer<typeof bookingContactContract>;

export interface RoomPriceDto {
  clientId: string;
  roomGroupId: "single-bed" | "double-bed";
  acMode: "ac" | "non-ac";
  composition: CompositionInput;
  physicalOccupancy: number;
  billingHalfUnits: number;
  tariffOccupancy: number;
  ratePerPersonPaise: number;
  nightlyTotalPaise: number;
  nights: number;
  stayTotalPaise: number;
}

export interface BookingPriceDto {
  rooms: RoomPriceDto[];
  nights: number;
  subtotalPaise: number;
  advanceBasisPoints: number;
  advancePaise: number;
  balancePaise: number;
  currency: "INR";
}
