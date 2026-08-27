import type {
  AcMode,
  Availability,
  Booking,
  BookingContact,
  CancellationQuote,
  GuestComposition,
  RoomAllocation,
} from "@/types";

export interface BookingLookup {
  reference: string;
  phone: string;
}

export interface CreateBookingInput {
  checkIn: string;
  checkOut: string;
  composition: GuestComposition;
  contact: BookingContact;
  rooms: RoomAllocation[];
}

export interface BookingService {
  list(): Promise<Booking[]>;
  availability(checkIn: string, checkOut: string, exceptReference?: string): Promise<Availability>;
  create(input: CreateBookingInput): Promise<Booking>;
  find(lookup: BookingLookup): Promise<Booking | null>;
  getByReference(reference: string): Promise<Booking | null>;
  updateContact(reference: string, contact: BookingContact): Promise<Booking>;
  changeGuests(reference: string, composition: GuestComposition): Promise<Booking>;
  upgradeRoomToAc(reference: string, roomId: string): Promise<Booking>;
  quoteCancellation(reference: string, now?: Date): Promise<CancellationQuote>;
  cancel(reference: string, now?: Date): Promise<Booking>;
}

export type { AcMode };
