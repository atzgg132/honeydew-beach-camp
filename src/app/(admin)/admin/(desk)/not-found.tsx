import { Button } from "@/components/ui/Button";

export default function DeskNotFound() {
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-medium tracking-tight">Stay not found</h1>
      <p className="mt-3 text-sm text-ink/70">That booking is not on the desk.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button href="/admin">Today</Button>
        <Button href="/admin/bookings" variant="secondary">
          Bookings
        </Button>
      </div>
    </div>
  );
}
