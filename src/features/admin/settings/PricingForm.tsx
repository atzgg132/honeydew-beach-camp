"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { adminPublishPolicy, adminPublishTariff, AdminApiError } from "@/features/admin/api";

export interface PricingState {
  tariffRevision: number;
  advanceBasisPoints: number;
  rates: Array<{
    roomGroupId: "single-bed" | "double-bed";
    tariffOccupancy: number;
    acMode: "ac" | "non-ac";
    ratePerPersonPaise: number;
  }>;
}

export function PricingForm({ initial }: { initial: PricingState }) {
  const router = useRouter();
  const [rates, setRates] = useState(initial.rates.map((rate) => ({ ...rate, rupees: String(rate.ratePerPersonPaise / 100) })));
  const [advance, setAdvance] = useState(String(initial.advanceBasisPoints / 100));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<"tariff" | "advance" | null>(null);

  function update(index: number, rupees: string) {
    setRates((current) => current.map((rate, rateIndex) => (rateIndex === index ? { ...rate, rupees } : rate)));
  }

  async function publishTariff() {
    setPending(true);
    setError(null);
    setMessage(null);
    const next = rates.map((rate) => ({
      roomGroupId: rate.roomGroupId,
      tariffOccupancy: rate.tariffOccupancy,
      acMode: rate.acMode,
      ratePerPersonPaise: Math.round(Number(rate.rupees) * 100),
    }));
    try {
      const result = await adminPublishTariff(next);
      setMessage(`Tariff revision ${result.revision} is live.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : "Tariff update failed.");
    } finally {
      setPending(false);
    }
  }

  async function publishAdvance() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await adminPublishPolicy(Number(advance));
      setMessage(`Advance is now ${result.advanceBasisPoints / 100}%.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : "Advance update failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
      <section>
        <h2 className="text-sm font-medium">Tariff, revision {initial.tariffRevision}</h2>
        <p className="mt-1 text-sm text-ink/65">Per person per night, in rupees. Existing bookings keep their snapshots.</p>
        <p className="mt-1 text-sm text-ink/65">
          Marketing room copy stays on the seeded revision until that copy is updated separately.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {rates.map((rate, index) => (
            <Field
              key={`${rate.roomGroupId}-${rate.tariffOccupancy}-${rate.acMode}`}
              id={`${rate.roomGroupId}-${rate.tariffOccupancy}-${rate.acMode}`}
              label={`${rate.roomGroupId === "single-bed" ? "Single" : "Double"}, ${rate.tariffOccupancy} ${rate.tariffOccupancy === 1 ? "guest" : "guests"}, ${rate.acMode === "ac" ? "AC" : "Non-AC"}`}
            >
              <TextInput
                id={`${rate.roomGroupId}-${rate.tariffOccupancy}-${rate.acMode}`}
                type="number"
                min={1}
                step={1}
                value={rate.rupees}
                onChange={(event) => update(index, event.target.value)}
              />
            </Field>
          ))}
        </div>
        <Button className="mt-4" type="button" disabled={pending} onClick={() => setConfirm("tariff")}>
          Publish tariff
        </Button>
      </section>
      <section>
        <h2 className="text-sm font-medium">Advance percentage</h2>
        <div className="mt-3 max-w-xs">
          <Field id="advance" label="Advance %">
            <TextInput id="advance" type="number" min={0} max={100} value={advance} onChange={(event) => setAdvance(event.target.value)} />
          </Field>
        </div>
        <Button className="mt-4" type="button" disabled={pending} onClick={() => setConfirm("advance")}>
          Publish advance
        </Button>
      </section>
      {confirm === "tariff" ? (
        <ConfirmDialog
          title="Publish this tariff?"
          confirmLabel="Publish tariff"
          cancelLabel="Keep editing"
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            void publishTariff();
          }}
        >
          <p>New website quotes use these rates. Bookings already made keep the old snapshot.</p>
        </ConfirmDialog>
      ) : null}
      {confirm === "advance" ? (
        <ConfirmDialog
          title="Publish this advance?"
          confirmLabel="Publish advance"
          cancelLabel="Keep editing"
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            void publishAdvance();
          }}
        >
          <p>New quotes take {advance}% as the advance. Existing stays are unchanged.</p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
