import "server-only";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/contracts/errors";
import { addDays, todayIstDate } from "@/lib/dates";
import type { AdminActor } from "@/server/auth/admin-session";
import { db } from "@/server/db/client";
import { staffBookingInclude, toStaffBooking } from "@/server/dto-admin";
import {
  assertRoomSupportsAc,
  isRoomFree,
  lockRoomsForGroups,
  releaseLapsedHolds,
} from "@/server/services/allocation";
import { dateOnlyToUtc } from "@/server/services/availability-service";

export type RoomCellState = "free" | "held" | "booked" | "blocked";

export async function getRoomGrid(from = todayIstDate(), days = 14) {
  const start = dateOnlyToUtc(from);
  const end = dateOnlyToUtc(addDays(from, days));
  const rooms = await db().room.findMany({
    where: { active: true },
    orderBy: [{ roomGroupId: "asc" }, { roomNumber: "asc" }],
    include: {
      reservations: {
        where: {
          state: { in: ["HELD", "CONFIRMED"] },
          checkIn: { lt: end },
          checkOut: { gt: start },
        },
        include: {
          bookingRoom: {
            select: {
              bookingId: true,
              acMode: true,
              booking: { select: { reference: true, status: true, contactFullName: true } },
            },
          },
          roomBlock: { select: { id: true, reason: true, active: true } },
        },
      },
    },
  });

  const dates = Array.from({ length: days }, (_, index) => addDays(from, index));
  return {
    from,
    days,
    dates,
    rooms: rooms.map((room) => ({
      id: room.id,
      roomNumber: room.roomNumber,
      roomGroupId: room.roomGroupId,
      supportsAc: room.supportsAc,
      cells: dates.map((date) => {
        const day = dateOnlyToUtc(date);
        const next = dateOnlyToUtc(addDays(date, 1));
        const hit = room.reservations.find((reservation) => reservation.checkIn < next && reservation.checkOut > day);
        if (!hit) return { date, state: "free" as const };
        if (hit.roomBlockId) {
          return {
            date,
            state: "blocked" as const,
            blockId: hit.roomBlock?.id ?? hit.roomBlockId,
            reason: hit.roomBlock?.reason ?? "",
          };
        }
        return {
          date,
          state: hit.state === "HELD" ? ("held" as const) : ("booked" as const),
          bookingId: hit.bookingRoom?.bookingId ?? null,
          reference: hit.bookingRoom?.booking.reference ?? null,
          guestName: hit.bookingRoom?.booking.contactFullName ?? null,
          acMode: hit.bookingRoom?.acMode === "AC" ? "ac" : "non-ac",
        };
      }),
    })),
  };
}

export async function reassignBookingRoom(input: {
  bookingId: string;
  bookingRoomId: string;
  roomId: string;
  actor: AdminActor;
  idempotencyKey: string;
}) {
  return db().$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${input.bookingId}::uuid FOR UPDATE`);
    const existing = await transaction.bookingEvent.findFirst({
      where: { bookingId: input.bookingId, type: "ROOM_REASSIGNED", idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return toStaffBooking(await transaction.booking.findUniqueOrThrow({ where: { id: input.bookingId }, include: staffBookingInclude }));
    }
    const booking = await transaction.booking.findUnique({ where: { id: input.bookingId } });
    if (!booking || (booking.status !== "CONFIRMED" && booking.status !== "PENDING_PAYMENT")) {
      throw new ApiError(409, "INVALID_STATE", "This booking cannot be moved.");
    }
    const reservation = await transaction.roomReservation.findFirst({
      where: { bookingRoomId: input.bookingRoomId, state: { in: ["HELD", "CONFIRMED"] } },
      include: { bookingRoom: true, room: true },
    });
    if (!reservation || reservation.bookingRoom?.bookingId !== input.bookingId) {
      throw new ApiError(404, "NOT_FOUND", "The assigned room was not found.");
    }
    const target = await transaction.room.findUnique({ where: { id: input.roomId } });
    if (!target || !target.active) throw new ApiError(404, "NOT_FOUND", "That physical room was not found.");
    if (target.roomGroupId !== reservation.bookingRoom.roomGroupId) {
      throw new ApiError(409, "ROOM_GROUP_MISMATCH", "Pick a room in the same group.");
    }
    const rooms = await lockRoomsForGroups(transaction, [target.roomGroupId]);
    await releaseLapsedHolds(transaction, rooms.map((room) => room.id), new Date());
    if (reservation.bookingRoom.acMode === "AC") assertRoomSupportsAc(target);
    const free = await isRoomFree(transaction, {
      roomId: target.id,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      ignoreReservationId: reservation.id,
    });
    if (!free) throw new ApiError(409, "AVAILABILITY_CHANGED", "That room is not free for these dates.");
    await transaction.roomReservation.update({
      where: { id: reservation.id },
      data: { roomId: target.id },
    });
    await transaction.bookingEvent.create({
      data: {
        bookingId: input.bookingId,
        type: "ROOM_REASSIGNED",
        actorType: "ADMIN",
        actorId: input.actor.id,
        idempotencyKey: input.idempotencyKey,
        data: {
          bookingRoomId: input.bookingRoomId,
          fromRoomNumber: reservation.room.roomNumber,
          toRoomNumber: target.roomNumber,
        },
      },
    });
    return toStaffBooking(await transaction.booking.findUniqueOrThrow({ where: { id: input.bookingId }, include: staffBookingInclude }));
  });
}

export async function createRoomBlock(input: {
  roomId: string;
  checkIn: string;
  checkOut: string;
  reason: string;
  actor: AdminActor;
}) {
  const start = dateOnlyToUtc(input.checkIn);
  const end = dateOnlyToUtc(input.checkOut);
  if (end <= start) throw new ApiError(400, "VALIDATION_ERROR", "Choose a check-out after check-in.");
  return db().$transaction(async (transaction) => {
    const room = await transaction.room.findUnique({ where: { id: input.roomId } });
    if (!room || !room.active) throw new ApiError(404, "NOT_FOUND", "That physical room was not found.");
    const locked = await lockRoomsForGroups(transaction, [room.roomGroupId]);
    await releaseLapsedHolds(transaction, locked.map((item) => item.id), new Date());
    const free = await isRoomFree(transaction, { roomId: room.id, checkIn: start, checkOut: end });
    if (!free) throw new ApiError(409, "AVAILABILITY_CHANGED", "That room is already occupied for these dates.");
    const block = await transaction.roomBlock.create({
      data: {
        reason: input.reason,
        createdBy: input.actor.id,
        reservation: {
          create: {
            roomId: room.id,
            checkIn: start,
            checkOut: end,
            state: "CONFIRMED",
          },
        },
      },
      include: { reservation: { include: { room: true } } },
    });
    return {
      id: block.id,
      reason: block.reason,
      roomNumber: block.reservation?.room.roomNumber ?? room.roomNumber,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
    };
  });
}

export async function releaseRoomBlock(blockId: string, actor: AdminActor) {
  const now = new Date();
  return db().$transaction(async (transaction) => {
    const block = await transaction.roomBlock.findUnique({
      where: { id: blockId },
      include: { reservation: true },
    });
    if (!block || !block.active) throw new ApiError(404, "NOT_FOUND", "That room block was not found.");
    if (block.reservation) {
      await transaction.roomReservation.update({
        where: { id: block.reservation.id },
        data: { state: "RELEASED", releasedAt: now },
      });
    }
    await transaction.roomBlock.update({
      where: { id: blockId },
      data: { active: false, releasedAt: now, createdBy: block.createdBy ?? actor.id },
    });
    return { id: blockId, released: true };
  });
}

export async function listAssignableRooms(bookingRoomId: string) {
  const reservation = await db().roomReservation.findFirst({
    where: { bookingRoomId, state: { in: ["HELD", "CONFIRMED"] } },
    include: { bookingRoom: true, room: true },
  });
  if (!reservation || !reservation.bookingRoom) {
    throw new ApiError(404, "NOT_FOUND", "The assigned room was not found.");
  }
  const rooms = await db().room.findMany({
    where: { active: true, roomGroupId: reservation.bookingRoom.roomGroupId },
    orderBy: { roomNumber: "asc" },
  });
  const options = [];
  for (const room of rooms) {
    const free =
      room.id === reservation.roomId ||
      (await isRoomFree(db(), {
        roomId: room.id,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        ignoreReservationId: reservation.id,
      }));
    options.push({
      id: room.id,
      roomNumber: room.roomNumber,
      supportsAc: room.supportsAc,
      current: room.id === reservation.roomId,
      free,
    });
  }
  return options;
}
