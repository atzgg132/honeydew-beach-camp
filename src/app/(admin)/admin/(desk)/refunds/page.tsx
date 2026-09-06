import type { Metadata } from "next";
import { ProcessedRefundsList, RefundsList } from "@/features/admin/bookings/RefundsList";
import { listPendingRefunds, listProcessedRefunds } from "@/server/services/admin-refunds";

export const metadata: Metadata = { title: "Refunds" };

export default async function AdminRefundsPage() {
  const [rows, processed] = await Promise.all([listPendingRefunds(), listProcessedRefunds()]);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-medium tracking-tight">Refunds</h1>
      <RefundsList rows={rows} />
      <h2 className="text-lg font-medium tracking-tight">Processed</h2>
      <ProcessedRefundsList rows={processed} />
    </div>
  );
}
