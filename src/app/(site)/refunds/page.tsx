import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { CancellationTimeline } from "@/features/policies/CancellationTimeline";
import { cancellationSlabs, refundNote } from "@/data/policies";
import { hotel } from "@/data/hotel";

export const metadata: Metadata = { title: "Refunds & Cancellations" };

const slabs = [...cancellationSlabs].reverse();

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refunds & Cancellations"
      intro={`How cancellations are charged, how refunds reach you, and how long each step takes. Cancellation charges are calculated on the advance already paid, not on the full stay total.`}
    >
      <LegalSection id="timetable" heading="1. Cancellation timetable">
        <p>
          The deduction depends on how close to check-in ({hotel.checkInTime} IST on
          your arrival date) you cancel. The remainder of the advance is refundable,
          subject to the camp&apos;s review.
        </p>
        <div className="overflow-x-auto pt-2">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink/70">
                <th className="py-2 pr-4 font-medium">When you cancel</th>
                <th className="py-2 pr-4 font-medium">Deduction from advance</th>
                <th className="py-2 font-medium">Refundable</th>
              </tr>
            </thead>
            <tbody>
              {slabs.map((slab) => (
                <tr key={slab.id} className="border-b border-line/70">
                  <td className="py-3 pr-4">{slab.label} before check-in</td>
                  <td className="py-3 pr-4">{slab.deductionPercent}%</td>
                  <td className="py-3">{100 - slab.deductionPercent}% of the advance</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pt-4">
          <CancellationTimeline />
        </div>
      </LegalSection>

      <LegalSection id="how-to-cancel" heading="2. How to cancel">
        <p>
          The fastest way is online: open{" "}
          <Link className="underline decoration-honey underline-offset-4" href="/manage-booking">
            Manage booking
          </Link>
          , enter your booking reference and phone number, and you will see the
          exact deduction for your booking before you confirm the cancellation.
        </p>
        <p>
          You can also cancel by calling{" "}
          {hotel.phones.map((phone, index) => (
            <span key={phone.id}>
              {index > 0 ? " or " : null}
              <a
                className="underline decoration-honey underline-offset-4"
                href={`tel:+91${phone.number}`}
              >
                +91 {phone.display}
              </a>
            </span>
          ))}{" "}
          or by emailing{" "}
          <a
            className="underline decoration-honey underline-offset-4"
            href={`mailto:${hotel.email}`}
          >
            {hotel.email}
          </a>{" "}
          with your booking reference. The cancellation time is the time we receive
          your request, and the timetable above is applied to that time.
        </p>
      </LegalSection>

      <LegalSection id="how-refunds-work" heading="3. How refunds work">
        <p>{refundNote}</p>
        <p>
          Once approved, the refund is processed within 7 business days to the
          original payment method. After we process it, banks and UPI or card
          issuers typically take a further 3–5 business days to show the credit in
          your account. If a refund to the original method fails, we will arrange an
          alternative with you over phone or email.
        </p>
        <p>
          To check on a refund, write to{" "}
          <a
            className="underline decoration-honey underline-offset-4"
            href={`mailto:${hotel.email}`}
          >
            {hotel.email}
          </a>{" "}
          with your booking reference, or call us during support hours (
          {hotel.supportHours}).
        </p>
      </LegalSection>

      <LegalSection id="no-show" heading="4. No-shows and partial stays">
        <p>
          If you do not arrive and do not cancel, the advance is non-refundable. If
          you check out early, nights already stayed are charged in full; whether
          any of the remaining balance is adjusted is at the camp&apos;s discretion
          and is settled at the property, not through an online refund.
        </p>
      </LegalSection>

      <LegalSection id="failed-payments" heading="5. Failed or duplicate payments">
        <p>
          If you were charged but did not receive a booking reference, or if you
          were charged twice for the same booking, contact us with your dates and
          the phone number you booked with. Once verified against our payment
          records, duplicate or unbooked charges are refunded in full within 7
          business days to the original payment method.
        </p>
      </LegalSection>

      <LegalSection id="changes-by-us" heading="6. Cancellations by the camp">
        <p>
          If we must cancel your booking — for example because of extreme weather,
          a government restriction, or an operational emergency — we will offer you
          alternative dates first. If those do not suit you, the advance you paid
          is refunded in full within 7 business days to the original payment
          method.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
