"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import {
  adminAllocateUnallocated,
  adminNoteUnallocatedRefund,
  adminApplyGuestChange,
  adminApplyUpgrade,
  adminAssignableRooms,
  adminCancel,
  adminCancelQuote,
  adminCollect,
  adminExpireHold,
  adminQuoteGuestChange,
  adminQuoteUpgrade,
  adminReassign,
  adminUpdateContact,
  AdminApiError,
} from "@/features/admin/api";
import { RefundActions } from "@/features/admin/bookings/RefundActions";
import type { StaffBooking } from "@/features/admin/types";
import { useAdminAction } from "@/features/admin/ui/useAdminAction";
import { formatInrPaise } from "@/lib/format";

function deltaCopy(deltaPaise: number) {
  if (deltaPaise > 0) return `Adds ${formatInrPaise(deltaPaise)} to the stay.`;
  if (deltaPaise < 0) return `Reduces the stay by ${formatInrPaise(-deltaPaise)}.`;
  return "Price stays the same.";
}

export function BookingActions({ booking }: { booking: StaffBooking }) {
  const { error, message, pending, wrap, setError } = useAdminAction();
  const mutable = booking.rawStatus === "CONFIRMED" && booking.status !== "completed";
  const hold = booking.rawStatus === "PENDING_PAYMENT";
  const unallocated = booking.payments.some((payment) => payment.status === "PAID_UNALLOCATED");
  const refundOpen =
    booking.cancellation &&
    (booking.cancellation.refundStatus === "PENDING_HOTEL_REVIEW" || booking.cancellation.refundStatus === "APPROVED");
  const doNow = (mutable && booking.outstandingPaise > 0) || unallocated || refundOpen;

  const [guestQuote, setGuestQuote] = useState<{ quoteToken: string; deltaPaise: number; subtotalPaise: number } | null>(null);
  const [upgradeQuote, setUpgradeQuote] = useState<{
    roomId: string;
    quoteToken: string;
    deltaPaise: number;
    subtotalPaise: number;
  } | null>(null);
  const [cancelQuote, setCancelQuote] = useState<{ deductionPaise: number; refundablePaise: number; slabLabel: string } | null>(
    null,
  );
  const [dropHoldOpen, setDropHoldOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      {booking.status === "completed" ? <Notice>This stay has checked out. It is read-only.</Notice> : null}

      {doNow ? (
        <section className="rounded-[6px] border border-line p-4">
          <h2 className="text-sm font-medium">Do now</h2>
          <div className="mt-4 flex flex-col gap-6">
            {mutable && booking.outstandingPaise > 0 ? (
              <div>
                <h3 className="text-sm font-medium">Record collection</h3>
                <p className="mt-1 text-sm text-ink/65">Outstanding {formatInrPaise(booking.outstandingPaise)}.</p>
                <form
                  className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const rupees = Number(new FormData(event.currentTarget).get("rupees"));
                    void wrap(() => adminCollect(booking.id, Math.round(rupees * 100)), "Collection recorded.");
                  }}
                >
                  <Field id="rupees" label="Amount (₹)">
                    <TextInput id="rupees" name="rupees" type="number" min={1} step={1} required />
                  </Field>
                  <Button type="submit" disabled={pending}>
                    Record
                  </Button>
                </form>
              </div>
            ) : null}

            {unallocated ? (
              <div className="rounded-[6px] border border-honey/50 bg-mist/20 p-4">
                <h3 className="text-sm font-medium">Paid, unallocated</h3>
                <p className="mt-1 text-sm text-ink/70">
                  Money arrived after the hold lapsed. Allocate rooms or settle the refund out of band.
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => void wrap(() => adminAllocateUnallocated(booking.id), "Rooms allocated and booking confirmed.")}
                  >
                    Allocate and confirm
                  </Button>
                  <form
                    className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const note = String(new FormData(event.currentTarget).get("note") ?? "");
                      void wrap(() => adminNoteUnallocatedRefund(booking.id, note), "Noted. Refund this guest out of band.");
                    }}
                  >
                    <Field id="unallocated-note" label="Refund note">
                      <TextInput id="unallocated-note" name="note" required minLength={2} placeholder="Paid back by UPI" />
                    </Field>
                    <Button type="submit" variant="secondary" disabled={pending}>
                      Leave for refund
                    </Button>
                  </form>
                </div>
              </div>
            ) : null}

            {booking.cancellation && refundOpen ? (
              <div>
                <h3 className="text-sm font-medium">Refund</h3>
                <div className="mt-2">
                  <RefundActions
                    cancellationId={booking.cancellation.id}
                    refundStatus={booking.cancellation.refundStatus}
                    refundablePaise={booking.cancellation.refundablePaise}
                    slabLabel={booking.cancellation.slabLabel}
                    pending={pending}
                    onRun={(action, success) => void wrap(action, success)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {hold || mutable || booking.rooms.length > 0 ? (
        <section className="rounded-[6px] border border-line p-4">
          <h2 className="text-sm font-medium">Rooms</h2>
          <ul className="mt-3 space-y-3">
            {booking.rooms.map((room) => (
              <li key={room.id} className="border-t border-line/70 pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm">
                  {room.roomGroupName} · {room.acMode === "ac" ? "AC" : "Non-AC"} ·{" "}
                  {room.assignedPhysicalRoomNumber ?? "Unassigned"} · {formatInrPaise(room.stayTotalPaise)}
                </p>
                {mutable || hold ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {mutable && room.acMode === "non-ac" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          void adminQuoteUpgrade(booking.id, room.id)
                            .then((quote) =>
                              setUpgradeQuote({
                                roomId: room.id,
                                quoteToken: quote.quoteToken,
                                deltaPaise: quote.deltaPaise,
                                subtotalPaise: quote.price.subtotalPaise,
                              }),
                            )
                            .catch((caught) => setError(caught instanceof AdminApiError ? caught.message : "Could not price the upgrade."));
                        }}
                      >
                        Price AC upgrade
                      </Button>
                    ) : null}
                    <ReassignPicker
                      bookingId={booking.id}
                      bookingRoomId={room.id}
                      pending={pending}
                      onDone={(roomId) => void wrap(() => adminReassign(booking.id, room.id, roomId), "Room moved.")}
                      onError={setError}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {mutable ? (
        <section className="rounded-[6px] border border-line p-4">
          <h2 className="text-sm font-medium">Change stay</h2>
          <form
            className="mt-3 grid gap-3 md:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void wrap(
                () =>
                  adminUpdateContact(booking.id, {
                    fullName: String(form.get("fullName") ?? ""),
                    phone: String(form.get("phone") ?? ""),
                    email: String(form.get("email") ?? ""),
                  }),
                "Contact updated.",
              );
            }}
          >
            <Field id="fullName" label="Name">
              <TextInput id="fullName" name="fullName" defaultValue={booking.contact.fullName} required />
            </Field>
            <Field id="phone" label="Phone">
              <TextInput id="phone" name="phone" defaultValue={booking.contact.phone} required />
            </Field>
            <Field id="email" label="Email">
              <TextInput id="email" name="email" type="email" defaultValue={booking.contact.email} required />
            </Field>
            <Button type="submit" disabled={pending}>
              Save contact
            </Button>
          </form>
          <form
            className="mt-6 grid gap-3 sm:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const composition = {
                adults: Number(form.get("adults")),
                childrenUnder5: Number(form.get("childrenUnder5")),
                children5to10: Number(form.get("children5to10")),
              };
              void adminQuoteGuestChange(booking.id, composition)
                .then((quote) =>
                  setGuestQuote({
                    quoteToken: quote.quoteToken,
                    deltaPaise: quote.deltaPaise,
                    subtotalPaise: quote.price.subtotalPaise,
                  }),
                )
                .catch((caught) => setError(caught instanceof AdminApiError ? caught.message : "Could not price the guest mix."));
            }}
          >
            <Field id="adults" label="Adults">
              <TextInput id="adults" name="adults" type="number" min={1} defaultValue={booking.composition.adults} />
            </Field>
            <Field id="childrenUnder5" label="Under 5">
              <TextInput id="childrenUnder5" name="childrenUnder5" type="number" min={0} defaultValue={booking.composition.childrenUnder5} />
            </Field>
            <Field id="children5to10" label="5 to 10">
              <TextInput id="children5to10" name="children5to10" type="number" min={0} defaultValue={booking.composition.children5to10} />
            </Field>
            <Button type="submit" variant="secondary" disabled={pending}>
              Price this mix
            </Button>
          </form>
        </section>
      ) : null}

      {hold || mutable ? (
        <section className="rounded-[6px] border border-line p-4">
          <h2 className="text-sm font-medium">End stay</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {hold ? (
              <Button type="button" variant="danger" disabled={pending} onClick={() => setDropHoldOpen(true)}>
                Drop hold
              </Button>
            ) : null}
            {mutable ? (
              <Button
                type="button"
                variant="danger"
                disabled={pending}
                onClick={() => {
                  void adminCancelQuote(booking.id)
                    .then((quote) =>
                      setCancelQuote({
                        deductionPaise: quote.deductionPaise,
                        refundablePaise: quote.refundablePaise,
                        slabLabel: quote.slabLabel,
                      }),
                    )
                    .catch((caught) => setError(caught instanceof AdminApiError ? caught.message : "Could not price cancellation."));
                }}
              >
                Cancel booking
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {guestQuote ? (
        <ConfirmDialog
          title="Apply guest mix?"
          confirmLabel="Apply mix"
          cancelLabel="Keep current mix"
          onClose={() => setGuestQuote(null)}
          onConfirm={() => {
            const quote = guestQuote;
            setGuestQuote(null);
            void wrap(() => adminApplyGuestChange(booking.id, quote.quoteToken), "Guest mix updated.");
          }}
        >
          <p>New stay total {formatInrPaise(guestQuote.subtotalPaise)}.</p>
          <p className="mt-2">{deltaCopy(guestQuote.deltaPaise)}</p>
        </ConfirmDialog>
      ) : null}

      {upgradeQuote ? (
        <ConfirmDialog
          title="Add air-conditioning?"
          confirmLabel="Add AC"
          cancelLabel="Keep Non-AC"
          onClose={() => setUpgradeQuote(null)}
          onConfirm={() => {
            const quote = upgradeQuote;
            setUpgradeQuote(null);
            void wrap(() => adminApplyUpgrade(booking.id, quote.roomId, quote.quoteToken), "Air-conditioning added.");
          }}
        >
          <p>New stay total {formatInrPaise(upgradeQuote.subtotalPaise)}.</p>
          <p className="mt-2">{deltaCopy(upgradeQuote.deltaPaise)}</p>
        </ConfirmDialog>
      ) : null}

      {dropHoldOpen ? (
        <ConfirmDialog
          title="Drop this hold?"
          confirmLabel="Drop hold"
          cancelLabel="Keep hold"
          danger
          onClose={() => setDropHoldOpen(false)}
          onConfirm={() => {
            setDropHoldOpen(false);
            void wrap(() => adminExpireHold(booking.id), "Hold dropped.");
          }}
        >
          <p>The rooms become free. The guest is not charged.</p>
        </ConfirmDialog>
      ) : null}

      {cancelQuote ? (
        <ConfirmDialog
          title="Cancel this stay?"
          confirmLabel="Cancel stay"
          cancelLabel="Keep stay"
          danger
          onClose={() => setCancelQuote(null)}
          onConfirm={() => {
            setCancelQuote(null);
            void wrap(() => adminCancel(booking.id), "Booking cancelled.");
          }}
        >
          <p>
            {cancelQuote.slabLabel}. Deduction {formatInrPaise(cancelQuote.deductionPaise)}. Refundable{" "}
            {formatInrPaise(cancelQuote.refundablePaise)}.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function ReassignPicker({
  bookingId,
  bookingRoomId,
  pending,
  onDone,
  onError,
}: {
  bookingId: string;
  bookingRoomId: string;
  pending: boolean;
  onDone: (roomId: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Array<{ id: string; roomNumber: string; free: boolean; current: boolean }>>([]);

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          void adminAssignableRooms(bookingId, bookingRoomId)
            .then((rows) => {
              setOptions(rows);
              setOpen(true);
            })
            .catch((caught) => onError(caught instanceof AdminApiError ? caught.message : "Could not load rooms."));
        }}
      >
        Choose a room
      </Button>
      {open ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={option.current ? "primary" : "secondary"}
              disabled={pending || (!option.free && !option.current)}
              onClick={() => {
                if (option.current) return;
                setOpen(false);
                onDone(option.id);
              }}
            >
              {option.roomNumber}
              {option.current ? " (current)" : option.free ? "" : " (busy)"}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
