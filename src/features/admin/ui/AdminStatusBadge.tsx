import { cn } from "@/lib/cn";
import type { StaffBookingStatus, StaffPaymentView } from "@/features/admin/types";

const bookingLabel: Record<StaffBookingStatus, string> = {
  pending_payment: "Hold",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

const paymentLabel: Record<StaffPaymentView, string> = {
  balance_due_at_hotel: "Balance due",
  settled: "Settled",
  refund_pending_hotel: "Refund queued",
  refunded: "Refunded",
  paid_unallocated: "Paid, unallocated",
};

const sourceLabel = {
  ONLINE: "Online",
  PHONE: "Phone",
  WALK_IN: "Walk-in",
  ADMIN: "Admin",
} as const;

function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "danger" | "warn" | "ok";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tone === "danger" && "border-danger/30 text-danger",
        tone === "warn" && "border-honey/50 text-lagoon-900",
        tone === "ok" && "border-lagoon-800/25 text-lagoon-800",
        tone === "neutral" && "border-line text-ink/80",
      )}
    >
      {label}
    </span>
  );
}

export function BookingStatusBadge({ status }: { status: StaffBookingStatus }) {
  const tone = status === "cancelled" || status === "expired" ? "danger" : status === "pending_payment" ? "warn" : "ok";
  return <Badge label={bookingLabel[status]} tone={tone} />;
}

export function PaymentStatusBadge({ status }: { status: StaffPaymentView }) {
  const tone =
    status === "refunded" || status === "settled"
      ? "ok"
      : status === "paid_unallocated" || status === "refund_pending_hotel"
        ? "warn"
        : "neutral";
  return <Badge label={paymentLabel[status]} tone={tone} />;
}

export function SourceBadge({ source }: { source: keyof typeof sourceLabel }) {
  return <Badge label={sourceLabel[source]} />;
}
