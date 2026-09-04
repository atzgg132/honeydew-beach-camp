import Image from "next/image";
import Link from "next/link";
import { hotel } from "@/data/hotel";
import { cn } from "@/lib/cn";

type Variant = "mark" | "lockup" | "poster";

const assets: Record<Variant, { src: string; alt: string; width: number; height: number }> = {
  mark: {
    src: "/brand/emblem.png",
    alt: "Honey Dew Beach Camp",
    width: 1254,
    height: 1254,
  },
  lockup: {
    src: "/brand/lockup.png",
    alt: "Honey Dew Beach Camp",
    width: 1254,
    height: 1254,
  },
  poster: {
    src: "/brand/lockup-bg.png",
    alt: "Honey Dew Beach Camp",
    width: 1254,
    height: 1254,
  },
};

export function Logo({
  variant = "mark",
  href = "/",
  className,
  priority = false,
  wordmark = false,
  compact = false,
}: {
  variant?: Variant;
  href?: string | null;
  className?: string;
  priority?: boolean;
  wordmark?: boolean;
  compact?: boolean;
}) {
  const asset = assets[variant];
  const frame =
    variant === "mark"
      ? compact
        ? "relative h-10 w-10"
        : "relative h-12 w-12 md:h-14 md:w-14"
      : variant === "lockup"
        ? "relative h-20 w-20 md:h-32 md:w-32"
        : "relative aspect-square w-full max-w-md";
  const restOfName = hotel.name.startsWith(hotel.shortName)
    ? hotel.name.slice(hotel.shortName.length).trim()
    : "";

  const image = (
    <span className={cn("inline-flex min-w-0 items-center gap-2 sm:gap-2.5", className)}>
      <span className={cn("block shrink-0", frame)}>
        <Image
          src={asset.src}
          alt={wordmark ? "" : asset.alt}
          fill
          sizes={variant === "poster" ? "512px" : "144px"}
          priority={priority}
          className="object-contain"
        />
      </span>
      {wordmark ? (
        <span
          className={cn(
            "flex min-w-0 flex-col leading-[1.15] tracking-tight",
            compact ? "gap-0.5" : "sm:flex-row sm:flex-nowrap sm:items-baseline sm:gap-x-1.5",
          )}
        >
          <span
            className={cn(
              "font-medium",
              compact ? "text-[0.8125rem]" : "whitespace-nowrap text-[0.92rem] sm:text-[1.05rem]",
            )}
          >
            {hotel.shortName}
          </span>
          {restOfName ? (
            <span
              className={cn(
                "font-medium",
                compact
                  ? "text-[0.8125rem] text-current/80"
                  : "whitespace-nowrap text-[0.78rem] text-current/80 sm:text-[1.05rem] sm:text-current",
              )}
            >
              {restOfName}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );

  if (!href) return image;

  return (
    <Link href={href} className="inline-flex min-w-0 max-w-full" aria-label={`${hotel.name} home`}>
      {image}
    </Link>
  );
}
