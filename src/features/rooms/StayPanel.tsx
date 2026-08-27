import { Button } from "@/components/ui/Button";
import { SiteImage } from "@/components/media/SiteImage";
import { typicalRateForGroup, rateQualifier } from "@/data/tariffs";
import { formatInr } from "@/lib/format";
import { bookingHref } from "@/lib/booking/query";
import type { RoomGroup } from "@/types";

export function StayPanel({
  group,
  imageId,
  reverse = false,
  priority = false,
}: {
  group: RoomGroup;
  imageId: string;
  reverse?: boolean;
  priority?: boolean;
}) {
  const from = typicalRateForGroup(group.id);

  return (
    <article className="grid items-stretch overflow-hidden md:grid-cols-2">
      <div className={reverse ? "md:order-2" : undefined}>
        <div className="relative min-h-[18rem] md:h-full md:min-h-[26rem]">
          <SiteImage id={imageId} className="absolute inset-0" priority={priority} />
        </div>
      </div>
      <div className="flex flex-col justify-center gap-5 px-1 py-8 md:px-10">
        <div>
          <h2 className="font-serif text-3xl tracking-tight text-ink md:text-4xl">{group.publicName}</h2>
          <p className="mt-3 max-w-md text-base leading-7 text-ink/75">{group.shortDifference}</p>
        </div>
        <p className="text-sm text-ink/70">
          From {formatInr(from)} {rateQualifier}, Non-AC. Meals included.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button href={`/rooms/${group.slug}`} variant="secondary">
            View stay
          </Button>
          <Button href={bookingHref({})}>Book now</Button>
        </div>
      </div>
    </article>
  );
}
