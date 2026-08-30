import { getRoomGroup } from "@/data/rooms";
import { copy } from "@/data/copy";
import { formatInr } from "@/lib/format";
import { formatComposition, formatNightPhrase } from "@/lib/booking/occupancy";
import type { BookingPricingSnapshot, BookingStatus } from "@/types";

export function PriceBreakdown({
  snapshot,
  recorded,
}: {
  snapshot: BookingPricingSnapshot;
  recorded?: {
    advancePaid: number;
    outstanding: number;
    status?: BookingStatus;
  };
}) {
  const cancelled = recorded?.status === "cancelled";
  const advance = recorded ? recorded.advancePaid : snapshot.advance;
  const balance = recorded ? recorded.outstanding : snapshot.balance;
  const advanceLabel = recorded ? "Advance paid" : `Advance (${snapshot.advancePercent}%)`;
  const balanceLabel = cancelled ? "Outstanding" : "Balance at the hotel";

  return (
    <div className="space-y-6">
      {snapshot.rooms.map((room, index) => {
        const group = getRoomGroup(room.roomGroupId);
        return (
          <section key={`${room.roomGroupId}-${index}`} className="border-t border-line pt-4">
            <h3 className="text-sm font-medium tracking-wide">
              Room {index + 1} · {group?.publicName}
            </h3>
            <p className="mt-1 text-sm text-ink/70">
              {formatComposition(room.composition)} · {room.acMode === "ac" ? "AC included" : "Non-AC"}
            </p>
            <p className="mt-2 text-sm text-ink/70">
              {formatInr(room.nightlyTotal)} a night · {formatNightPhrase(room.nights)}
            </p>
            <p className="mt-1 text-base font-medium">{formatInr(room.stayTotal)}</p>
          </section>
        );
      })}
      <dl className="divide-y divide-line border-t border-line text-sm">
        <div className="flex justify-between gap-4 py-2">
          <dt>Stay total</dt>
          <dd>{formatInr(snapshot.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt>{advanceLabel}</dt>
          <dd>{formatInr(advance)}</dd>
        </div>
        <div className="flex justify-between gap-4 py-2 font-medium">
          <dt>{balanceLabel}</dt>
          <dd>{formatInr(balance)}</dd>
        </div>
      </dl>
      {recorded ? (
        <p className="text-xs text-ink/60">
          {copy.rateQualifier}. {copy.mealsIncluded}
        </p>
      ) : (
        <p className="text-xs text-ink/60">
          {copy.rateQualifier}. {copy.mealsIncluded} {copy.advanceNote}
        </p>
      )}
    </div>
  );
}
