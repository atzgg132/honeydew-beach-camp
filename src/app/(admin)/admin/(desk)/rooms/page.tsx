import Link from "next/link";
import { RoomsBoard } from "@/features/admin/rooms/RoomsBoard";
import { addDays, todayIstDate } from "@/lib/dates";
import { getRoomGrid } from "@/server/services/admin-inventory";

export default async function AdminRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const from = (await searchParams).from ?? todayIstDate();
  const grid = await getRoomGrid(from, 14);
  const prev = addDays(from, -7);
  const next = addDays(from, 7);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Rooms</h1>
          <p className="text-sm text-ink/65">Fourteen days from {from}. Tap a block to release it.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href={`/admin/rooms?from=${prev}`} className="underline-offset-2 hover:underline">
            Previous week
          </Link>
          <Link href={`/admin/rooms?from=${next}`} className="underline-offset-2 hover:underline">
            Next week
          </Link>
        </div>
      </div>
      <RoomsBoard grid={grid} />
    </div>
  );
}
