import { bookingConfig } from "@/data/booking-config";
import { addDays, todayIstDate } from "@/lib/dates";
import { quoteCancellation } from "@/lib/booking/cancellation";
import { priceBooking } from "@/lib/booking/pricing";
import { physicalOccupancy } from "@/lib/booking/occupancy";
import type { Booking, BookingContact, GuestComposition, RoomAllocation } from "@/types";

function bookedRooms(checkIn: string, checkOut: string, rooms: RoomAllocation[]): Booking["rooms"] {
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

function buildBooking(partial: {
  id: string;
  reference: string;
  checkInOffset: number;
  nights: number;
  composition: GuestComposition;
  contact: BookingContact;
  rooms: RoomAllocation[];
  status?: Booking["status"];
}): Booking {
  const checkIn = addDays(todayIstDate(), partial.checkInOffset);
  const checkOut = addDays(checkIn, partial.nights);
  const rooms = bookedRooms(checkIn, checkOut, partial.rooms);
  const pricing = priceBooking({ checkIn, checkOut, rooms: partial.rooms });
  const now = new Date().toISOString();
  const booking: Booking = {
    id: partial.id,
    reference: partial.reference,
    isDemo: true,
    status: partial.status ?? "confirmed",
    paymentStatus:
      partial.status === "cancelled" ? "refund_pending_hotel" : "balance_due_at_hotel",
    checkIn,
    checkOut,
    composition: partial.composition,
    contact: partial.contact,
    rooms,
    pricing,
    advancePaid: pricing.advance,
    outstanding: pricing.balance,
    createdAt: now,
    updatedAt: now,
  };
  if (partial.status === "cancelled") {
    booking.cancellationQuote = quoteCancellation({
      checkIn,
      advancePaid: booking.advancePaid,
    });
    booking.outstanding = 0;
  }
  return booking;
}

export function createSeedBookings(): Booking[] {
  const phone = bookingConfig.demoPhone;
  return [
    buildBooking({
      id: "seed-8841",
      reference: "HD-DEMO-8841",
      checkInOffset: 45,
      nights: 3,
      composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
      contact: {
        fullName: "Ananya Roy",
        phone,
        email: "ananya.demo@honeydew.example",
      },
      rooms: [
        {
          id: "room-1",
          roomGroupId: "single-bed",
          acMode: "non-ac",
          composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
        },
      ],
    }),
    buildBooking({
      id: "seed-5520",
      reference: "HD-DEMO-5520",
      checkInOffset: 5,
      nights: 2,
      composition: { adults: 4, childrenUnder5: 0, children5to10: 0 },
      contact: {
        fullName: "Rahul Banerjee",
        phone,
        email: "rahul.demo@honeydew.example",
      },
      rooms: [
        {
          id: "room-1",
          roomGroupId: "single-bed",
          acMode: "non-ac",
          composition: { adults: 2, childrenUnder5: 0, children5to10: 0 },
        },
        {
          id: "room-2",
          roomGroupId: "single-bed",
          acMode: "ac",
          composition: { adults: 2, childrenUnder5: 0, children5to10: 0 },
        },
      ],
    }),
    buildBooking({
      id: "seed-1033",
      reference: "HD-DEMO-1033",
      checkInOffset: 20,
      nights: 2,
      composition: { adults: 2, childrenUnder5: 0, children5to10: 0 },
      contact: {
        fullName: "Meera Ghosh",
        phone,
        email: "meera.demo@honeydew.example",
      },
      status: "cancelled",
      rooms: [
        {
          id: "room-1",
          roomGroupId: "single-bed",
          acMode: "non-ac",
          composition: { adults: 2, childrenUnder5: 0, children5to10: 0 },
        },
      ],
    }),
  ];
}
