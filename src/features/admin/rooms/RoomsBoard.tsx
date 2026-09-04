"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { adminCreateBlock, adminReleaseBlock, AdminApiError } from "@/features/admin/api";
import { addDays, formatShortDate, todayIstDate } from "@/lib/dates";
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
      guestName?: string | null;
      acMode?: string;
      blockId?: string | null;
      reason?: string;
    }>;
  }>;
}

function cellLabel(cell: RoomGrid["rooms"][number]["cells"][number]) {
  if (cell.state === "free") return "Free";
  if (cell.state === "blocked") return "Block";
  const who = cell.reference ?? cell.guestName ?? "Stay";
  return cell.state === "held" ? `Hold ${who}` : who;
}

export function RoomsBoard({ grid }: { grid: RoomGrid }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [roomId, setRoomId] = useState(grid.rooms[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(todayIstDate());
  const [until, setUntil] = useState(todayIstDate());
  const [reason, setReason] = useState("Maintenance");
  const [release, setRelease] = useState<{ blockId: string; reason: string } | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/70">
        <li>
          <span className="mr-1 inline-block rounded-sm bg-mist/40 px-1">Free</span>
          empty
        </li>
        <li>
          <span className="mr-1 inline-block rounded-sm bg-lagoon-900 px-1 text-cream">HD-…</span>
          booked
        </li>
        <li>
          <span className="mr-1 inline-block rounded-sm bg-honey px-1 text-cream">Hold</span>
          unpaid hold
        </li>
        <li>
          <span className="mr-1 inline-block rounded-sm bg-sand px-1">Block</span>
          maintenance
        </li>
      </ul>
      <div className="overflow-x-auto">
        <table className="min-w-[48rem] border-collapse text-left text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-cream py-2 pr-3 font-medium">Room</th>
              {grid.dates.map((date) => (
                <th key={date} className="min-w-16 py-2 pr-2 font-medium text-ink/60">
                  {formatShortDate(date)}
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
                        title={cell.reason}
                        className="block w-full rounded-sm bg-sand px-1 py-2 text-center"
                        onClick={() => {
                          if (!cell.blockId) return;
                          setRelease({ blockId: cell.blockId, reason: cell.reason ?? "" });
                        }}
                      >
                        Block
                      </button>
                    ) : (
                      <Link
                        href={cell.bookingId ? `/admin/bookings/${cell.bookingId}` : "/admin/bookings"}
                        title={cell.guestName ?? undefined}
                        className={cn(
                          "block rounded-sm px-1 py-2 text-center text-cream",
                          cell.state === "held" ? "bg-honey" : "bg-lagoon-900",
                        )}
                      >
                        {cellLabel(cell)}
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
          setPending(true);
          setError(null);
          void adminCreateBlock({ roomId, checkIn, checkOut: addDays(until, 1), reason })
            .then(() => router.refresh())
            .catch((caught) => setError(caught instanceof AdminApiError ? caught.message : "Block failed."))
            .finally(() => setPending(false));
        }}
      >
        <Field id="block-room" label="Room">
          <Select id="block-room" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            {grid.rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.roomNumber}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="block-from" label="From">
          <TextInput id="block-from" type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} />
        </Field>
        <Field id="block-to" label="Until" hint="Last night the room stays blocked.">
          <TextInput id="block-to" type="date" value={until} onChange={(event) => setUntil(event.target.value)} />
        </Field>
        <Field id="reason" label="Reason">
          <TextInput id="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <Button type="submit" disabled={pending}>
          Block dates
        </Button>
      </form>
      {release ? (
        <ConfirmDialog
          title="Release this block?"
          confirmLabel="Release block"
          cancelLabel="Keep block"
          danger
          onClose={() => setRelease(null)}
          onConfirm={() => {
            const blockId = release.blockId;
            setRelease(null);
            void adminReleaseBlock(blockId)
              .then(() => router.refresh())
              .catch((caught) => setError(caught instanceof AdminApiError ? caught.message : "Unblock failed."));
          }}
        >
          <p>{release.reason ? `${release.reason}. ` : ""}The room will show as free for those dates.</p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
