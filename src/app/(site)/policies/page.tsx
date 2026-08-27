import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { CancellationTimeline } from "@/features/policies/CancellationTimeline";
import { childPolicy, refundNote } from "@/data/policies";
import { hotel } from "@/data/hotel";
import { formatTimeLabel } from "@/lib/dates";
import { copy } from "@/data/copy";

export const metadata: Metadata = { title: "Policies" };

export default function PoliciesPage() {
  return (
    <main className="pt-[var(--header)]">
      <Container className="py-16 md:py-24">
        <h1 className="font-serif text-4xl tracking-tight md:text-5xl">Guest policies</h1>
        <p className="mt-4 max-w-2xl text-lg text-ink/75">
          Cancellation charges are calculated on the advance already paid, not on the full stay total.
        </p>

        <section className="mt-14">
          <h2 className="font-serif text-2xl tracking-tight">Arrival</h2>
          <p className="mt-3 text-base leading-7 text-ink/80">
            Check-in {formatTimeLabel(hotel.checkInTime)}. Check-out {formatTimeLabel(hotel.checkOutTime)}.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="font-serif text-2xl tracking-tight">Cancellation</h2>
          <p className="mt-3 mb-8 max-w-2xl text-base leading-7 text-ink/80">{refundNote}</p>
          <CancellationTimeline />
        </section>

        <section className="mt-14 max-w-2xl">
          <h2 className="font-serif text-2xl tracking-tight">Meals</h2>
          <p className="mt-3 leading-7">{copy.meals}</p>
        </section>

        <section className="mt-14 max-w-2xl">
          <h2 className="font-serif text-2xl tracking-tight">Children</h2>
          <p className="mt-3 leading-7">{childPolicy.under5}</p>
          <p className="mt-2 leading-7">{childPolicy.age5to10}</p>
          <p className="mt-2 leading-7">{copy.oneGuestNote}</p>
        </section>

        <section className="mt-14 max-w-2xl">
          <h2 className="font-serif text-2xl tracking-tight">Identification</h2>
          <p className="mt-3 leading-7">{hotel.idProof}</p>
        </section>
      </Container>
    </main>
  );
}
