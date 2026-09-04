import "server-only";
import type { BookingSource, BookingStatus, Prisma } from "@prisma/client";
import { ApiError } from "@/contracts/errors";
import { todayIstDate } from "@/lib/dates";
import { last10Digits } from "@/lib/format";
import { phoneLookupHash } from "@/server/crypto";
import { db } from "@/server/db/client";
import { staffBookingInclude, toStaffBooking, toStaffBookingListItem } from "@/server/dto-admin";
import { dateOnlyToUtc } from "@/server/services/availability-service";

export interface AdminBookingListQuery {
  reference?: string;
  name?: string;
  phone?: string;
  email?: string;
  from?: string;
  to?: string;
  status?: BookingStatus | "COMPLETED";
  paymentView?: "balance_due" | "refund_pending" | "paid_unallocated" | "settled";
  source?: BookingSource;
  roomGroupId?: "single-bed" | "double-bed";
  roomNumber?: string;
  page?: number;
}

const PAGE_SIZE = 25;

export function parseAdminBookingListQuery(searchParams: URLSearchParams): AdminBookingListQuery {
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const paymentView = searchParams.get("paymentView");
  const roomGroupId = searchParams.get("roomGroupId");
  const page = Number(searchParams.get("page") ?? "1");
  return {
    reference: searchParams.get("reference") ?? undefined,
    name: searchParams.get("name") ?? undefined,
    phone: searchParams.get("phone") ?? undefined,
    email: searchParams.get("email") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    status:
      status === "PENDING_PAYMENT" ||
      status === "CONFIRMED" ||
      status === "CANCELLED" ||
      status === "EXPIRED" ||
      status === "COMPLETED"
        ? status
        : undefined,
    paymentView:
      paymentView === "balance_due" ||
      paymentView === "refund_pending" ||
      paymentView === "paid_unallocated" ||
      paymentView === "settled"
        ? paymentView
        : undefined,
    source: source === "ONLINE" || source === "PHONE" || source === "WALK_IN" || source === "ADMIN" ? source : undefined,
    roomGroupId: roomGroupId === "single-bed" || roomGroupId === "double-bed" ? roomGroupId : undefined,
    roomNumber: searchParams.get("roomNumber") ?? undefined,
    page: Number.isInteger(page) ? page : 1,
  };
}

export async function getStaffBooking(bookingId: string) {
  const record = await db().booking.findUnique({ where: { id: bookingId }, include: staffBookingInclude });
  if (!record) throw new ApiError(404, "NOT_FOUND", "The booking was not found.");
  return toStaffBooking(record);
}

export async function listStaffBookings(query: AdminBookingListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const where = buildWhere(query);
  const [total, rows] = await Promise.all([
    db().booking.count({ where }),
    db().booking.findMany({
      where,
      include: staffBookingInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return {
    page,
    pageSize: PAGE_SIZE,
    total,
    bookings: rows.map(toStaffBookingListItem),
  };
}

function buildWhere(query: AdminBookingListQuery): Prisma.BookingWhereInput {
  const clauses: Prisma.BookingWhereInput[] = [];
  if (query.reference) {
    clauses.push({ reference: { equals: query.reference.trim().toUpperCase(), mode: "insensitive" } });
  }
  if (query.name) {
    clauses.push({ contactFullName: { contains: query.name.trim(), mode: "insensitive" } });
  }
  if (query.email) {
    clauses.push({ contactEmail: { contains: query.email.trim().toLowerCase(), mode: "insensitive" } });
  }
  const digits = query.phone ? last10Digits(query.phone) : "";
  if (query.phone) {
    if (digits.length === 10) {
      clauses.push({ contactPhoneLookupHash: phoneLookupHash(`+91${digits}`) });
    } else {
      clauses.push({ reference: "__no_match__" });
    }
  }
  if (query.from || query.to) {
    if (query.from && query.to) {
      clauses.push({
        checkIn: { lt: dateOnlyToUtc(query.to) },
        checkOut: { gt: dateOnlyToUtc(query.from) },
      });
    } else {
      clauses.push({ reference: "__no_match__" });
    }
  }
  if (query.status === "COMPLETED") {
    clauses.push({ status: "CONFIRMED", checkOut: { lt: dateOnlyToUtc(todayIstDate()) } });
  } else if (query.status) {
    clauses.push({ status: query.status });
  }
  if (query.source) clauses.push({ source: query.source });
  if (query.roomGroupId) {
    clauses.push({ rooms: { some: { roomGroupId: query.roomGroupId } } });
  }
  if (query.roomNumber) {
    clauses.push({
      rooms: {
        some: {
          reservations: {
            some: {
              state: { in: ["HELD", "CONFIRMED"] },
              room: { roomNumber: query.roomNumber.trim() },
            },
          },
        },
      },
    });
  }
  if (query.paymentView === "balance_due") {
    clauses.push({ status: "CONFIRMED", outstandingPaise: { gt: 0 }, cancellation: { is: null } });
  } else if (query.paymentView === "settled") {
    clauses.push({ status: "CONFIRMED", outstandingPaise: { lte: 0 }, cancellation: { is: null } });
  } else if (query.paymentView === "refund_pending") {
    clauses.push({ cancellation: { is: { refundStatus: { in: ["PENDING_HOTEL_REVIEW", "APPROVED"] } } } });
  } else if (query.paymentView === "paid_unallocated") {
    clauses.push({ payments: { some: { status: "PAID_UNALLOCATED" } } });
  }
  if (clauses.length === 0) return {};
  return { AND: clauses };
}
