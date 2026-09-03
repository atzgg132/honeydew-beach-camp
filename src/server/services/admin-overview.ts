import "server-only";
import { todayIstDate } from "@/lib/dates";
import { db } from "@/server/db/client";
import { staffBookingInclude, toStaffBookingListItem } from "@/server/dto-admin";
import { dateOnlyToUtc } from "@/server/services/availability-service";

function dayRange(date: string) {
  const start = dateOnlyToUtc(date);
  const end = dateOnlyToUtc(date);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function getAdminOverview() {
  const today = todayIstDate();
  const { start: todayStart, end: tomorrow } = dayRange(today);
  const weekEnd = dateOnlyToUtc(today);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const prisma = db();
  const include = staffBookingInclude;

  const [arrivals, departures, inHouse, upcoming, recent, refunds, balances, unallocated, liveHolds, activeBlocks] =
    await Promise.all([
      prisma.booking.findMany({
        where: { status: "CONFIRMED", checkIn: todayStart },
        include,
        orderBy: { contactFullName: "asc" },
      }),
      prisma.booking.findMany({
        where: { status: "CONFIRMED", checkOut: todayStart },
        include,
        orderBy: { contactFullName: "asc" },
      }),
      prisma.booking.findMany({
        where: { status: "CONFIRMED", checkIn: { lte: todayStart }, checkOut: { gt: todayStart } },
        include,
        orderBy: { contactFullName: "asc" },
      }),
      prisma.booking.findMany({
        where: { status: "CONFIRMED", checkIn: { gt: todayStart, lt: weekEnd } },
        include,
        orderBy: { checkIn: "asc" },
        take: 12,
      }),
      prisma.booking.findMany({
        include,
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.cancellation.findMany({
        where: { refundStatus: "PENDING_HOTEL_REVIEW" },
        include: { booking: { include } },
        orderBy: { cancelledAt: "asc" },
      }),
      prisma.booking.findMany({
        where: { status: "CONFIRMED", outstandingPaise: { gt: 0 } },
        include,
        orderBy: { checkIn: "asc" },
      }),
      prisma.paymentOrder.findMany({
        where: { status: "PAID_UNALLOCATED" },
        include: { booking: { include } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.booking.findMany({
        where: { status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } },
        include,
        orderBy: { holdExpiresAt: "asc" },
      }),
      prisma.roomBlock.findMany({
        where: {
          active: true,
          reservation: {
            is: {
              state: { in: ["HELD", "CONFIRMED"] },
              checkIn: { lt: tomorrow },
              checkOut: { gt: todayStart },
            },
          },
        },
        include: { reservation: { include: { room: true } } },
      }),
    ]);

  return {
    today,
    arriving: arrivals.map(toStaffBookingListItem),
    departing: departures.map(toStaffBookingListItem),
    inHouse: inHouse.map(toStaffBookingListItem),
    upcoming: upcoming.map(toStaffBookingListItem),
    recent: recent.map(toStaffBookingListItem),
    pendingRefunds: refunds.map((row) => ({
      cancellationId: row.id,
      refundablePaise: row.refundablePaise,
      booking: toStaffBookingListItem(row.booking),
    })),
    outstandingBalances: balances.map(toStaffBookingListItem),
    paidUnallocated: unallocated.map((order) => ({
      paymentOrderId: order.id,
      amountPaise: order.amountPaise,
      booking: toStaffBookingListItem(order.booking),
    })),
    liveHolds: liveHolds.map(toStaffBookingListItem),
    blockedToday: activeBlocks.map((block) => ({
      id: block.id,
      reason: block.reason,
      roomNumber: block.reservation?.room.roomNumber ?? "",
      checkIn: block.reservation?.checkIn.toISOString().slice(0, 10) ?? today,
      checkOut: block.reservation?.checkOut.toISOString().slice(0, 10) ?? today,
    })),
  };
}
