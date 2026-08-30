import { z } from "zod";
import { bookingContactContract, compositionContract } from "@/contracts/booking";

export const verifyManageBookingContract = z.object({
  reference: z.string().trim().min(8).max(40),
  phone: z.string().trim().min(10).max(30),
});

export const updateContactContract = bookingContactContract;
export const guestChangeQuoteContract = z.object({ composition: compositionContract });
export const mutationQuoteContract = z.object({ quoteToken: z.string().min(32).max(16_000) });
