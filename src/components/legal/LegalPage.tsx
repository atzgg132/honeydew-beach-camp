import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { hotel } from "@/data/hotel";

export const legalUpdatedOn = "5 September 2026";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="pt-[var(--header)]">
      <Container className="py-16 md:py-24">
        <p className="text-sm uppercase tracking-[0.16em] text-ink/50">{hotel.name}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-ink/75">{intro}</p>
        <p className="mt-3 text-sm text-ink/60">Last updated: {legalUpdatedOn}.</p>
        <div className="mt-12 max-w-3xl space-y-12">{children}</div>
        <aside className="mt-14 max-w-3xl border border-line bg-cream-raised p-6">
          <h2 className="font-serif text-xl tracking-tight">Contact {hotel.shortName}</h2>
          <div className="mt-3 space-y-1 text-sm leading-6 text-ink/80">
            {hotel.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p>{hotel.district}</p>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {hotel.phones.map((phone) => (
              <a
                key={phone.id}
                className="underline decoration-honey underline-offset-4"
                href={`tel:+91${phone.number}`}
              >
                +91 {phone.display}
              </a>
            ))}
            <a
              className="underline decoration-honey underline-offset-4"
              href={`mailto:${hotel.email}`}
            >
              {hotel.email}
            </a>
          </p>
          <p className="mt-3 text-sm text-ink/70">
            Support hours: {hotel.supportHours}. {hotel.responseNote}
          </p>
        </aside>
      </Container>
    </main>
  );
}

export function LegalSection({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="font-serif text-2xl tracking-tight">
        {heading}
      </h2>
      <div className="mt-3 space-y-3 text-base leading-7 text-ink/80">{children}</div>
    </section>
  );
}
