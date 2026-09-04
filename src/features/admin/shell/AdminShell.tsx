"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarBlank, CurrencyInr, Door, DotsThree, House, Receipt, SignOut } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/Logo";
import { adminLogout } from "@/features/admin/api";
import { cn } from "@/lib/cn";

const desktopLinks = [
  { href: "/admin", label: "Today", icon: House },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarBlank },
  { href: "/admin/rooms", label: "Rooms", icon: Door },
  { href: "/admin/refunds", label: "Refunds", icon: Receipt },
  { href: "/admin/pricing", label: "Pricing", icon: CurrencyInr },
] as const;

const mobileLinks = [desktopLinks[0], desktopLinks[1], desktopLinks[2]] as const;

function active(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/bookings") {
    return pathname === "/admin/bookings" || /^\/admin\/bookings\/(?!new(?:\/|$)).+/.test(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function moreActive(pathname: string) {
  return (
    pathname === "/admin/bookings/new" ||
    pathname.startsWith("/admin/bookings/new/") ||
    pathname === "/admin/refunds" ||
    pathname.startsWith("/admin/refunds/") ||
    pathname === "/admin/pricing" ||
    pathname.startsWith("/admin/pricing/")
  );
}

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await adminLogout().catch(() => undefined);
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-cream text-ink">
      <a
        href="#desk-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-cream focus:px-3 focus:py-2"
      >
        Skip to desk
      </a>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-cream px-4 lg:hidden">
        <Logo href="/admin" variant="mark" wordmark className="text-ink" />
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-xs text-ink/65">{email}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[6px] text-ink/70 hover:bg-sand/50"
            aria-label="Sign out"
          >
            <SignOut size={16} />
          </button>
        </div>
      </header>
      <div className="lg:flex">
        <aside className="hidden w-56 shrink-0 border-r border-line bg-cream-raised lg:flex lg:min-h-dvh lg:flex-col">
          <div className="border-b border-line px-4 py-4">
            <Logo href="/admin" variant="mark" wordmark className="text-ink" />
            <p className="mt-3 text-xs text-ink/60">{email}</p>
          </div>
          <nav aria-label="Desk" className="flex flex-1 flex-col gap-1 p-3">
            {desktopLinks.map((link) => {
              const isActive = active(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-[6px] px-3 text-sm",
                    isActive ? "bg-lagoon-900 text-cream" : "text-ink/80 hover:bg-sand/50",
                  )}
                >
                  <link.icon size={16} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => void signOut()}
            className="m-3 flex min-h-11 items-center gap-2 rounded-[6px] px-3 text-left text-sm text-ink/70 hover:bg-sand/50"
          >
            <SignOut size={16} />
            Sign out
          </button>
        </aside>
        <main id="desk-content" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-24 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>
      <nav aria-label="Desk" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-cream lg:hidden">
        {mobileLinks.map((link) => {
          const isActive = active(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]",
                isActive ? "text-lagoon-900" : "text-ink/55",
              )}
            >
              <link.icon size={18} />
              {link.label}
            </Link>
          );
        })}
        <details className="relative">
          <summary
            className={cn(
              "flex min-h-14 list-none flex-col items-center justify-center gap-1 text-[11px] [&::-webkit-details-marker]:hidden",
              moreActive(pathname) ? "text-lagoon-900" : "text-ink/55",
            )}
          >
            <DotsThree size={18} />
            More
          </summary>
          <div className="absolute bottom-full right-2 mb-2 w-44 rounded-[6px] border border-line bg-cream-raised p-2 shadow-[0_12px_32px_rgb(14_74_77/0.16)]">
            <Link href="/admin/bookings/new" className="block min-h-11 px-3 py-2 text-sm">
              New booking
            </Link>
            <Link href="/admin/refunds" className="block min-h-11 px-3 py-2 text-sm">
              Refunds
            </Link>
            <Link href="/admin/pricing" className="block min-h-11 px-3 py-2 text-sm">
              Pricing
            </Link>
            <button type="button" onClick={() => void signOut()} className="block w-full min-h-11 px-3 py-2 text-left text-sm">
              Sign out
            </button>
          </div>
        </details>
      </nav>
    </div>
  );
}
