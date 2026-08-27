import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { GalleryMosaic } from "@/features/gallery/GalleryMosaic";

export const metadata: Metadata = { title: "Gallery" };

export default function GalleryPage() {
  return (
    <main className="pt-[var(--header)]">
      <Container className="py-16 md:py-24">
        <h1 className="font-serif text-4xl tracking-tight md:text-5xl">Gallery</h1>
        <p className="mt-4 max-w-xl text-lg text-ink/75">
          Rooms, meals, and the camp grounds at Honey Dew Beach Camp.
        </p>
        <div className="mt-12">
          <GalleryMosaic />
        </div>
      </Container>
    </main>
  );
}
