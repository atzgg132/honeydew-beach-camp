import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "on-hero";

const styles: Record<Variant, string> = {
  primary:
    "bg-lagoon-900 text-cream hover:bg-lagoon-800 border border-lagoon-900",
  secondary:
    "bg-transparent text-lagoon-900 border border-lagoon-900/30 hover:border-lagoon-900",
  ghost:
    "bg-transparent text-cream border border-cream/70 hover:bg-cream/10",
  danger:
    "bg-transparent text-danger border border-danger/40 hover:border-danger",
  "on-hero":
    "bg-cream text-lagoon-900 border border-cream hover:bg-cream/90",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-[6px] px-5 min-h-11 text-sm font-medium tracking-wide transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 disabled:pointer-events-none";

type ButtonAsButton = ComponentProps<"button"> & {
  href?: undefined;
  variant?: Variant;
};

type ButtonAsLink = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  variant?: Variant;
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonAsButton | ButtonAsLink) {
  const classes = cn(base, styles[variant], className);
  if ("href" in props && props.href) {
    const { href, ...rest } = props;
    return <Link href={href} className={classes} {...rest} />;
  }
  return <button className={classes} {...(props as ButtonAsButton)} />;
}
