import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/Button";
import { BookingCards } from "@/features/admin/bookings/BookingList";
import { BookingFilters } from "@/features/admin/bookings/BookingFilters";
import { listStaffBookings, parseAdminBookingListQuery } from "@/server/services/admin-booking-query";

export const metadata: Metadata = { title: "Bookings" };

function pageHref(search: URLSearchParams, page: number) {
  const next = new URLSearchParams(search);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const query = next.toString();
  return query ? `/admin/bookings?${query}` : "/admin/bookings";
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
  }
  const result = await listStaffBookings(parseAdminBookingListQuery(params));
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.page * result.pageSize, result.total);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Bookings</h1>
          <p className="text-sm text-ink/65">
            Showing {from} to {to} of {result.total}
          </p>
        </div>
        <Button href="/admin/bookings/new">New booking</Button>
      </div>
      <Suspense>
        <BookingFilters />
      </Suspense>
      <BookingCards bookings={result.bookings} emptyLabel="No stays match these filters." />
      {pages > 1 ? (
        <div className="flex flex-wrap gap-3 text-sm">
          {result.page > 1 ? (
            <Link href={pageHref(params, result.page - 1)} className="underline-offset-2 hover:underline">
              Previous
            </Link>
          ) : null}
          {result.page < pages ? (
            <Link href={pageHref(params, result.page + 1)} className="underline-offset-2 hover:underline">
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
