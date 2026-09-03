import Link from "next/link";
import { Suspense } from "react";
import { BookingCards } from "@/features/admin/bookings/BookingList";
import { BookingFilters } from "@/features/admin/bookings/BookingFilters";
import { listStaffBookings, parseAdminBookingListQuery } from "@/server/services/admin-booking-query";

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
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Bookings</h1>
          <p className="text-sm text-ink/65">{result.total} in this view</p>
        </div>
        <Link href="/admin/bookings/new" className="text-sm underline-offset-2 hover:underline">
          New booking
        </Link>
      </div>
      <Suspense>
        <BookingFilters />
      </Suspense>
      <BookingCards bookings={result.bookings} />
    </div>
  );
}
