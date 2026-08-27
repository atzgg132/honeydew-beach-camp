import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { ConfirmationView } from "@/features/booking/ConfirmationView";

export const metadata: Metadata = { title: "Booking confirmation" };

export default function ConfirmedPage() {
  return (
    <main className="pt-[var(--header)]">
      <Container className="py-14 md:py-20">
        <Suspense fallback={<p>Loading confirmation...</p>}>
          <ConfirmationView />
        </Suspense>
      </Container>
    </main>
  );
}
