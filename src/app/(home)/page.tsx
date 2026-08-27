import { BookingDesk } from "@/components/booking/BookingDesk";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";
import { SiteImage } from "@/components/media/SiteImage";
import { StayPanel } from "@/features/rooms/StayPanel";
import { copy } from "@/data/copy";
import { hotel } from "@/data/hotel";
import { roomGroups } from "@/data/rooms";

export default function HomePage() {
  const singleBed = roomGroups[0];
  const doubleBed = roomGroups[1];

  return (
    <main>
      <section className="relative min-h-[100dvh] text-cream">
        <SiteImage id="hero-boats" className="absolute inset-0" priority sizes="100vw" />
        <div className="scrim-hero absolute inset-0" />
        <Container className="relative flex min-h-[100dvh] flex-col justify-end pb-6 pt-24 sm:pb-8 sm:pt-28 md:pb-10">
          <div className="max-w-xl pb-4 sm:pb-6 md:pb-10">
            <h1 className="font-serif-italic max-w-3xl text-3xl leading-[1.12] tracking-tight text-balance sm:text-4xl md:text-5xl lg:text-6xl">
              {copy.hero.headline}
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-cream/90 md:text-lg">
              {copy.hero.sub}
            </p>
          </div>
          <div className="relative z-10">
            <BookingDesk />
          </div>
        </Container>
      </section>

      <section className="pt-24 pb-16 md:pt-32 md:pb-20">
        <Container>
          <p className="max-w-2xl text-lg leading-8 text-ink/80 md:text-xl">{copy.intro}</p>
        </Container>
      </section>

      <section className="pb-8">
        <Container className="space-y-16 md:space-y-24">
          <StayPanel group={singleBed} imageId="one-bed-01" priority />
          <StayPanel group={doubleBed} imageId="two-bed-01" reverse />
        </Container>
      </section>

      <section className="py-20 md:py-28">
        <div className="relative min-h-[28rem] md:min-h-[36rem]">
          <SiteImage id="camp-gazebos" className="absolute inset-0" sizes="100vw" />
          <div className="absolute inset-0 bg-lagoon-900/25" />
          <Container className="relative flex min-h-[28rem] items-end pb-10 md:min-h-[36rem]">
            <div className="max-w-md bg-cream p-6 text-ink md:p-8">
              <h2 className="font-serif text-3xl tracking-tight">Outside the room</h2>
              <p className="mt-4 text-base leading-7 text-ink/75">{copy.campLife}</p>
            </div>
          </Container>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <Container className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="relative min-h-[20rem] overflow-hidden md:min-h-[28rem]">
            <SiteImage id="food-thali" className="absolute inset-0" />
          </div>
          <div>
            <h2 className="font-serif text-3xl tracking-tight md:text-4xl">Meals at the camp</h2>
            <p className="mt-4 max-w-md text-base leading-7 text-ink/75">{copy.meals}</p>
            <Button href="/amenities" variant="secondary" className="mt-6">
              At the camp
            </Button>
          </div>
        </Container>
      </section>

      <section className="pb-20 md:pb-28">
        <Container>
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="font-serif text-3xl tracking-tight">From the grounds</h2>
            <Button href="/gallery" variant="secondary">
              Gallery
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <div className="relative col-span-2 aspect-[16/10] overflow-hidden">
              <SiteImage id="cottages" className="absolute inset-0" />
            </div>
            <div className="relative aspect-[4/5] overflow-hidden">
              <SiteImage id="camp-umbrellas" className="absolute inset-0" />
            </div>
            <div className="relative aspect-[4/5] overflow-hidden">
              <SiteImage id="night-pavilion" className="absolute inset-0" />
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-sand/40 py-20 md:py-24">
        <Container className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="font-serif text-3xl tracking-tight">{copy.locationLead}</h2>
            <div className="mt-4 space-y-1 text-ink/80">
              {hotel.addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button href={hotel.mapsUrl} variant="secondary">
                Open in Google Maps
              </Button>
              <Button href="/contact" variant="secondary">
                Contact
              </Button>
            </div>
          </div>
          <div className="relative min-h-[16rem] overflow-hidden md:min-h-[20rem]">
            <SiteImage id="camp-umbrellas" className="absolute inset-0" />
          </div>
        </Container>
      </section>

      <section className="bg-lagoon-900 py-16 text-cream md:py-20">
        <Container className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <h2 className="font-serif max-w-xl text-3xl tracking-tight md:text-4xl">{copy.closing}</h2>
          <Button href="/book" variant="ghost">
            Book now
          </Button>
        </Container>
      </section>
    </main>
  );
}
