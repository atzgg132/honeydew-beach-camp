import "server-only";
import { Prisma, RefundStatus } from "@prisma/client";
import { ApiError } from "@/contracts/errors";
import { todayIstDate } from "@/lib/dates";
import type { Booking } from "@/types";

export const customerBookingInclude = {
  rooms: { orderBy: { displayOrder: "asc" as const } },
  cancellation: true,
} satisfies Prisma.BookingInclude;

type CustomerBookingRecord = Prisma.BookingGetPayload<{ include: typeof customerBookingInclude }>;

const rupees = (paise: number) => paise / 100;
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

export function toCustomerBooking(record: CustomerBookingRecord): Booking {
  const checkOut = dateOnly(record.checkOut);

  // The customer-facing Booking shape can only express a settled stay. A booking still
  // awaiting payment, or one that expired unpaid, previously fell through to "confirmed",
  // which would have shown a guest a stay they do not have. Callers gate on status before
  // reaching here; if one ever stops doing so, fail loudly rather than lie.
  if (record.status !== "CONFIRMED" && record.status !== "CANCELLED") {
    throw new ApiError(
      409,
      "INVALID_STATE",
      "This booking is not confirmed yet.",
    );
  }

  const displayStatus: Booking["status"] =
    record.status === "CANCELLED"
      ? "cancelled"
      : checkOut <= todayIstDate()
        ? "completed"
        : "confirmed";
  const paymentStatus: Booking["paymentStatus"] = record.cancellation
    ? record.cancellation.refundStatus === RefundStatus.PROCESSED
      ? "refunded"
      : "refund_pending_hotel"
    : "balance_due_at_hotel";

  const pricingRooms = record.rooms.map((room) => ({
    roomGroupId: room.roomGroupId as Booking["rooms"][number]["roomGroupId"],
    acMode: (room.acMode === "AC" ? "ac" : "non-ac") as Booking["rooms"][number]["acMode"],
    physicalOccupancy: room.physicalOccupancy,
    tariffOccupancy: room.tariffOccupancy,
    composition: {
      adults: room.adults,
      childrenUnder5: room.childrenUnder5,
      children5to10: room.children5To10,
    },
    tariffPerPerson: rupees(room.ratePerPersonPaise),
    billableUnits: room.billingHalfUnits / 2,
    nightlyTotal: rupees(room.nightlyTotalPaise),
    nights: room.nights,
    stayTotal: rupees(room.stayTotalPaise),
  }));

  return {
    id: record.id,
    reference: record.reference ?? "",
    isDemo: false,
    status: displayStatus,
    paymentStatus,
    checkIn: dateOnly(record.checkIn),
    checkOut,
    composition: {
      adults: record.adults,
      childrenUnder5: record.childrenUnder5,
      children5to10: record.children5To10,
    },
    contact: {
      fullName: record.contactFullName,
      phone: record.contactPhoneE164,
      email: record.contactEmail,
    },
    rooms: record.rooms.map((room, index) => ({
      id: room.id,
      roomGroupId: room.roomGroupId as Booking["rooms"][number]["roomGroupId"],
      acMode: room.acMode === "AC" ? "ac" : "non-ac",
      composition: pricingRooms[index].composition,
      physicalOccupancy: room.physicalOccupancy,
      tariffOccupancy: room.tariffOccupancy,
      assignedPhysicalRoomNumber: null,
      pricing: pricingRooms[index],
    })),
    pricing: {
      rooms: pricingRooms,
      nights: record.nights,
      subtotal: rupees(record.subtotalPaise),
      advancePercent: record.advanceBasisPoints / 100,
      advance: rupees(record.advanceDuePaise),
      balance: rupees(record.outstandingPaise),
    },
    advancePaid: rupees(record.advancePaidPaise),
    outstanding: rupees(record.outstandingPaise),
    ...(record.cancellation
      ? {
          cancellationQuote: {
            slab: {
              id: record.cancellation.slabId,
              maxHoursBeforeCheckIn: null,
              deductionPercent: record.cancellation.deductionBasisPoints / 100,
              label: record.cancellation.slabLabel,
              explanation: "Any refund is reviewed and processed by Honey Dew Beach Camp.",
            },
            hoursUntilCheckIn: Number(record.cancellation.hoursUntilCheckIn),
            advancePaid: rupees(record.cancellation.advancePaidPaise),
            deductionPercent: record.cancellation.deductionBasisPoints / 100,
            charge: rupees(record.cancellation.deductionPaise),
            refundable: rupees(record.cancellation.refundablePaise),
            refundControlledByHotel: true as const,
          },
        }
      : {}),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
