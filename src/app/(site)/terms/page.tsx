import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { hotel } from "@/data/hotel";
import { formatTimeLabel } from "@/lib/dates";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      intro={`These terms govern every booking made with ${hotel.name} on this website, by phone, or by email. By paying an advance or confirming a stay, you agree to these terms, the Refunds & Cancellations policy, and the Privacy Policy.`}
    >
      <LegalSection id="services" heading="1. Who we are and what we sell">
        <p>
          {hotel.name} is a beach camp at {hotel.addressLines[1]},{" "}
          {hotel.addressLines[2]}, {hotel.addressLines[3]}, {hotel.addressLines[4]},{" "}
          {hotel.district}. We sell accommodation at our own property: Single-Bed Rooms
          for one to three guests and Double-Bed Rooms for four to six guests, with
          meals cooked and served at the camp included in the stay charges.
          Air-conditioning can be included or left out on the tariff; the rooms
          themselves are the same either way.
        </p>
        <p>
          This website takes bookings only for stays at {hotel.name}. We do not sell
          rooms at any other property and we do not ship physical goods. The service
          is delivered when you stay at the camp on your booked dates.
        </p>
      </LegalSection>

      <LegalSection id="booking" heading="2. Booking and the advance">
        <p>
          A booking is confirmed when you have chosen dates, rooms, and guest details
          on this website and paid the advance shown in your quote. You will receive
          a booking reference, which you need together with your phone number to use{" "}
          <Link className="underline decoration-honey underline-offset-4" href="/manage-booking">
            Manage booking
          </Link>
          .
        </p>
        <p>
          The advance is a percentage of the stay total and is shown in the quote
          before you pay. The remaining balance is payable at {hotel.name} during
          your stay. If an advance payment fails, no booking is created and no rooms
          are held.
        </p>
        <p>
          Dates cannot be changed online after booking. To discuss a change, contact
          us using the details below; whether a change is possible depends on
          availability and is at the camp&apos;s discretion.
        </p>
      </LegalSection>

      <LegalSection id="prices" heading="3. Prices and payment">
        <p>
          All prices on this website are in Indian Rupees (INR), quoted per person
          per night, and include meals at the camp as described. The quote shown
          before payment is the amount you pay: there are no additional charges
          beyond the quoted stay total.
        </p>
        <p>
          Online advance payments are processed over a secure connection through our
          payment gateway partner. We never see or store your card, UPI, or
          net-banking credentials. The balance payable at the property can be
          settled as agreed with the camp.
        </p>
      </LegalSection>

      <LegalSection id="stay" heading="4. Check-in, check-out, and stay rules">
        <p>
          Check-in is {formatTimeLabel(hotel.checkInTime)} and check-out is{" "}
          {formatTimeLabel(hotel.checkOutTime)} (IST). Early check-in and late
          check-out depend on availability on the day; please call ahead.
        </p>
        <p>{hotel.idProof}</p>
        <p>
          Each room has a maximum occupancy — three guests in a Single-Bed Room and
          six in a Double-Bed Room — and children count toward it. Children under 5
          years are not charged. Children from 5 to 10 years are charged at half the
          guest tariff. Guests older than 10 are counted with adults.
        </p>
        <p>
          Bookings are for the guests named at booking time. Please keep noise
          reasonable after dark, follow the camp team&apos;s safety instructions near
          the water, and leave the room and grounds as you found them. Damage to
          rooms or property may be charged at cost.
        </p>
      </LegalSection>

      <LegalSection id="cancellation" heading="5. Cancellations and refunds">
        <p>
          Cancellation charges are calculated on the advance already paid, not on the
          full stay total. The deduction depends on how close to check-in you
          cancel, and any refundable remainder is reviewed by the camp before it is
          processed. The full timetable, refund timelines, and how to cancel are in
          the{" "}
          <Link className="underline decoration-honey underline-offset-4" href="/refunds">
            Refunds &amp; Cancellations policy
          </Link>
          , which forms part of these terms.
        </p>
      </LegalSection>

      <LegalSection id="conduct" heading="6. Conduct and the right to refuse service">
        <p>
          We may refuse check-in, or ask guests to leave without a refund of the
          unused stay, in case of abusive behaviour toward staff or other guests,
          wilful damage, illegal activity on the premises, or a material breach of
          these terms. The decision of the camp manager on the day is final.
        </p>
      </LegalSection>

      <LegalSection id="liability" heading="7. Liability and events beyond our control">
        <p>
          We are responsible for providing the stay you booked, or a fair
          alternative or refund where we cannot. We are not responsible for indirect
          losses such as travel costs, missed connections, or loss of enjoyment, nor
          for events beyond our reasonable control, including extreme weather,
          natural calamities, transport shutdowns, power failures, or government
          restrictions. Where such an event prevents your stay, we will offer
          alternative dates or a refund of amounts paid for the affected nights.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="8. Changes to these terms">
        <p>
          We may update these terms when our services or the law change. The version
          published on this page at the time you book applies to your booking. The
          “Last updated” date above shows when this page last changed.
        </p>
      </LegalSection>

      <LegalSection id="law" heading="9. Governing law">
        <p>
          These terms are governed by the laws of India. Disputes will first be
          attempted to be resolved by contacting us directly; failing that, they are
          subject to the jurisdiction of the courts at South 24 Parganas, West
          Bengal.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
