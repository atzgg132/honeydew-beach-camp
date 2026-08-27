"use client";

import { Minus, Plus } from "@phosphor-icons/react";
import type { GuestComposition } from "@/types";
import { copy } from "@/data/copy";

function Row({
  label,
  hint,
  value,
  min,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-ink/65">{hint}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-[6px] border border-line"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Decrease ${label}`}
        >
          <Minus size={16} />
        </button>
        <span className="w-6 text-center text-sm tabular-nums">{value}</span>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-[6px] border border-line"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

export function GuestStepper({
  value,
  onChange,
}: {
  value: GuestComposition;
  onChange: (value: GuestComposition) => void;
}) {
  return (
    <div>
      <Row
        label="Adults"
        hint={copy.occupancyAdultsHint}
        value={value.adults}
        min={1}
        onChange={(adults) => onChange({ ...value, adults })}
      />
      <Row
        label="Children under 5"
        hint="No charge. Counted in the room."
        value={value.childrenUnder5}
        min={0}
        onChange={(childrenUnder5) => onChange({ ...value, childrenUnder5 })}
      />
      <Row
        label="Children 5 to 10"
        hint="Half the guest tariff."
        value={value.children5to10}
        min={0}
        onChange={(children5to10) => onChange({ ...value, children5to10 })}
      />
    </div>
  );
}
