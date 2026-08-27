import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { BookingWizard } from "@/features/booking/BookingWizard";

export const metadata: Metadata = { title: "Book" };

export default function BookPage() {
  return (
    <main className="pt-[var(--header)]">
      <Container className="py-14 md:py-20">
        <Suspense fallback={<p>Loading booking...</p>}>
          <BookingWizard />
        </Suspense>
      </Container>
    </main>
  );
}
