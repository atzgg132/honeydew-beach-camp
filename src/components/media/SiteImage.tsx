import Image from "next/image";
import { getMedia } from "@/data/media";
import { cn } from "@/lib/cn";

export function SiteImage({
  id,
  className,
  sizes = "(min-width: 1024px) 72rem, 100vw",
  priority = false,
  alt,
  fit = "cover",
}: {
  id: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  alt?: string;
  fit?: "cover" | "contain";
}) {
  const asset = getMedia(id);
  return (
    <Image
      src={asset.src}
      alt={alt ?? asset.alt}
      width={asset.width}
      height={asset.height}
      sizes={sizes}
      priority={priority}
      className={cn(
        fit === "contain" ? "h-auto max-h-[80dvh] w-auto max-w-full object-contain" : "h-full w-full object-cover",
        className,
      )}
      style={asset.objectPosition ? { objectPosition: asset.objectPosition } : undefined}
    />
  );
}
