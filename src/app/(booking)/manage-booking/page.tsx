import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { ManageBooking } from "@/features/manage-booking/ManageBooking";

export const metadata: Metadata = { title: "Manage booking" };

export default function ManageBookingPage() {
  return (
    <main className="pt-[var(--header)] pb-24">
      <Container className="py-14 md:py-20">
        <Suspense fallback={<p>Loading booking...</p>}>
          <ManageBooking />
        </Suspense>
      </Container>
    </main>
  );
}
