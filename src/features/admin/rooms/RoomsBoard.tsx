"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { adminCreateBlock, adminReleaseBlock, AdminApiError } from "@/features/admin/api";
import { addDays, todayIstDate } from "@/lib/dates";
import { cn } from "@/lib/cn";

export interface RoomGrid {
  from: string;
  days: number;
  dates: string[];
  rooms: Array<{
    id: string;
    roomNumber: string;
    roomGroupId: string;
    supportsAc: boolean;
    cells: Array<{
      date: string;
      state: "free" | "held" | "booked" | "blocked";
      bookingId?: string | null;
      reference?: string | null;
      acMode?: string;
      blockId?: string | null;
      reason?: string;
    }>;
  }>;
}

export function RoomsBoard({ grid }: { grid: RoomGrid }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState(grid.rooms[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(todayIstDate());
  const [checkOut, setCheckOut] = useState(addDays(todayIstDate(), 1));
  const [reason, setReason] = useState("Maintenance");

  return (
    <div className="flex flex-col gap-5">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="overflow-x-auto">
        <table className="min-w-[48rem] border-collapse text-left text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-cream py-2 pr-3 font-medium">Room</th>
              {grid.dates.map((date) => (
                <th key={date} className="min-w-16 py-2 pr-2 font-medium text-ink/60">
                  {date.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rooms.map((room) => (
              <tr key={room.id} className="border-t border-line/70">
                <th className="sticky left-0 bg-cream py-2 pr-3 text-left font-medium">
                  {room.roomNumber}
                  <span className="block text-[10px] font-normal text-ink/50">
                    {room.roomGroupId === "single-bed" ? "Single" : "Double"}
                  </span>
                </th>
                {room.cells.map((cell) => (
                  <td key={cell.date} className="py-1 pr-1">
                    {cell.state === "free" ? (
                      <span className="block rounded-sm bg-mist/40 px-1 py-2 text-center text-ink/50">Free</span>
                    ) : cell.state === "blocked" ? (
                      <button
                        type="button"
                        className="block w-full rounded-sm bg-sand px-1 py-2 text-center"
                        onClick={() => {
                          if (!cell.blockId) return;
                          void adminReleaseBlock(cell.blockId)
                            .then(() => router.refresh())
                            .catch((caught) => setError(caught instanceof AdminApiError ? caught.message : "Unblock failed."));
                        }}
                      >
                        Block
                      </button>
                    ) : (
                      <Link
                        href={cell.bookingId ? `/admin/bookings/${cell.bookingId}` : "/admin/bookings"}
                        className={cn(
                          "block rounded-sm px-1 py-2 text-center text-cream",
                          cell.state === "held" ? "bg-honey" : "bg-lagoon-900",
                        )}
                      >
                        {cell.acMode === "ac" ? "AC" : "N"}
                      </Link>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="grid gap-3 rounded-[6px] border border-line bg-cream-raised p-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          void adminCreateBlock({ roomId, checkIn, checkOut, reason })
            .then(() => router.refresh())
            .catch((caught) => setError(caught instanceof AdminApiError ? caught.message : "Block failed."));
        }}
      >
        <label className="text-xs">
          Room
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)} className="mt-1 h-11 w-full rounded-[6px] border border-line bg-cream px-3 text-sm">
            {grid.rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.roomNumber}
              </option>
            ))}
          </select>
        </label>
        <Field id="block-from" label="From">
          <TextInput id="block-from" type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} />
        </Field>
        <Field id="block-to" label="Until">
          <TextInput id="block-to" type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} />
        </Field>
        <Field id="reason" label="Reason">
          <TextInput id="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <Button type="submit">Block dates</Button>
      </form>
    </div>
  );
}
