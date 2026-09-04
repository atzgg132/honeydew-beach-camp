import { Notice } from "@/components/ui/Notice";
import { CallProperty } from "@/components/booking/CallProperty";

export function ContactForm() {
  return (
    <div className="space-y-4">
      <Notice>
        Messages from this page are not sent. Call or email the camp using the numbers on the left.
      </Notice>
      <CallProperty />
    </div>
  );
}
