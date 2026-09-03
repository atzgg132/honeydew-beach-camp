import "server-only";
import { Prisma, type BookingSource } from "@prisma/client";
import type { BookingContactInput, BookingPriceDto, CompositionInput } from "@/contracts/booking";
import { last10Digits } from "@/lib/format";
import { phoneLookupHash } from "@/server/crypto";
import type { LockedRoom } from "@/server/services/allocation";

export function normalizePhoneE164(phone: string) {
  return `+91${last10Digits(phone)}`;
}

export function roomGroupIdOf(value: string): "single-bed" | "double-bed" {
  if (value === "single-bed" || value === "double-bed") return value;
  throw new Error(`Unrecognised room group ${value}`);
}

export function bookingRoomCreateData(price: BookingPriceDto, groupNames: Map<string, string>, roomIds: string[]) {
  return price.rooms.map((room, index) => ({
    id: roomIds[index],
    roomGroupId: room.roomGroupId,
    roomGroupNameSnapshot: groupNames.get(room.roomGroupId) ?? room.roomGroupId,
    displayOrder: index,
    acMode: room.acMode === "ac" ? ("AC" as const) : ("NON_AC" as const),
    adults: room.composition.adults,
    childrenUnder5: room.composition.childrenUnder5,
    children5To10: room.composition.children5to10,
    physicalOccupancy: room.physicalOccupancy,
    billingHalfUnits: room.billingHalfUnits,
    tariffOccupancy: room.tariffOccupancy,
    ratePerPersonPaise: room.ratePerPersonPaise,
    nightlyTotalPaise: room.nightlyTotalPaise,
    nights: room.nights,
    stayTotalPaise: room.stayTotalPaise,
  }));
}

export function contactFields(contact: BookingContactInput) {
  const phone = normalizePhoneE164(contact.phone);
  return {
    contactFullName: contact.fullName,
    contactPhoneE164: phone,
    contactPhoneLookupHash: phoneLookupHash(phone),
    contactEmail: contact.email.toLowerCase(),
  };
}

export function reservationRows(input: {
  roomIds: string[];
  assigned: LockedRoom[];
  checkIn: Date;
  checkOut: Date;
  state: "HELD" | "CONFIRMED";
  expiresAt?: Date;
}) {
  return input.roomIds.map((bookingRoomId, index) => ({
    roomId: input.assigned[index].id,
    bookingRoomId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    state: input.state,
    expiresAt: input.expiresAt ?? null,
  }));
}

export function bookingMoneyFields(
  price: BookingPriceDto,
  composition: CompositionInput,
  extra: {
    source: BookingSource;
    status: "PENDING_PAYMENT" | "CONFIRMED";
    tariffRevisionId: string;
    policyRevisionId: string;
    checkIn: Date;
    checkOut: Date;
    holdExpiresAt?: Date | null;
    reference?: string | null;
    advancePaidPaise?: number;
    outstandingPaise: number;
  },
) {
  return {
    source: extra.source,
    status: extra.status,
    checkIn: extra.checkIn,
    checkOut: extra.checkOut,
    holdExpiresAt: extra.holdExpiresAt ?? null,
    reference: extra.reference ?? null,
    adults: composition.adults,
    childrenUnder5: composition.childrenUnder5,
    children5To10: composition.children5to10,
    currency: "INR" as const,
    tariffRevisionId: extra.tariffRevisionId,
    policyRevisionId: extra.policyRevisionId,
    nights: price.nights,
    subtotalPaise: price.subtotalPaise,
    advanceBasisPoints: price.advanceBasisPoints,
    advanceDuePaise: price.advancePaise,
    advancePaidPaise: extra.advancePaidPaise ?? 0,
    outstandingPaise: extra.outstandingPaise,
  };
}

export async function lockBooking(transaction: Prisma.TransactionClient, bookingId: string) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "Booking" WHERE "id" = ${bookingId}::uuid FOR UPDATE
  `);
  return rows[0] ?? null;
}
