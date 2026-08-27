import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";
import { hotel } from "@/data/hotel";

const nav = [
  { href: "/rooms", label: "Rooms" },
  { href: "/gallery", label: "Gallery" },
  { href: "/amenities", label: "Amenities" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/policies", label: "Policies" },
  { href: "/manage-booking", label: "Manage booking" },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-lagoon-900 pb-16 text-cream lg:pb-0">
      <Container className="grid gap-10 py-14 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Logo variant="lockup" />
          <p className="mt-4 max-w-xs text-sm leading-6 text-cream/80">
            {hotel.localityLabel}. Rooms with or without air-conditioning. Meals included.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="inline-flex min-h-11 items-center hover:text-honey">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="text-sm leading-7">
          {hotel.addressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="mt-3 flex flex-col gap-1">
            {hotel.phones.map((phone) => (
              <a key={phone.id} className="inline-flex min-h-11 items-center hover:text-honey" href={`tel:+91${phone.number}`}>
                {phone.display}
              </a>
            ))}
          </p>
          <p>
            <a className="inline-flex min-h-11 items-center hover:text-honey" href={`mailto:${hotel.email}`}>
              {hotel.email}
            </a>
          </p>
          <Button href="/book" variant="ghost" className="mt-5">
            Book now
          </Button>
        </div>
      </Container>
      <Container className="border-t border-cream/15 py-5 text-xs text-cream/60">
        Honey Dew Beach Camp
      </Container>
    </footer>
  );
}
