import Script from "next/script";
import { SiteShell } from "@/components/layout/SiteShell";

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      {children}
    </SiteShell>
  );
}
