import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink/70">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  error,
  className,
  ...props
}: ComponentProps<"input"> & { error?: boolean }) {
  return (
    <input
      aria-invalid={error || undefined}
      aria-describedby={error && props.id ? `${props.id}-error` : undefined}
      className={cn(
        "h-11 w-full rounded-[6px] border bg-cream-raised px-3 text-base text-ink placeholder:text-ink/45",
        error ? "border-danger" : "border-line focus:border-honey",
        className,
      )}
      {...props}
    />
  );
}

export function TextArea({
  error,
  className,
  ...props
}: ComponentProps<"textarea"> & { error?: boolean }) {
  return (
    <textarea
      aria-invalid={error || undefined}
      aria-describedby={error && props.id ? `${props.id}-error` : undefined}
      className={cn(
        "min-h-28 w-full rounded-[6px] border bg-cream-raised px-3 py-2 text-base text-ink placeholder:text-ink/45",
        error ? "border-danger" : "border-line focus:border-honey",
        className,
      )}
      {...props}
    />
  );
}
