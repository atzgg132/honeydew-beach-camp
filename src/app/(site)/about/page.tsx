import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";
import { SiteImage } from "@/components/media/SiteImage";
import { copy } from "@/data/copy";
import { hotel } from "@/data/hotel";
import { formatTimeLabel } from "@/lib/dates";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="pt-[var(--header)]">
      <Container className="grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
        <div>
          <h1 className="font-serif text-4xl tracking-tight md:text-5xl">{hotel.name}</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-ink/80">{copy.intro}</p>
          <p className="mt-4 max-w-xl text-base leading-8 text-ink/75">
            The camp is on {hotel.localityLabel}, at {hotel.addressLines[1]},{" "}
            {hotel.addressLines[2]}, {hotel.addressLines[4]}, {hotel.district}. Guests
            stay in numbered rooms and spend time on the grounds between meals and
            the water.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/rooms">See rooms and tariffs</Button>
            <Button href="/contact" variant="secondary">
              Contact the camp
            </Button>
          </div>
        </div>
        <div className="relative min-h-[18rem] overflow-hidden md:min-h-[24rem]">
          <SiteImage id="cottages" className="absolute inset-0" priority />
        </div>
      </Container>

      <Container className="grid gap-10 pb-16 md:grid-cols-3 md:pb-24">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">What you book</h2>
          <p className="mt-3 text-base leading-7 text-ink/75">
            Single-Bed Rooms for one to three guests and Double-Bed Rooms for four
            to six, with or without air-conditioning on the tariff. Meals cooked at
            the camp are included in the stay charges, and every tariff on this
            website is in Indian Rupees.
          </p>
        </div>
        <div>
          <h2 className="font-serif text-2xl tracking-tight">How booking works</h2>
          <p className="mt-3 text-base leading-7 text-ink/75">
            Choose dates, rooms, and guests online and pay the advance shown in your
            quote to confirm. You receive a booking reference to manage or cancel
            the stay, and the remaining balance is payable at the camp.
          </p>
        </div>
        <div>
          <h2 className="font-serif text-2xl tracking-tight">Good to know</h2>
          <p className="mt-3 text-base leading-7 text-ink/75">
            Check-in {formatTimeLabel(hotel.checkInTime)}, check-out{" "}
            {formatTimeLabel(hotel.checkOutTime)}. {hotel.idProof} The house rules,
            cancellation timetable, and booking terms are on the Policies, Refunds
            &amp; Cancellations, and Terms pages linked below.
          </p>
        </div>
      </Container>

      <div className="relative h-[min(60dvh,28rem)]">
        <SiteImage id="camp-gazebos" className="absolute inset-0" sizes="100vw" />
      </div>
    </main>
  );
}
