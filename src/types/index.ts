export type RoomGroupId = "single-bed" | "double-bed";
export type AcMode = "ac" | "non-ac";

export type BookingStatus = "confirmed" | "cancelled" | "completed";
export type PaymentStatus =
  | "advance_paid"
  | "balance_due_at_hotel"
  | "refund_pending_hotel"
  | "refunded";

export interface PhysicalRoom {
  roomNumber: "401" | "402" | "403" | "404" | "405" | "406" | "407";
  roomGroupId: RoomGroupId;
  supportsAc: true;
}

export interface RoomGroup {
  id: RoomGroupId;
  slug: RoomGroupId;
  publicName: string;
  occupancyMin: number;
  occupancyMax: number;
  roomNumbers: PhysicalRoom["roomNumber"][];
  mediaIds: string[];
  shortDifference: string;
  description: string;
}

export interface TariffSlab {
  roomGroupId: RoomGroupId;
  occupancy: number;
  acMode: AcMode;
  ratePerPerson: number;
}

export interface GuestComposition {
  adults: number;
  childrenUnder5: number;
  children5to10: number;
}

export interface BookingContact {
  fullName: string;
  phone: string;
  email: string;
}

export interface RoomShape {
  roomGroupId: RoomGroupId;
  occupancy: number;
}

export interface RoomAllocation {
  id: string;
  roomGroupId: RoomGroupId;
  acMode: AcMode;
  composition: GuestComposition;
}

export interface RoomPricingSnapshot {
  roomGroupId: RoomGroupId;
  acMode: AcMode;
  physicalOccupancy: number;
  tariffOccupancy: number;
  composition: GuestComposition;
  tariffPerPerson: number;
  billableUnits: number;
  nightlyTotal: number;
  nights: number;
  stayTotal: number;
}

export interface BookingPricingSnapshot {
  rooms: RoomPricingSnapshot[];
  nights: number;
  subtotal: number;
  advancePercent: number;
  advance: number;
  balance: number;
}

export interface BookedRoom {
  id: string;
  roomGroupId: RoomGroupId;
  acMode: AcMode;
  composition: GuestComposition;
  physicalOccupancy: number;
  tariffOccupancy: number;
  assignedPhysicalRoomNumber: string | null;
  pricing: RoomPricingSnapshot;
}

export interface CancellationSlab {
  id: string;
  maxHoursBeforeCheckIn: number | null;
  deductionPercent: number;
  label: string;
  explanation: string;
}

export interface CancellationQuote {
  slab: CancellationSlab;
  hoursUntilCheckIn: number;
  advancePaid: number;
  deductionPercent: number;
  charge: number;
  refundable: number;
  refundControlledByHotel: true;
}

export interface Booking {
  id: string;
  reference: string;
  isDemo: boolean;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  checkIn: string;
  checkOut: string;
  composition: GuestComposition;
  contact: BookingContact;
  rooms: BookedRoom[];
  pricing: BookingPricingSnapshot;
  advancePaid: number;
  outstanding: number;
  cancellationQuote?: CancellationQuote;
  createdAt: string;
  updatedAt: string;
}

export interface Availability {
  "single-bed": number;
  "double-bed": number;
}

export interface Arrangement {
  id: string;
  rooms: RoomShape[];
  nightlyEstimateAc: number;
  nightlyEstimateNonAc: number;
  labels: string[];
}

export interface MediaAsset {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  group: "hero" | "stay" | "outdoors" | "food" | "details" | "night";
  objectPosition?: string;
}

export interface Amenity {
  id: string;
  title: string;
  description: string;
}
