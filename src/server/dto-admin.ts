import "server-only";
import { Prisma, type BookingSource, type BookingStatus, type PaymentOrderStatus, type RefundStatus } from "@prisma/client";
import { ApiError } from "@/contracts/errors";
import { todayIstDate } from "@/lib/dates";

export const staffBookingInclude = {
  rooms: {
    orderBy: { displayOrder: "asc" as const },
    include: {
      reservations: {
        where: { state: { in: ["HELD", "CONFIRMED"] } },
        include: { room: { select: { id: true, roomNumber: true, roomGroupId: true, supportsAc: true } } },
      },
    },
  },
  cancellation: true,
  payments: { orderBy: { createdAt: "asc" as const }, include: { transactions: true } },
  events: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.BookingInclude;

export type StaffBookingRecord = Prisma.BookingGetPayload<{ include: typeof staffBookingInclude }>;

export type StaffBookingStatus = "pending_payment" | "confirmed" | "completed" | "cancelled" | "expired";
export type StaffPaymentView =
  | "balance_due_at_hotel"
  | "settled"
  | "refund_pending_hotel"
  | "refunded"
  | "paid_unallocated";

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function staffStatus(record: { status: BookingStatus; checkOut: Date }): StaffBookingStatus {
  if (record.status === "CANCELLED") return "cancelled";
  if (record.status === "PENDING_PAYMENT") return "pending_payment";
  if (record.status === "EXPIRED") return "expired";
  if (dateOnly(record.checkOut) <= todayIstDate()) return "completed";
  return "confirmed";
}

export function staffPaymentView(record: {
  status: BookingStatus;
  outstandingPaise: number;
  cancellation: { refundStatus: RefundStatus } | null;
  payments: Array<{ status: PaymentOrderStatus }>;
}): StaffPaymentView {
  if (record.cancellation) {
    return record.cancellation.refundStatus === "PROCESSED" ? "refunded" : "refund_pending_hotel";
  }
  if (record.payments.some((payment) => payment.status === "PAID_UNALLOCATED")) return "paid_unallocated";
  if (record.status === "CONFIRMED" && record.outstandingPaise <= 0) return "settled";
  return "balance_due_at_hotel";
}

function assignedNumbers(record: StaffBookingRecord) {
  return record.rooms.flatMap((room) =>
    room.reservations.map((reservation) => reservation.room.roomNumber),
  );
}

export function toStaffBookingListItem(record: StaffBookingRecord) {
  return {
    id: record.id,
    reference: record.reference,
    source: record.source,
    status: staffStatus(record),
    rawStatus: record.status,
    paymentView: staffPaymentView(record),
    contactName: record.contactFullName,
    contactPhone: record.contactPhoneE164,
    contactEmail: record.contactEmail,
    checkIn: dateOnly(record.checkIn),
    checkOut: dateOnly(record.checkOut),
    nights: record.nights,
    assignedRooms: assignedNumbers(record),
    roomGroups: record.rooms.map((room) => room.roomGroupNameSnapshot),
    subtotalPaise: record.subtotalPaise,
    outstandingPaise: record.outstandingPaise,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toStaffBooking(record: StaffBookingRecord) {
  if (!record) throw new ApiError(404, "NOT_FOUND", "The booking was not found.");
  return {
    id: record.id,
    reference: record.reference,
    source: record.source,
    status: staffStatus(record),
    rawStatus: record.status,
    paymentView: staffPaymentView(record),
    checkIn: dateOnly(record.checkIn),
    checkOut: dateOnly(record.checkOut),
    holdExpiresAt: record.holdExpiresAt?.toISOString() ?? null,
    contact: {
      fullName: record.contactFullName,
      phone: record.contactPhoneE164,
      email: record.contactEmail,
    },
    composition: {
      adults: record.adults,
      childrenUnder5: record.childrenUnder5,
      children5to10: record.children5To10,
    },
    nights: record.nights,
    currency: record.currency,
    tariffRevisionId: record.tariffRevisionId,
    policyRevisionId: record.policyRevisionId,
    subtotalPaise: record.subtotalPaise,
    advanceBasisPoints: record.advanceBasisPoints,
    advanceDuePaise: record.advanceDuePaise,
    advancePaidPaise: record.advancePaidPaise,
    outstandingPaise: record.outstandingPaise,
    rooms: record.rooms.map((room) => {
      const reservation = room.reservations[0] ?? null;
      const acMode: "ac" | "non-ac" = room.acMode === "AC" ? "ac" : "non-ac";
      const reservationState =
        reservation?.state === "HELD" || reservation?.state === "CONFIRMED" ? reservation.state : null;
      return {
        id: room.id,
        roomGroupId: room.roomGroupId,
        roomGroupName: room.roomGroupNameSnapshot,
        acMode,
        composition: {
          adults: room.adults,
          childrenUnder5: room.childrenUnder5,
          children5to10: room.children5To10,
        },
        physicalOccupancy: room.physicalOccupancy,
        tariffOccupancy: room.tariffOccupancy,
        ratePerPersonPaise: room.ratePerPersonPaise,
        nightlyTotalPaise: room.nightlyTotalPaise,
        stayTotalPaise: room.stayTotalPaise,
        assignedPhysicalRoomNumber: reservation?.room.roomNumber ?? null,
        assignedRoomId: reservation?.room.id ?? null,
        reservationId: reservation?.id ?? null,
        reservationState,
      };
    }),
    payments: record.payments.map((order) => ({
      id: order.id,
      provider: order.provider,
      status: order.status,
      amountPaise: order.amountPaise,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
    })),
    cancellation: record.cancellation
      ? {
          id: record.cancellation.id,
          policyVersion: record.cancellation.policyVersion,
          slabId: record.cancellation.slabId,
          slabLabel: record.cancellation.slabLabel,
          hoursUntilCheckIn: Number(record.cancellation.hoursUntilCheckIn),
          advancePaidPaise: record.cancellation.advancePaidPaise,
          deductionBasisPoints: record.cancellation.deductionBasisPoints,
          deductionPaise: record.cancellation.deductionPaise,
          refundablePaise: record.cancellation.refundablePaise,
          refundStatus: record.cancellation.refundStatus,
          actualRefundPaise: record.cancellation.actualRefundPaise,
          providerRefundReference: record.cancellation.providerRefundReference,
          cancelledAt: record.cancellation.cancelledAt.toISOString(),
          approvedAt: record.cancellation.approvedAt?.toISOString() ?? null,
          processedAt: record.cancellation.processedAt?.toISOString() ?? null,
        }
      : null,
    events: record.events.map((event) => ({
      id: event.id,
      type: event.type,
      actorType: event.actorType,
      actorId: event.actorId,
      deltaPaise: event.deltaPaise,
      data: event.data,
      createdAt: event.createdAt.toISOString(),
    })),
    createdAt: record.createdAt.toISOString(),
    confirmedAt: record.confirmedAt?.toISOString() ?? null,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export type StaffBooking = ReturnType<typeof toStaffBooking>;
export type StaffBookingListItem = ReturnType<typeof toStaffBookingListItem>;
export type StaffBookingSource = BookingSource;
