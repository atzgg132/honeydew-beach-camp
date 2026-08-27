"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/cn";

const links = [
  { href: "/rooms", label: "Rooms" },
  { href: "/gallery", label: "Gallery" },
  { href: "/amenities", label: "Amenities" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/manage-booking", label: "Manage booking" },
];

export function Header({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuForPath, setMenuForPath] = useState(pathname);
  const [solid, setSolid] = useState(!overlay);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  if (menuForPath !== pathname) {
    setMenuForPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!overlay) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setSolid(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [overlay]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const root = dialogRef.current;
    if (!root) return;
    const items = () =>
      [...root.querySelectorAll<HTMLElement>("a, button")].filter((item) => !item.hasAttribute("disabled"));
    items()[0]?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const list = items();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const light = overlay && !solid && !open;

  return (
    <>
      {overlay ? <div ref={sentinelRef} className="absolute top-0 h-2 w-full" aria-hidden /> : null}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 h-[var(--header)] transition-colors duration-200 motion-reduce:transition-none",
          light ? "bg-transparent text-cream" : "bg-cream/95 text-ink shadow-[0_1px_0_var(--line)] backdrop-blur-sm",
        )}
      >
        <Container className="flex h-full items-center gap-3 md:gap-4">
          <Logo variant="mark" priority wordmark />
          <nav className="ml-auto hidden items-center gap-4 lg:flex xl:gap-6" aria-label="Primary">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "whitespace-nowrap text-sm tracking-wide hover:opacity-80",
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? "text-honey"
                    : "",
                )}
              >
                {link.label}
              </Link>
            ))}
            <Button href="/book" variant={light ? "on-hero" : "primary"} className="ml-1 shrink-0">
              Book now
            </Button>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:hidden">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen(true)}
            >
              <List size={26} />
              <span className="sr-only">Open menu</span>
            </button>
          </div>
        </Container>
      </header>

      {open ? (
        <div
          ref={dialogRef}
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex flex-col bg-cream text-ink"
        >
          <div className="flex h-[var(--header)] items-center justify-between gap-3 px-5">
            <Logo variant="mark" wordmark />
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center"
              onClick={() => setOpen(false)}
            >
              <X size={26} />
              <span className="sr-only">Close menu</span>
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-2 px-6 pt-6" aria-label="Mobile">
            <p id={titleId} className="sr-only">
              Site menu
            </p>
            <Link href="/" className="py-3 text-2xl" onClick={() => setOpen(false)}>
              Home
            </Link>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="py-3 text-2xl"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="px-6 pb-8">
            <Button href="/book" className="w-full">
              Book now
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
