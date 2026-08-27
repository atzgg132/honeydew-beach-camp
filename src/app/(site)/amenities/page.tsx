import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { SiteImage } from "@/components/media/SiteImage";
import { amenities } from "@/data/amenities";

export const metadata: Metadata = { title: "Amenities" };

export default function AmenitiesPage() {
  return (
    <main className="pt-[var(--header)]">
      <Container className="grid gap-12 py-16 md:grid-cols-[0.9fr_1.1fr] md:py-24">
        <div>
          <h1 className="font-serif text-4xl tracking-tight md:text-5xl">At the camp</h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-ink/75">
            Meals are included in the stay charges. Wi-Fi, a generator, and outdoor seating sit
            alongside the rooms.
          </p>
          <ul className="mt-10 space-y-8">
            {amenities.map((item) => (
              <li key={item.id}>
                <h2 className="font-serif text-xl tracking-tight">{item.title}</h2>
                <p className="mt-2 max-w-md text-base leading-7 text-ink/75">{item.description}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4">
          <div className="relative min-h-[16rem] overflow-hidden md:min-h-[22rem]">
            <SiteImage id="food-thali" className="absolute inset-0" priority />
          </div>
          <div className="relative min-h-[14rem] overflow-hidden">
            <SiteImage id="camp-umbrellas" className="absolute inset-0" />
          </div>
        </div>
      </Container>
    </main>
  );
}
