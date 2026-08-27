import type { Metadata } from "next";
import { BookingDesk } from "@/components/booking/BookingDesk";
import { Container } from "@/components/layout/Container";
import { StayPanel } from "@/features/rooms/StayPanel";
import { copy } from "@/data/copy";
import { roomGroups } from "@/data/rooms";

export const metadata: Metadata = { title: "Rooms" };

export default function RoomsPage() {
  return (
    <main className="pt-[var(--header)]">
      <Container className="py-16 md:py-24">
        <h1 className="font-serif max-w-3xl text-4xl tracking-tight md:text-5xl">Rooms at Honey Dew</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/75">
          Single-Bed Rooms suit one to three guests. Double-Bed Rooms suit four to six. Meals are included
          in the tariff. Larger parties can reserve more than one room in a single booking.
        </p>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink/75">{copy.acExplainer}</p>
        <div className="mt-14 space-y-16 md:space-y-24">
          <StayPanel group={roomGroups[0]} imageId="one-bed-01" priority />
          <StayPanel group={roomGroups[1]} imageId="two-bed-01" reverse />
        </div>
        <div className="mt-16 border border-line bg-cream-raised p-3 md:p-4">
          <BookingDesk />
        </div>
      </Container>
    </main>
  );
}
