import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { hotel } from "@/data/hotel";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`What personal information ${hotel.name} collects when you browse or book on this website, why we need it, and the choices you have. This policy follows the Digital Personal Data Protection Act, 2023 of India.`}
    >
      <LegalSection id="collect" heading="1. Information we collect">
        <p>
          When you make or manage a booking, we collect your full name, phone
          number, and email address, together with your stay details: dates, rooms,
          guest composition (adults and children), and your booking reference. When
          you contact us by phone or email, we receive whatever you share in that
          conversation.
        </p>
        <p>
          When you pay an advance online, the payment is processed by our payment
          gateway partner over a secure connection. We receive the payment
          confirmation and reference, but never your card, UPI, or net-banking
          credentials.
        </p>
      </LegalSection>

      <LegalSection id="use" heading="2. How we use it">
        <p>We use your information only to run the camp and your booking:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Confirming, holding, and managing your reservation and advance payment.</li>
          <li>Contacting you about your stay — confirmations, changes, and check-in details.</li>
          <li>Verifying it is you when you use Manage booking or request a refund.</li>
          <li>Meeting legal and accounting duties, such as booking and tax records.</li>
        </ul>
        <p>
          We do not sell your personal information. We do not send marketing emails
          or messages; every message we send relates to your booking or an enquiry
          you made.
        </p>
      </LegalSection>

      <LegalSection id="cookies" heading="3. Cookies and on-device storage">
        <p>
          This website uses only functional storage needed for booking to work: a
          secure session while you check out or manage a booking, and a draft of
          your room selection kept in your own browser so the booking form survives
          a page refresh. We do not use advertising trackers, analytics beacons, or
          cross-site cookies.
        </p>
      </LegalSection>

      <LegalSection id="sharing" heading="4. Who we share it with">
        <p>
          Your details are shared only where running your booking requires it: with
          our payment gateway partner to process your advance, and with our hosting
          and database providers that store this website&apos;s data. Everyone who
          handles the data does so under an agreement that limits use to operating
          our service. We disclose information to authorities only where the law
          requires it.
        </p>
      </LegalSection>

      <LegalSection id="retention" heading="5. How long we keep it">
        <p>
          Booking records are kept for as long as accounting and tax law requires,
          after which personal details are deleted or anonymised. Draft room
          selections in your browser are removed when you finish booking, and
          checkout sessions expire automatically.
        </p>
      </LegalSection>

      <LegalSection id="rights" heading="6. Your rights">
        <p>
          You may ask us at any time to share the personal information we hold about
          you, to correct it, or to delete it where the law allows. To exercise any
          of these rights, email{" "}
          <a
            className="underline decoration-honey underline-offset-4"
            href={`mailto:${hotel.email}`}
          >
            {hotel.email}
          </a>{" "}
          from the address on your booking, or call us during support hours (
          {hotel.supportHours}). We respond within a reasonable time and within the
          timelines the law prescribes.
        </p>
      </LegalSection>

      <LegalSection id="grievance" heading="7. Grievance contact">
        <p>
          For any complaint about how your personal information is handled, contact
          the camp&apos;s grievance officer:
        </p>
        <p>
          Grievance Officer, {hotel.name}
          <br />
          {hotel.addressLines[1]}, {hotel.addressLines[2]}, {hotel.addressLines[3]},{" "}
          {hotel.addressLines[4]}
          <br />
          Email:{" "}
          <a
            className="underline decoration-honey underline-offset-4"
            href={`mailto:${hotel.email}`}
          >
            {hotel.email}
          </a>{" "}
          · Phone:{" "}
          <a
            className="underline decoration-honey underline-offset-4"
            href={`tel:+91${hotel.phones[0].number}`}
          >
            +91 {hotel.phones[0].display}
          </a>
        </p>
      </LegalSection>

      <LegalSection id="security" heading="8. Security">
        <p>
          Booking sessions are verified server-side, payment results are accepted
          only with a verified gateway signature, and access to booking data is
          limited to the camp team that needs it. No system is perfectly secure, so
          if you suspect misuse of your booking, contact us immediately and quote
          your booking reference.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="9. Changes and contact">
        <p>
          If this policy changes, the new version is published on this page with a
          new “Last updated” date. Questions about this policy are welcome at the
          contacts below, or through the{" "}
          <Link className="underline decoration-honey underline-offset-4" href="/contact">
            Contact page
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
