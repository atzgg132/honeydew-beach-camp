import { z } from "zod";
import { bookingConfig } from "@/data/booking-config";
import { nightsBetween, todayIstDate } from "@/lib/dates";
import { last10Digits } from "@/lib/format";

export const compositionSchema = z
  .object({
    adults: z.number().int().min(1).max(30),
    childrenUnder5: z.number().int().min(0).max(30),
    children5to10: z.number().int().min(0).max(30),
  })
  .superRefine((value, ctx) => {
    const total = value.adults + value.childrenUnder5 + value.children5to10;
    if (total < 1) {
      ctx.addIssue({ code: "custom", message: "Add at least one guest." });
    }
  });

export const searchSchema = z
  .object({
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a check-in date."),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a check-out date."),
    composition: compositionSchema,
  })
  .superRefine((value, ctx) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(value.checkOut)) {
      return;
    }
    const today = todayIstDate();
    if (value.checkIn < today) {
      ctx.addIssue({
        code: "custom",
        path: ["checkIn"],
        message: "Check-in cannot be in the past.",
      });
    }
    const nights = nightsBetween(value.checkIn, value.checkOut);
    if (nights < bookingConfig.minNights) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOut"],
        message: "Check-out must be after check-in.",
      });
    }
    if (nights > bookingConfig.maxNights) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOut"],
        message: `Stays are limited to ${bookingConfig.maxNights} nights online.`,
      });
    }
  });

export const guestSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(80),
  phone: z
    .string()
    .trim()
    .refine((value) => last10Digits(value).length === 10 && /^[6-9]/.test(last10Digits(value)), {
      message: "Enter a valid 10-digit Indian mobile number.",
    }),
  email: z.string().trim().email("Enter a valid email address."),
});

export const lookupSchema = z.object({
  reference: z.string().trim().min(4, "Enter the booking reference."),
  phone: z
    .string()
    .trim()
    .refine((value) => last10Digits(value).length === 10, {
      message: "Enter the phone number used for the booking.",
    }),
});

export const contactSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name."),
    phone: z.string().trim(),
    email: z.string().trim(),
    message: z.string().trim().min(10, "Write a short message.").max(1000),
  })
  .superRefine((value, ctx) => {
    const hasPhone = last10Digits(value.phone).length === 10;
    const hasEmail = Boolean(value.email && z.string().email().safeParse(value.email).success);
    if (!hasPhone && !hasEmail) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Leave a phone number or an email so the camp can reply.",
      });
    }
  });
