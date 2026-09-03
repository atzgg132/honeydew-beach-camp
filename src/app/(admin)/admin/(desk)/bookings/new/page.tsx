import { NewBookingForm } from "@/features/admin/bookings/NewBookingForm";
import { addDays, todayIstDate } from "@/lib/dates";

export default function AdminNewBookingPage() {
  const checkIn = todayIstDate();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-medium tracking-tight">New booking</h1>
      <p className="text-sm text-ink/65">Phone and walk-in stays use the same prices and rooms as the website.</p>
      <NewBookingForm checkIn={checkIn} checkOut={addDays(checkIn, 1)} />
    </div>
  );
}
