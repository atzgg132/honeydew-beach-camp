import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { SiteImage } from "@/components/media/SiteImage";
import { copy } from "@/data/copy";
import { hotel } from "@/data/hotel";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="pt-[var(--header)]">
      <Container className="grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
        <div>
          <h1 className="font-serif text-4xl tracking-tight md:text-5xl">{hotel.name}</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-ink/80">{copy.intro}</p>
          <p className="mt-4 max-w-xl text-base leading-8 text-ink/75">
            The camp is on {hotel.localityLabel}. Guests stay in numbered rooms and spend time on the grounds between meals and the water.
          </p>
        </div>
        <div className="relative min-h-[18rem] overflow-hidden md:min-h-[24rem]">
          <SiteImage id="cottages" className="absolute inset-0" priority />
        </div>
      </Container>
      <div className="relative h-[min(60dvh,28rem)]">
        <SiteImage id="camp-gazebos" className="absolute inset-0" sizes="100vw" />
      </div>
    </main>
  );
}
