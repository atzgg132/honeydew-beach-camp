export type StaffBookingStatus = "pending_payment" | "confirmed" | "completed" | "cancelled" | "expired";
export type StaffPaymentView =
  | "balance_due_at_hotel"
  | "settled"
  | "refund_pending_hotel"
  | "refunded"
  | "paid_unallocated";

export interface StaffBookingListItem {
  id: string;
  reference: string | null;
  source: "ONLINE" | "PHONE" | "WALK_IN" | "ADMIN";
  status: StaffBookingStatus;
  rawStatus: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
  paymentView: StaffPaymentView;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  assignedRooms: string[];
  roomGroups: string[];
  subtotalPaise: number;
  outstandingPaise: number;
  createdAt: string;
}

export interface StaffBookingRoom {
  id: string;
  roomGroupId: string;
  roomGroupName: string;
  acMode: "ac" | "non-ac";
  composition: { adults: number; childrenUnder5: number; children5to10: number };
  physicalOccupancy: number;
  tariffOccupancy: number;
  ratePerPersonPaise: number;
  nightlyTotalPaise: number;
  stayTotalPaise: number;
  assignedPhysicalRoomNumber: string | null;
  assignedRoomId: string | null;
  reservationId: string | null;
  reservationState: "HELD" | "CONFIRMED" | null;
}

export interface StaffBooking {
  id: string;
  reference: string | null;
  source: "ONLINE" | "PHONE" | "WALK_IN" | "ADMIN";
  status: StaffBookingStatus;
  rawStatus: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
  paymentView: StaffPaymentView;
  checkIn: string;
  checkOut: string;
  holdExpiresAt: string | null;
  contact: { fullName: string; phone: string; email: string };
  composition: { adults: number; childrenUnder5: number; children5to10: number };
  nights: number;
  currency: string;
  subtotalPaise: number;
  advanceBasisPoints: number;
  advanceDuePaise: number;
  advancePaidPaise: number;
  outstandingPaise: number;
  rooms: StaffBookingRoom[];
  payments: Array<{
    id: string;
    provider: string;
    status: string;
    amountPaise: number;
    currency: string;
    createdAt: string;
  }>;
  cancellation: {
    id: string;
    slabLabel: string;
    hoursUntilCheckIn: number;
    advancePaidPaise: number;
    deductionBasisPoints: number;
    deductionPaise: number;
    refundablePaise: number;
    refundStatus: string;
    actualRefundPaise: number | null;
    providerRefundReference: string | null;
    cancelledAt: string;
  } | null;
  events: Array<{
    id: string;
    type: string;
    actorType: string;
    actorId: string | null;
    deltaPaise: number | null;
    createdAt: string;
  }>;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
}
