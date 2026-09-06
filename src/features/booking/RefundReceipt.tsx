import { Notice } from "@/components/ui/Notice";
import { formatIstDateTime } from "@/lib/dates";
import { formatInr } from "@/lib/format";
import type { CancellationRefund } from "@/types";

export function RefundReceipt({ refund }: { refund: CancellationRefund }) {
  return (
    <Notice>
      Refund of {formatInr(refund.actualRefund)} processed
      {refund.processedAt ? ` on ${formatIstDateTime(refund.processedAt)}` : ""}. RRN {refund.reference ?? "not recorded"}.
    </Notice>
  );
}
