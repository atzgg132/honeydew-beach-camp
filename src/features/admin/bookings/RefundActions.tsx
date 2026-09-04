"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, TextInput } from "@/components/ui/Field";
import { adminRefundAction } from "@/features/admin/api";
import { formatInrPaise } from "@/lib/format";

export function RefundActions({
  cancellationId,
  refundStatus,
  refundablePaise,
  slabLabel,
  pending,
  onRun,
}: {
  cancellationId: string;
  refundStatus: string;
  refundablePaise: number;
  slabLabel: string;
  pending: boolean;
  onRun: (action: () => Promise<unknown>, success: string) => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const review = refundStatus === "PENDING_HOTEL_REVIEW";
  const approved = refundStatus === "APPROVED";
  if (!review && !approved) return null;

  return (
    <div>
      <p className="text-sm text-ink/70">
        {slabLabel}. Refundable {formatInrPaise(refundablePaise)}.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {review ? (
          <>
            <Button type="button" disabled={pending} onClick={() => onRun(() => adminRefundAction(cancellationId, { action: "approve" }), "Refund approved.")}>
              Approve
            </Button>
            <Button type="button" variant="danger" disabled={pending} onClick={() => setRejectOpen(true)}>
              Reject
            </Button>
          </>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const rupees = Number(new FormData(event.currentTarget).get("refund"));
              onRun(
                () =>
                  adminRefundAction(cancellationId, {
                    action: "process",
                    actualRefundPaise: Math.round(rupees * 100),
                  }),
                "Refund marked processed.",
              );
            }}
          >
            <Field id={`refund-${cancellationId}`} label="Returned (₹)">
              <TextInput
                id={`refund-${cancellationId}`}
                name="refund"
                type="number"
                min={0}
                step={1}
                defaultValue={Math.round(refundablePaise / 100)}
              />
            </Field>
            <Button type="submit" disabled={pending}>
              Mark processed
            </Button>
          </form>
        )}
      </div>
      {rejectOpen ? (
        <ConfirmDialog
          title="Reject this refund?"
          confirmLabel="Reject refund"
          cancelLabel="Keep queued"
          danger
          onClose={() => setRejectOpen(false)}
          onConfirm={() => {
            setRejectOpen(false);
            onRun(() => adminRefundAction(cancellationId, { action: "reject" }), "Refund rejected.");
          }}
        >
          <p>The stay stays cancelled. No money is marked returned.</p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
