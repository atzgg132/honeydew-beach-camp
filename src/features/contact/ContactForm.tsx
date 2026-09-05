"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { hotel } from "@/data/hotel";

export function ContactForm() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!fullName.trim() || !message.trim()) {
          setError("Please add your name and a message so the camp can reply.");
          return;
        }
        setError(null);
        const subject = `Website enquiry from ${fullName.trim()}`;
        const lines = [`Name: ${fullName.trim()}`];
        if (phone.trim()) lines.push(`Phone: ${phone.trim()}`);
        lines.push("", message.trim());
        const body = lines.join("\n");
        window.location.href = `mailto:${hotel.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }}
    >
      <Field id="contact-name" label="Full name" error={error && !fullName.trim() ? error : undefined}>
        <TextInput
          id="contact-name"
          autoComplete="name"
          value={fullName}
          error={Boolean(error && !fullName.trim())}
          onChange={(event) => setFullName(event.target.value)}
        />
      </Field>
      <Field id="contact-phone" label="Phone (optional)">
        <TextInput
          id="contact-phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </Field>
      <Field id="contact-message" label="Message" error={error && fullName.trim() ? error : undefined}>
        <TextArea
          id="contact-message"
          rows={5}
          value={message}
          error={Boolean(error && fullName.trim())}
          onChange={(event) => setMessage(event.target.value)}
        />
      </Field>
      <div>
        <Button type="submit">Open email to the camp</Button>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          This opens your own email app with the message addressed to {hotel.email}.
          Prefer to call? Use the numbers on the left during {hotel.supportHours}.
        </p>
      </div>
    </form>
  );
}
