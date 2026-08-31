import "server-only";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/contracts/errors";

/**
 * Physical-room allocation.
 *
 * Every path that occupies inventory — an online hold, a booking taken over the phone or at
 * the desk, a room reassignment, a maintenance block — goes through this module. It was
 * previously inlined in `createHold`, which meant any second caller would have had to
 * reimplement the locking order, the stale-hold sweep and the AC-capability check, and would
 * have got at least one of them subtly wrong.
 *
 * Two invariants matter and are load-bearing:
 *
 *  1. Rooms are locked `FOR UPDATE` in a deterministic order (room group, then room number)
 *     so that concurrent allocations queue instead of deadlocking.
 *  2. This code is an optimisation, not the guarantee. The real guarantee is the PostgreSQL
 *     exclusion constraint `RoomReservation_no_overlap`, which rejects any overlapping
 *     reservation for the same room regardless of what the application believed. Selecting a
 *     free room here only avoids losing a race we can cheaply avoid; losing it anyway is
 *     safe and surfaces as `AVAILABILITY_CHANGED`.
 */

export interface LockedRoom {
  id: string;
  roomGroupId: string;
  roomNumber: string;
  supportsAc: boolean;
}

export interface RoomIntent {
  roomGroupId: string;
  acMode: "ac" | "non-ac";
}

/**
 * Locks every active room in the given groups. The `ORDER BY` is not cosmetic: two
 * transactions locking the same rooms in different orders deadlock, and PostgreSQL resolves
 * that by killing one of them.
 */
export async function lockRoomsForGroups(
  transaction: Prisma.TransactionClient,
  roomGroupIds: string[],
): Promise<LockedRoom[]> {
  if (roomGroupIds.length === 0) return [];
  return transaction.$queryRaw<LockedRoom[]>(Prisma.sql`
    SELECT "id", "roomGroupId", "roomNumber", "supportsAc"
    FROM "Room"
    WHERE "active" = true AND "roomGroupId" IN (${Prisma.join(roomGroupIds)})
    ORDER BY "roomGroupId", "roomNumber"
    FOR UPDATE
  `);
}

/**
 * Releases holds on the given rooms whose deadline has passed, and expires the bookings they
 * belonged to.
 *
 * A hold is only lapsed if its booking is still awaiting payment and has no successful
 * payment against it. That second condition is what stops this racing a payment that is
 * being settled concurrently: money that has arrived must never have its room taken away
 * here. A payment that lands after this point is handled as `PAID_UNALLOCATED` instead.
 *
 * Returns the ids of the bookings that were expired.
 */
export async function releaseLapsedHolds(
  transaction: Prisma.TransactionClient,
  roomIds: string[],
  now: Date,
): Promise<string[]> {
  if (roomIds.length === 0) return [];

  const lapsed = await transaction.roomReservation.findMany({
    where: {
      roomId: { in: roomIds },
      state: "HELD",
      expiresAt: { lte: now },
      bookingRoom: {
        booking: {
          status: "PENDING_PAYMENT",
          payments: { none: { status: "PAID" } },
        },
      },
    },
    select: { id: true, bookingRoom: { select: { bookingId: true } } },
  });
  if (lapsed.length === 0) return [];

  const bookingIds = [...new Set(lapsed.flatMap((item) => item.bookingRoom?.bookingId ?? []))];

  await transaction.roomReservation.updateMany({
    where: { id: { in: lapsed.map((item) => item.id) } },
    data: { state: "RELEASED", releasedAt: now },
  });
  await transaction.paymentOrder.updateMany({
    where: { bookingId: { in: bookingIds }, status: { in: ["CREATED", "PENDING"] } },
    data: { status: "EXPIRED" },
  });
  await transaction.booking.updateMany({
    where: { id: { in: bookingIds }, status: "PENDING_PAYMENT" },
    data: { status: "EXPIRED" },
  });
  await transaction.bookingEvent.createMany({
    data: bookingIds.map((bookingId) => ({
      bookingId,
      type: "HOLD_EXPIRED",
      actorType: "SYSTEM" as const,
      data: { expiredAt: now.toISOString() },
    })),
    skipDuplicates: true,
  });

  return bookingIds;
}

/**
 * Rooms with a live reservation overlapping the stay.
 *
 * The comparison is half-open: a stay ending on the day another begins does not overlap, so
 * a room is reusable on its checkout date. This mirrors the `'[)'` daterange in the
 * exclusion constraint, and the two must stay in step.
 */
export async function findOccupiedRoomIds(
  transaction: Prisma.TransactionClient,
  roomIds: string[],
  checkIn: Date,
  checkOut: Date,
): Promise<Set<string>> {
  if (roomIds.length === 0) return new Set();
  const occupied = await transaction.roomReservation.findMany({
    where: {
      roomId: { in: roomIds },
      state: { in: ["HELD", "CONFIRMED"] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    select: { roomId: true },
  });
  return new Set(occupied.map((reservation) => reservation.roomId));
}

/** A room can only satisfy an air-conditioned request if the room actually supports it. */
export function roomSatisfies(room: LockedRoom, intent: RoomIntent): boolean {
  if (room.roomGroupId !== intent.roomGroupId) return false;
  return intent.acMode !== "ac" || room.supportsAc;
}

export function assertRoomSupportsAc(room: Pick<LockedRoom, "roomNumber" | "supportsAc">): void {
  if (!room.supportsAc) {
    throw new ApiError(
      409,
      "AC_NOT_AVAILABLE",
      "The assigned room cannot be air-conditioned. The hotel needs to move this stay to another room.",
    );
  }
}

/**
 * Picks one free room per intent. Mutates nothing outside its own copy of the candidate list.
 * Throws `AVAILABILITY_CHANGED` as soon as an intent cannot be satisfied.
 */
export function assignRooms(free: readonly LockedRoom[], intents: readonly RoomIntent[]): LockedRoom[] {
  const remaining = [...free];
  return intents.map((intent) => {
    const index = remaining.findIndex((candidate) => roomSatisfies(candidate, intent));
    if (index < 0) {
      throw new ApiError(409, "AVAILABILITY_CHANGED", "The selected rooms are no longer available.");
    }
    return remaining.splice(index, 1)[0];
  });
}

/**
 * The whole allocation step: lock the candidate rooms, sweep lapsed holds so their inventory
 * becomes available again, then assign a free room to each requested room.
 *
 * Must be called inside a serializable transaction. Callers create the `RoomReservation` rows
 * themselves, because what those rows point at differs between a booking and a room block.
 */
export async function allocateRooms(
  transaction: Prisma.TransactionClient,
  input: {
    intents: readonly RoomIntent[];
    checkIn: Date;
    checkOut: Date;
    now: Date;
  },
): Promise<LockedRoom[]> {
  const groups = [...new Set(input.intents.map((intent) => intent.roomGroupId))];
  const rooms = await lockRoomsForGroups(transaction, groups);
  const roomIds = rooms.map((room) => room.id);

  await releaseLapsedHolds(transaction, roomIds, input.now);

  const occupied = await findOccupiedRoomIds(transaction, roomIds, input.checkIn, input.checkOut);
  const free = rooms.filter((room) => !occupied.has(room.id));
  return assignRooms(free, input.intents);
}

/**
 * Locks a single named room and reports whether it is free for the stay, ignoring one
 * reservation. Reassignment needs the exclusion: a room is not "occupied" by the very
 * reservation being moved off it.
 */
export async function isRoomFree(
  transaction: Prisma.TransactionClient,
  input: {
    roomId: string;
    checkIn: Date;
    checkOut: Date;
    ignoreReservationId?: string;
  },
): Promise<boolean> {
  const clash = await transaction.roomReservation.findFirst({
    where: {
      roomId: input.roomId,
      state: { in: ["HELD", "CONFIRMED"] },
      checkIn: { lt: input.checkOut },
      checkOut: { gt: input.checkIn },
      ...(input.ignoreReservationId ? { id: { not: input.ignoreReservationId } } : {}),
    },
    select: { id: true },
  });
  return clash === null;
}
