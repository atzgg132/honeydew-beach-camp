import type { BookingStatus, PaymentStatus } from "@/types";
import { cn } from "@/lib/cn";

const bookingLabel: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Stay completed",
};

const paymentLabel: Record<PaymentStatus, string> = {
  advance_paid: "Advance recorded",
  balance_due_at_hotel: "Balance due at the hotel",
  refund_pending_hotel: "Refund with the hotel",
  refunded: "Refunded",
};

export function StatusBadge({
  status,
  kind = "booking",
}: {
  status: BookingStatus | PaymentStatus;
  kind?: "booking" | "payment";
}) {
  const cancelled = status === "cancelled" || status === "refund_pending_hotel";
  const label = kind === "booking" ? bookingLabel[status as BookingStatus] : paymentLabel[status as PaymentStatus];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[6px] border px-2.5 py-1 text-xs font-medium tracking-wide",
        cancelled
          ? "border-danger/30 text-danger"
          : "border-lagoon-800/25 text-lagoon-800",
      )}
    >
      {label}
    </span>
  );
}
