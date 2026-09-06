"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { hotel } from "@/data/hotel";
import { last10Digits } from "@/lib/format";
import { BookingApiError, submitContactEnquiry } from "@/lib/booking/booking-service.api";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error" };

function fieldErrors(caught: unknown): { name?: string; phone?: string; email?: string; message?: string; form?: string } {
  if (caught instanceof BookingApiError && caught.code === "RATE_LIMITED") {
    return { form: "Too many messages just now. Wait a few minutes before sending another." };
  }
  if (caught instanceof BookingApiError && caught.code === "VALIDATION_ERROR") {
    return { form: "Check the highlighted fields before sending again." };
  }
  return { form: caught instanceof Error ? caught.message : "The message could not be sent." };
}

export function ContactForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string; message?: string; form?: string }>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  if (status.kind === "sent") {
    return (
      <div className="space-y-4">
        <Notice>Message sent. The camp replies within two business days — sooner when your dates are mentioned.</Notice>
        <p className="text-sm leading-6 text-ink/70">
          Need a faster answer during {hotel.supportHours}? Call the numbers on this page.
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setName("");
            setPhone("");
            setEmail("");
            setMessage("");
            setErrors({});
            setStatus({ kind: "idle" });
          }}
        >
          Send another message
        </Button>
      </div>
    );
  }

  const sending = status.kind === "sending";

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const next: typeof errors = {};
        if (name.trim().length < 2) next.name = "Enter your name.";
        if (message.trim().length < 10) next.message = "Write a short message so the camp can help.";
        const hasPhone = last10Digits(phone).length === 10;
        const hasEmail = /.+@.+\..+/.test(email.trim());
        if (!phone.trim() && !email.trim()) {
          next.phone = "Leave a phone number or an email so the camp can reply.";
        } else {
          if (phone.trim() && !hasPhone) next.phone = "Enter a valid 10-digit Indian mobile number.";
          if (email.trim() && !hasEmail) next.email = "Enter a valid email address.";
        }
        setErrors(next);
        if (Object.keys(next).length > 0) return;
        setStatus({ kind: "sending" });
        submitContactEnquiry({ name: name.trim(), phone: phone.trim(), email: email.trim(), message: message.trim() })
          .then(() => {
            setErrors({});
            setStatus({ kind: "sent" });
          })
          .catch((caught: unknown) => {
            setErrors({ ...fieldErrors(caught) });
            setStatus({ kind: "error" });
          });
      }}
    >
      <Field id="contact-name" label="Full name" error={errors.name}>
        <TextInput
          id="contact-name"
          autoComplete="name"
          value={name}
          error={Boolean(errors.name)}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="contact-phone" label="Phone" error={errors.phone}>
          <TextInput
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            error={Boolean(errors.phone)}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
        <Field id="contact-email" label="Email" error={errors.email}>
          <TextInput
            id="contact-email"
            type="email"
            autoComplete="email"
            value={email}
            error={Boolean(errors.email)}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
      </div>
      <Field id="contact-message" label="Message" error={errors.message}>
        <TextArea
          id="contact-message"
          rows={5}
          value={message}
          error={Boolean(errors.message)}
          onChange={(event) => setMessage(event.target.value)}
        />
      </Field>
      {errors.form ? <Notice tone="error">{errors.form}</Notice> : null}
      <div>
        <Button type="submit" disabled={sending}>{sending ? "Sending" : "Send message"}</Button>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          Goes straight to {hotel.name} — no email app needed. Prefer to call? Use the numbers
          on this page during {hotel.supportHours}, or write to{" "}
          <a className="underline decoration-honey underline-offset-4" href={`mailto:${hotel.email}`}>
            {hotel.email}
          </a>
          .
        </p>
      </div>
    </form>
  );
}
