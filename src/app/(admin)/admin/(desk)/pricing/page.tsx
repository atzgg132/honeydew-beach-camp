import type { Metadata } from "next";
import { InviteStaffForm } from "@/features/admin/settings/InviteStaffForm";
import { PricingForm } from "@/features/admin/settings/PricingForm";
import { getAdminPricing } from "@/server/services/admin-config";

export const metadata: Metadata = { title: "Pricing" };

export default async function AdminPricingPage() {
  const pricing = await getAdminPricing();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-medium tracking-tight">Pricing</h1>
      <PricingForm
        initial={{
          tariffRevision: pricing.tariffRevision,
          advanceBasisPoints: pricing.advanceBasisPoints,
          rates: pricing.rates,
        }}
      />
      <InviteStaffForm />
    </div>
  );
}
