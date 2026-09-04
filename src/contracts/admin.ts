import { z } from "zod";
import { bookingContactContract, compositionContract, dateOnlySchema, roomIntentContract } from "@/contracts/booking";
import { tariffTable } from "@/data/tariff-table";

export const adminLoginContract = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

export const adminAcceptContract = z.object({
  token: z.string().trim().min(16).max(200),
  password: z.string().min(12).max(200),
});

export const adminInviteContract = z.object({
  email: z.string().trim().email().max(254),
});

export const adminQuoteContract = z.object({
  checkIn: dateOnlySchema,
  checkOut: dateOnlySchema,
  composition: compositionContract,
  rooms: z.array(roomIntentContract).min(1).max(7),
});

export const adminCreateBookingContract = z.object({
  source: z.enum(["PHONE", "WALK_IN"]),
  quoteToken: z.string().min(32).max(16_000),
  contact: bookingContactContract,
  collectedPaise: z.number().int().min(0),
});

export const adminGuestChangeContract = z.object({
  composition: compositionContract,
});

export const adminQuoteTokenContract = z.object({
  quoteToken: z.string().min(32).max(16_000),
});

export const adminReassignContract = z.object({
  roomId: z.string().uuid(),
});

export const adminCollectionContract = z.object({
  amountPaise: z.number().int().positive(),
  note: z.string().trim().max(280).optional(),
});

export const adminUnallocatedNoteContract = z.object({
  note: z.string().trim().min(2).max(280),
});

export const adminRefundActionContract = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject") }),
  z.object({
    action: z.literal("process"),
    actualRefundPaise: z.number().int().min(0),
    reference: z.string().trim().max(80).optional(),
  }),
]);

export const adminRoomBlockContract = z.object({
  roomId: z.string().uuid(),
  checkIn: dateOnlySchema,
  checkOut: dateOnlySchema,
  reason: z.string().trim().min(2).max(200),
});

export const adminTariffRevisionContract = z.object({
  rates: z
    .array(
      z.object({
        roomGroupId: z.enum(["single-bed", "double-bed"]),
        tariffOccupancy: z.number().int(),
        acMode: z.enum(["ac", "non-ac"]),
        ratePerPersonPaise: z.number().int().positive(),
      }),
    )
    .length(tariffTable.length),
});

export const adminPolicyRevisionContract = z.object({
  advancePercent: z.number().int().min(0).max(100),
});

export type AdminLoginInput = z.infer<typeof adminLoginContract>;
export type AdminAcceptInput = z.infer<typeof adminAcceptContract>;
export type AdminCreateBookingInput = z.infer<typeof adminCreateBookingContract>;
