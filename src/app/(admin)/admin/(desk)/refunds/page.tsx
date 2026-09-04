import type { Metadata } from "next";
import { RefundsList } from "@/features/admin/bookings/RefundsList";
import { listPendingRefunds } from "@/server/services/admin-refunds";

export const metadata: Metadata = { title: "Refunds" };

export default async function AdminRefundsPage() {
  const rows = await listPendingRefunds();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-medium tracking-tight">Refunds</h1>
      <RefundsList rows={rows} />
    </div>
  );
}
