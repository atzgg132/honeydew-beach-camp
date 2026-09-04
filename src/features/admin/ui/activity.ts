const eventLabels: Record<string, string> = {
  BOOKING_CREATED: "Stay created",
  HOLD_CREATED: "Hold created",
  BOOKING_CONFIRMED: "Stay confirmed",
  BOOKING_CANCELLED: "Stay cancelled",
  HOLD_EXPIRED: "Hold dropped",
  CONTACT_UPDATED: "Contact updated",
  GUESTS_CHANGED: "Guest mix changed",
  AC_UPGRADED: "Air-conditioning added",
  ROOM_REASSIGNED: "Room moved",
  HOTEL_PAYMENT_RECORDED: "Collection recorded",
  REFUND_UPDATED: "Refund updated",
  PAYMENT_PAID_UNALLOCATED: "Payment arrived after the hold lapsed",
  PAYMENT_UNALLOCATED_NOTED: "Unallocated payment noted for refund",
};

const actorLabels: Record<string, string> = {
  CUSTOMER: "Guest",
  ADMIN: "Desk",
  SYSTEM: "System",
};

export function eventLabel(type: string): string {
  return eventLabels[type] ?? type.replaceAll("_", " ").toLowerCase();
}

export function actorLabel(actorType: string): string {
  return actorLabels[actorType] ?? actorType.toLowerCase();
}
