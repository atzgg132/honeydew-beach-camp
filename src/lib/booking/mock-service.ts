import { bookingConfig } from "@/data/booking-config";
import { createSeedBookings } from "@/data/seed-bookings";
import { getAvailability, fitsAvailability } from "@/lib/booking/availability";
import { quoteCancellation } from "@/lib/booking/cancellation";
import { allocationsMatchComposition } from "@/lib/booking/distribute";
import { physicalOccupancy } from "@/lib/booking/occupancy";
import { priceBooking, priceRoom } from "@/lib/booking/pricing";
import { rebalanceExistingRooms } from "@/lib/booking/rebalance";
import { last10Digits } from "@/lib/format";
import { todayIstDate } from "@/lib/dates";
import type {
  Availability,
  Booking,
  BookingContact,
  BookedRoom,
  CancellationQuote,
  GuestComposition,
  RoomAllocation,
} from "@/types";
import type { BookingLookup, BookingService, CreateBookingInput } from "@/lib/booking/service";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeRef(reference: string): string {
  return reference.trim().toUpperCase();
}

function randomRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `HD-DEMO-${suffix}`;
}

function toBookedRooms(checkIn: string, checkOut: string, rooms: RoomAllocation[]): BookedRoom[] {
  const pricing = priceBooking({ checkIn, checkOut, rooms });
  return rooms.map((room, index) => ({
    id: room.id,
    roomGroupId: room.roomGroupId,
    acMode: room.acMode,
    composition: room.composition,
    physicalOccupancy: physicalOccupancy(room.composition),
    tariffOccupancy: pricing.rooms[index].tariffOccupancy,
    assignedPhysicalRoomNumber: null,
    pricing: pricing.rooms[index],
  }));
}

class LocalBookingService implements BookingService {
  private memory: Booking[] | null = null;

  private read(): Booking[] {
    if (typeof window === "undefined") {
      if (!this.memory) this.memory = createSeedBookings();
      return this.memory;
    }
    try {
      const raw = window.localStorage.getItem(bookingConfig.storageKey);
      if (!raw) {
        const seeded = createSeedBookings();
        window.localStorage.setItem(bookingConfig.storageKey, JSON.stringify(seeded));
        return seeded;
      }
      const parsed = JSON.parse(raw) as Booking[];
      if (!Array.isArray(parsed) || parsed.some((item) => !item.rooms)) {
        const seeded = createSeedBookings();
        window.localStorage.setItem(bookingConfig.storageKey, JSON.stringify(seeded));
        return seeded;
      }
      return parsed;
    } catch {
      return createSeedBookings();
    }
  }

  private write(bookings: Booking[]) {
    this.memory = bookings;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(bookingConfig.storageKey, JSON.stringify(bookings));
    }
  }

  async list(): Promise<Booking[]> {
    return clone(this.read());
  }

  async availability(checkIn: string, checkOut: string, exceptReference?: string): Promise<Availability> {
    return getAvailability(this.read(), checkIn, checkOut, exceptReference);
  }

  async create(input: CreateBookingInput): Promise<Booking> {
    if (!allocationsMatchComposition(input.rooms, input.composition)) {
      throw new Error("Room guests must match the booking.");
    }
    const available = getAvailability(this.read(), input.checkIn, input.checkOut);
    if (!fitsAvailability(input.rooms, available)) {
      throw new Error("Those rooms are not open for the selected dates.");
    }
    const rooms = toBookedRooms(input.checkIn, input.checkOut, input.rooms);
    const pricing = priceBooking({ checkIn: input.checkIn, checkOut: input.checkOut, rooms: input.rooms });
    const bookings = this.read();
    let reference = randomRef();
    while (bookings.some((item) => item.reference === reference)) {
      reference = randomRef();
    }
    const now = new Date().toISOString();
    const booking: Booking = {
      id: crypto.randomUUID(),
      reference,
      isDemo: true,
      status: "confirmed",
      paymentStatus: "balance_due_at_hotel",
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      composition: input.composition,
      contact: input.contact,
      rooms,
      pricing,
      advancePaid: pricing.advance,
      outstanding: pricing.balance,
      createdAt: now,
      updatedAt: now,
    };
    this.write([booking, ...bookings]);
    return clone(booking);
  }

  async find(lookup: BookingLookup): Promise<Booking | null> {
    const reference = normalizeRef(lookup.reference);
    const phone = last10Digits(lookup.phone);
    const found = this.read().find(
      (item) => item.reference === reference && last10Digits(item.contact.phone) === phone,
    );
    return found ? clone(found) : null;
  }

  async getByReference(reference: string): Promise<Booking | null> {
    const found = this.read().find((item) => item.reference === normalizeRef(reference));
    return found ? clone(found) : null;
  }

  private mutate(reference: string, updater: (booking: Booking) => Booking): Booking {
    const bookings = this.read();
    const index = bookings.findIndex((item) => item.reference === normalizeRef(reference));
    if (index === -1) throw new Error("Booking not found.");
    const updated = updater(bookings[index]);
    updated.updatedAt = new Date().toISOString();
    bookings[index] = updated;
    this.write(bookings);
    return clone(updated);
  }

  async updateContact(reference: string, contact: BookingContact): Promise<Booking> {
    return this.mutate(reference, (booking) => {
      this.assertEditable(booking);
      return { ...booking, contact };
    });
  }

  async changeGuests(reference: string, composition: GuestComposition): Promise<Booking> {
    return this.mutate(reference, (booking) => {
      this.assertEditable(booking);
      const nextRooms = rebalanceExistingRooms(booking.rooms, composition);
      if (!nextRooms) {
        throw new Error("GROUP_CHANGE_REQUIRED");
      }
      const pricedRooms = toBookedRooms(booking.checkIn, booking.checkOut, nextRooms);
      const pricing = priceBooking({
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        rooms: nextRooms,
        advancePercent: booking.pricing.advancePercent,
      });
      const delta = pricing.subtotal - booking.pricing.subtotal;
      return {
        ...booking,
        composition,
        rooms: pricedRooms,
        pricing,
        outstanding: Math.max(0, booking.outstanding + delta),
      };
    });
  }

  async upgradeRoomToAc(reference: string, roomId: string): Promise<Booking> {
    return this.mutate(reference, (booking) => {
      this.assertEditable(booking);
      const rooms: RoomAllocation[] = booking.rooms.map((room) => ({
        id: room.id,
        roomGroupId: room.roomGroupId,
        acMode: room.id === roomId ? "ac" : room.acMode,
        composition: room.composition,
      }));
      const target = booking.rooms.find((room) => room.id === roomId);
      if (!target) throw new Error("Room not found.");
      if (target.acMode === "ac") throw new Error("This room already includes air-conditioning.");
      const nextRoomPricing = priceRoom({
        roomGroupId: target.roomGroupId,
        acMode: "ac",
        composition: target.composition,
        nights: booking.pricing.nights,
      });
      const pricedRooms = toBookedRooms(booking.checkIn, booking.checkOut, rooms);
      const pricing = priceBooking({
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        rooms,
        advancePercent: booking.pricing.advancePercent,
      });
      const delta = nextRoomPricing.stayTotal - target.pricing.stayTotal;
      return {
        ...booking,
        rooms: pricedRooms,
        pricing,
        outstanding: booking.outstanding + Math.max(0, delta),
      };
    });
  }

  async quoteCancellation(reference: string, now?: Date): Promise<CancellationQuote> {
    const booking = await this.getByReference(reference);
    if (!booking) throw new Error("Booking not found.");
    return quoteCancellation({
      checkIn: booking.checkIn,
      advancePaid: booking.advancePaid,
      now,
    });
  }

  async cancel(reference: string, now?: Date): Promise<Booking> {
    return this.mutate(reference, (booking) => {
      this.assertEditable(booking);
      const quote = quoteCancellation({
        checkIn: booking.checkIn,
        advancePaid: booking.advancePaid,
        now,
      });
      return {
        ...booking,
        status: "cancelled",
        paymentStatus: "refund_pending_hotel",
        outstanding: 0,
        cancellationQuote: quote,
      };
    });
  }

  private assertEditable(booking: Booking) {
    if (booking.status === "cancelled") {
      throw new Error("This booking has been cancelled.");
    }
    if (booking.checkIn < todayIstDate()) {
      throw new Error("This stay can no longer be changed online.");
    }
  }
}

let singleton: LocalBookingService | null = null;

export function getBookingService(): BookingService {
  if (!singleton) singleton = new LocalBookingService();
  return singleton;
}

export function resetBookingServiceForTests() {
  singleton = new LocalBookingService();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(bookingConfig.storageKey);
  }
}
