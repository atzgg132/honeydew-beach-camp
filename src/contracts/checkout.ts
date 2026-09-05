import { z } from "zod";
import type { BookingPriceDto, CompositionInput, RoomIntentInput } from "@/contracts/booking";

export const idempotencyKeyContract = z.string().trim().min(8).max(200);

export const quoteTokenPayloadContract = z.object({
  purpose: z.literal("booking-quote"),
  checkIn: z.string(),
  checkOut: z.string(),
  composition: z.object({
    adults: z.number().int(),
    childrenUnder5: z.number().int(),
    children5to10: z.number().int(),
  }),
  rooms: z.array(
    z.object({
      clientId: z.string(),
      roomGroupId: z.enum(["single-bed", "double-bed"]),
      acMode: z.enum(["ac", "non-ac"]),
      composition: z.object({
        adults: z.number().int(),
        childrenUnder5: z.number().int(),
        children5to10: z.number().int(),
      }),
    }),
  ),
  tariffRevisionId: z.string().uuid(),
  policyRevisionId: z.string().uuid(),
  subtotalPaise: z.number().int().nonnegative(),
  advancePaise: z.number().int().nonnegative(),
  issuedAt: z.number().int(),
  expiresAt: z.number().int(),
});

export interface QuoteTokenPayload {
  purpose: "booking-quote";
  checkIn: string;
  checkOut: string;
  composition: CompositionInput;
  rooms: RoomIntentInput[];
  tariffRevisionId: string;
  policyRevisionId: string;
  subtotalPaise: number;
  advancePaise: number;
  issuedAt: number;
  expiresAt: number;
}

export interface QuoteResponseDto {
  price: BookingPriceDto;
  quoteToken: string;
  expiresAt: string;
  tariffRevision: number;
  policyRevision: number;
  paymentReady: boolean;
}

export const razorpayCheckoutResponseContract = z.object({
  razorpay_payment_id: z.string().trim().min(1).max(64),
  razorpay_order_id: z.string().trim().min(1).max(64),
  razorpay_signature: z.string().trim().min(1).max(128),
});

export type RazorpayCheckoutResponse = z.infer<typeof razorpayCheckoutResponseContract>;

export interface PaymentOrderDto {
  orderId: string;
  provider: string;
  amountPaise: number;
  currency: string;
  expiresAt: string;
  clientData: Record<string, string>;
}
