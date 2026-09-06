"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, TextInput } from "@/components/ui/Field";
import { AdminApiError, adminExecuteOnlineRefund, adminRefundAction, adminRequestRefundOtp } from "@/features/admin/api";
import { formatInrPaise } from "@/lib/format";

export function RefundActions({
  cancellationId,
  refundStatus,
  refundablePaise,
  slabLabel,
  autoRefund,
  pending,
  onRun,
}: {
  cancellationId: string;
  refundStatus: string;
  refundablePaise: number;
  slabLabel: string;
  autoRefund?: { eligible: boolean; capturedPaise: number };
  pending: boolean;
  onRun: (action: () => Promise<unknown>, success: string) => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const review = refundStatus === "PENDING_HOTEL_REVIEW";
  const approved = refundStatus === "APPROVED";
  if (!review && !approved) return null;

  async function requestCode() {
    setOtpBusy(true);
    setOtpError(null);
    try {
      const challenge = await adminRequestRefundOtp(cancellationId);
      setChallengeId(challenge.challengeId);
    } catch (caught) {
      setOtpError(caught instanceof AdminApiError ? caught.message : "The code could not be sent.");
    } finally {
      setOtpBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-ink/70">
        {slabLabel}. Refundable {formatInrPaise(refundablePaise)}.
      </p>
      {approved && autoRefund?.eligible ? (
        <div className="mt-3 rounded-[6px] border border-line p-3">
          <p className="text-sm font-medium">Refund online to the original payment method</p>
          <p className="mt-1 text-sm text-ink/70">
            Captured online {formatInrPaise(autoRefund.capturedPaise)}. A one-time approval code is mailed to the OTP
            inbox and must be entered before Razorpay is called.
          </p>
          {challengeId ? (
            <form
              className="mt-2 flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const otp = String(form.get("otp") ?? "").trim();
                const rupees = Number(form.get("onlineRefund"));
                setOtpError(null);
                onRun(
                  () =>
                    adminExecuteOnlineRefund(cancellationId, {
                      challengeId,
                      otp,
                      actualRefundPaise: Math.round(rupees * 100),
                    }).then((result) => {
                      setChallengeId(null);
                      return result;
                    }),
                  "Online refund sent to Razorpay.",
                );
              }}
            >
              <Field id={`otp-${cancellationId}`} label="Approval code">
                <TextInput
                  id={`otp-${cancellationId}`}
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  minLength={6}
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="6-digit code"
                  required
                />
              </Field>
              <Field id={`online-refund-${cancellationId}`} label="Refund (₹)">
                <TextInput
                  id={`online-refund-${cancellationId}`}
                  name="onlineRefund"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={Math.round(Math.min(refundablePaise, autoRefund?.capturedPaise ?? refundablePaise) / 100)}
                  required
                />
              </Field>
              <Button type="submit" disabled={pending}>
                Confirm online refund
              </Button>
              <Button type="button" variant="secondary" disabled={pending || otpBusy} onClick={() => void requestCode()}>
                Resend code
              </Button>
            </form>
          ) : (
            <div className="mt-2">
              <Button type="button" disabled={pending || otpBusy} onClick={() => void requestCode()}>
                {otpBusy ? "Sending code…" : "Send approval code"}
              </Button>
            </div>
          )}
          {otpError ? <p className="mt-2 text-sm text-danger">{otpError}</p> : null}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {approved && autoRefund?.eligible ? (
          <p className="w-full text-sm text-ink/70">Or record a refund paid outside Razorpay:</p>
        ) : null}
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
              const form = new FormData(event.currentTarget);
              const rupees = Number(form.get("refund"));
              const reference = String(form.get("reference") ?? "").trim();
              onRun(
                () =>
                  adminRefundAction(cancellationId, {
                    action: "process",
                    actualRefundPaise: Math.round(rupees * 100),
                    ...(reference ? { reference } : {}),
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
            <Field id={`reference-${cancellationId}`} label="RRN / refund reference">
              <TextInput
                id={`reference-${cancellationId}`}
                name="reference"
                autoComplete="off"
                minLength={6}
                maxLength={64}
                placeholder="12-digit UTR/RRN"
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
