"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { contactSchema } from "@/lib/booking/validation";
import type { z } from "zod";

type Values = z.infer<typeof contactSchema>;

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", phone: "", email: "", message: "" },
  });

  function onSubmit() {
    setSent(true);
  }

  if (sent) {
    return (
      <Notice tone="demo">
        This demonstration form does not send a message. Please call or email Honey Dew Beach Camp directly.
      </Notice>
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)}>
      <Field id="name" label="Name" error={form.formState.errors.name?.message}>
        <TextInput id="name" autoComplete="name" error={Boolean(form.formState.errors.name)} {...form.register("name")} />
      </Field>
      <Field id="phone" label="Phone" error={form.formState.errors.phone?.message}>
        <TextInput id="phone" type="tel" autoComplete="tel" error={Boolean(form.formState.errors.phone)} {...form.register("phone")} />
      </Field>
      <Field id="email" label="Email" error={form.formState.errors.email?.message}>
        <TextInput id="email" type="email" autoComplete="email" error={Boolean(form.formState.errors.email)} {...form.register("email")} />
      </Field>
      <Field id="message" label="Message" error={form.formState.errors.message?.message}>
        <TextArea id="message" error={Boolean(form.formState.errors.message)} {...form.register("message")} />
      </Field>
      <Button type="submit">Send message</Button>
    </form>
  );
}
