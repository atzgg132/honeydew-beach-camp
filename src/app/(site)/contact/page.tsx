import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";
import { ContactForm } from "@/features/contact/ContactForm";
import { hotel } from "@/data/hotel";
import { formatTimeLabel } from "@/lib/dates";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <main className="pt-[var(--header)]">
      <Container className="grid gap-12 py-16 md:grid-cols-2 md:py-24">
        <div>
          <h1 className="font-serif text-4xl tracking-tight md:text-5xl">Contact</h1>
          <div className="mt-8 space-y-1 text-base leading-7">
            {hotel.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p className="mt-6 flex flex-col">
            {hotel.phones.map((phone) => (
              <a
                key={phone.id}
                className="inline-flex min-h-11 items-center underline decoration-honey underline-offset-4"
                href={`tel:+91${phone.number}`}
              >
                {phone.display}
              </a>
            ))}
          </p>
          <p>
            <a className="inline-flex min-h-11 items-center underline decoration-honey underline-offset-4" href={`mailto:${hotel.email}`}>
              {hotel.email}
            </a>
          </p>
          <p className="mt-6 text-sm text-ink/70">
            Check-in {formatTimeLabel(hotel.checkInTime)}. Check-out {formatTimeLabel(hotel.checkOutTime)}.
          </p>
          <Button href={hotel.mapsUrl} variant="secondary" className="mt-8">
            Open in Google Maps
          </Button>
          <p className="mt-6 text-sm leading-6 text-ink/70">
            Have a special request? Call the numbers above and the team will assist where possible.
          </p>
        </div>
        <div>
          <h2 className="font-serif text-2xl tracking-tight">Write to the camp</h2>
          <p className="mt-2 mb-6 text-sm text-ink/70">
            Mail is not wired yet. Use the phones or email on the left.
          </p>
          <ContactForm />
        </div>
      </Container>
    </main>
  );
}
