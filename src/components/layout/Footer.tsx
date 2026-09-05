import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";
import { hotel } from "@/data/hotel";

const explore = [
  { href: "/rooms", label: "Rooms" },
  { href: "/gallery", label: "Gallery" },
  { href: "/amenities", label: "Amenities" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/manage-booking", label: "Manage booking" },
];

const legal = [
  { href: "/policies", label: "Guest policies" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/refunds", label: "Refunds & Cancellations" },
  { href: "/privacy", label: "Privacy Policy" },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-line bg-lagoon-900 pb-16 text-cream lg:pb-0">
      <Container className="grid gap-10 py-14 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
        <div>
          <Logo variant="lockup" />
          <p className="mt-4 max-w-xs text-sm leading-6 text-cream/80">
            {hotel.localityLabel}. Rooms with or without air-conditioning. Meals included.
          </p>
          <p className="mt-2 max-w-xs text-sm leading-6 text-cream/60">
            All prices in Indian Rupees (INR).
          </p>
        </div>
        <nav aria-label="Explore" className="flex flex-col gap-1 text-sm">
          <p className="mb-2 text-xs uppercase tracking-[0.16em] text-cream/50">Explore</p>
          {explore.map((item) => (
            <Link key={item.href} href={item.href} className="inline-flex min-h-11 items-center hover:text-honey">
              {item.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Legal" className="flex flex-col gap-1 text-sm">
          <p className="mb-2 text-xs uppercase tracking-[0.16em] text-cream/50">Legal</p>
          {legal.map((item) => (
            <Link key={item.href} href={item.href} className="inline-flex min-h-11 items-center hover:text-honey">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="text-sm leading-7">
          <p className="mb-2 text-xs uppercase tracking-[0.16em] text-cream/50">Contact</p>
          {hotel.addressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p>{hotel.district}</p>
          <p className="mt-3 flex flex-col gap-1">
            {hotel.phones.map((phone) => (
              <a key={phone.id} className="inline-flex min-h-11 items-center hover:text-honey" href={`tel:+91${phone.number}`}>
                +91 {phone.display}
              </a>
            ))}
          </p>
          <p>
            <a className="inline-flex min-h-11 items-center hover:text-honey" href={`mailto:${hotel.email}`}>
              {hotel.email}
            </a>
          </p>
          <p className="mt-2 text-xs leading-5 text-cream/60">Support hours: {hotel.supportHours}.</p>
          <Button href="/book" variant="ghost" className="mt-5">
            Book now
          </Button>
        </div>
      </Container>
      <Container className="border-t border-cream/15 py-5 text-xs text-cream/60">
        © {year} {hotel.name}. All rights reserved.
      </Container>
    </footer>
  );
}
