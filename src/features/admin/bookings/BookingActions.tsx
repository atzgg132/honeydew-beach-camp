"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
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
  adminRefundAction,
  adminUpdateContact,
  AdminApiError,
} from "@/features/admin/api";
import type { StaffBooking } from "@/features/admin/types";
import { formatInrPaise } from "@/lib/format";

export function BookingActions({ booking }: { booking: StaffBooking }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  async function wrap(action: () => Promise<unknown>, success: string) {
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      refresh();
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : "That action failed.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      {booking.rawStatus === "CONFIRMED" ? (
        <section className="rounded-[6px] border border-line p-4">
          <h2 className="text-sm font-medium">Contact</h2>
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
            <Button type="submit">Save contact</Button>
          </form>
        </section>
      ) : null}

      {booking.rawStatus === "CONFIRMED" && booking.outstandingPaise > 0 ? (
        <section className="rounded-[6px] border border-line p-4">
          <h2 className="text-sm font-medium">Record collection</h2>
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
            <Button type="submit">Record</Button>
          </form>
        </section>
      ) : null}

      {booking.rawStatus === "CONFIRMED" ? (
        <section className="rounded-[6px] border border-line p-4">
          <h2 className="text-sm font-medium">Guest mix</h2>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const composition = {
                adults: Number(form.get("adults")),
                childrenUnder5: Number(form.get("childrenUnder5")),
                children5to10: Number(form.get("children5to10")),
              };
              void wrap(async () => {
                const quote = await adminQuoteGuestChange(booking.id, composition);
                await adminApplyGuestChange(booking.id, quote.quoteToken);
              }, "Guest mix updated.");
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
            <Button type="submit">Reprice</Button>
          </form>
        </section>
      ) : null}

      {booking.rawStatus === "CONFIRMED" || booking.rawStatus === "PENDING_PAYMENT" ? (
        <section className="rounded-[6px] border border-line p-4">
          <h2 className="text-sm font-medium">Rooms</h2>
          <ul className="mt-3 space-y-3">
            {booking.rooms.map((room) => (
              <li key={room.id} className="border-t border-line/70 pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm">
                  {room.roomGroupName} · {room.acMode === "ac" ? "AC" : "Non-AC"} · {room.assignedPhysicalRoomNumber ?? "unassigned"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {booking.rawStatus === "CONFIRMED" && room.acMode === "non-ac" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        void wrap(async () => {
                          const quote = await adminQuoteUpgrade(booking.id, room.id);
                          await adminApplyUpgrade(booking.id, room.id, quote.quoteToken);
                        }, "Air-conditioning added.")
                      }
                    >
                      Upgrade to AC
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      void wrap(async () => {
                        const options = await adminAssignableRooms(booking.id, room.id);
                        const next = options.find((option) => option.free && !option.current);
                        if (!next) throw new AdminApiError(409, "AVAILABILITY_CHANGED", "No other room is free.");
                        await adminReassign(booking.id, room.id, next.id);
                      }, "Room moved to the next free room in the group.")
                    }
                  >
                    Reassign
                  </Button>
                </div>
                <ReassignPicker bookingId={booking.id} bookingRoomId={room.id} onDone={refresh} onError={setError} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {booking.payments.some((payment) => payment.status === "PAID_UNALLOCATED") ? (
        <section className="rounded-[6px] border border-honey/50 bg-mist/20 p-4">
          <h2 className="text-sm font-medium">Paid, unallocated</h2>
          <p className="mt-1 text-sm text-ink/70">Money arrived after the hold lapsed. Allocate rooms or settle the refund out of band.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <Button type="button" onClick={() => void wrap(() => adminAllocateUnallocated(booking.id), "Rooms allocated and booking confirmed.")}>
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
              <Button type="submit" variant="secondary">
                Leave for refund
              </Button>
            </form>
          </div>
        </section>
      ) : null}

      {booking.rawStatus === "PENDING_PAYMENT" ? (
        <Button type="button" variant="danger" onClick={() => void wrap(() => adminExpireHold(booking.id), "Hold dropped.")}>
          Drop hold
        </Button>
      ) : null}

      {booking.rawStatus === "CONFIRMED" ? (
        <Button
          type="button"
          variant="danger"
          onClick={() =>
            void wrap(async () => {
              const quote = await adminCancelQuote(booking.id);
              if (!window.confirm(`Cancel this stay? Deduction ${formatInrPaise(quote.deductionPaise)}, refundable ${formatInrPaise(quote.refundablePaise)}.`)) {
                return;
              }
              await adminCancel(booking.id);
            }, "Booking cancelled.")
          }
        >
          Cancel booking
        </Button>
      ) : null}

      {booking.cancellation && (booking.cancellation.refundStatus === "PENDING_HOTEL_REVIEW" || booking.cancellation.refundStatus === "APPROVED") ? (
        <section className="rounded-[6px] border border-line p-4">
          <h2 className="text-sm font-medium">Refund</h2>
          <p className="mt-1 text-sm text-ink/70">
            {booking.cancellation.slabLabel}. Refundable {formatInrPaise(booking.cancellation.refundablePaise)}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {booking.cancellation.refundStatus === "PENDING_HOTEL_REVIEW" ? (
              <>
                <Button type="button" onClick={() => void wrap(() => adminRefundAction(booking.cancellation!.id, { action: "approve" }), "Refund approved.")}>
                  Approve
                </Button>
                <Button type="button" variant="danger" onClick={() => void wrap(() => adminRefundAction(booking.cancellation!.id, { action: "reject" }), "Refund rejected.")}>
                  Reject
                </Button>
              </>
            ) : (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const rupees = Number(new FormData(event.currentTarget).get("refund"));
                  void wrap(
                    () =>
                      adminRefundAction(booking.cancellation!.id, {
                        action: "process",
                        actualRefundPaise: Math.round(rupees * 100),
                      }),
                    "Refund marked processed.",
                  );
                }}
              >
                <Field id="refund" label="Returned (₹)">
                  <TextInput id="refund" name="refund" type="number" min={0} step={1} defaultValue={Math.round(booking.cancellation.refundablePaise / 100)} />
                </Field>
                <Button type="submit">Mark processed</Button>
              </form>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ReassignPicker({
  bookingId,
  bookingRoomId,
  onDone,
  onError,
}: {
  bookingId: string;
  bookingRoomId: string;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Array<{ id: string; roomNumber: string; free: boolean; current: boolean }>>([]);

  return (
    <div className="mt-2">
      <button
        type="button"
        className="text-xs underline-offset-2 hover:underline"
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
      </button>
      {open ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={option.current ? "primary" : "secondary"}
              disabled={!option.free && !option.current}
              onClick={() => {
                if (option.current) return;
                void adminReassign(bookingId, bookingRoomId, option.id)
                  .then(() => {
                    setOpen(false);
                    onDone();
                  })
                  .catch((caught) => onError(caught instanceof AdminApiError ? caught.message : "Reassign failed."));
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
