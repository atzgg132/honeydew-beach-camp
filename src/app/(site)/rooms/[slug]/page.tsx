import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingDesk } from "@/components/booking/BookingDesk";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";
import { SiteImage } from "@/components/media/SiteImage";
import { copy } from "@/data/copy";
import { getRoomGroup, roomGroups } from "@/data/rooms";
import { findSlab, rateQualifier, tariffOccupancyFor } from "@/data/tariffs";
import { formatInr } from "@/lib/format";
import { bookingHref } from "@/lib/booking/query";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return roomGroups.map((group) => ({ slug: group.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const group = getRoomGroup(slug);
  return { title: group?.publicName ?? "Room" };
}

export default async function RoomDetailPage({ params }: Props) {
  const { slug } = await params;
  const group = getRoomGroup(slug);
  if (!group) notFound();
  const occupancies: number[] = [];
  for (let n = group.occupancyMin; n <= group.occupancyMax; n += 1) occupancies.push(n);
  const other = roomGroups.find((item) => item.id !== group.id);

  return (
    <main className="pt-[var(--header)]">
      <div className="relative h-[min(70dvh,36rem)]">
        <SiteImage id={group.mediaIds[0]} className="absolute inset-0" priority sizes="100vw" />
      </div>
      <Container className="grid gap-12 py-14 md:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)] md:py-20">
        <article>
          <h1 className="font-serif text-4xl tracking-tight md:text-5xl">{group.publicName}</h1>
          <p className="mt-3 text-lg text-ink/75">{group.shortDifference}</p>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink/80">{group.description}</p>
          <p className="mt-4 max-w-2xl text-base leading-8 text-ink/80">{copy.acExplainer}</p>
          {group.id === "single-bed" ? (
            <p className="mt-4 max-w-2xl text-base leading-8 text-ink/80">{copy.oneGuestNote}</p>
          ) : null}

          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
            {group.mediaIds.slice(1, 5).map((id) => (
              <div key={id} className="relative aspect-[4/3] overflow-hidden">
                <SiteImage id={id} className="absolute inset-0" />
              </div>
            ))}
          </div>

          <div className="mt-12">
            <h2 className="mb-4 text-base font-medium">Tariff {rateQualifier}</h2>
            <div className="space-y-3 sm:hidden">
              {occupancies.map((occupancy) => {
                const tier = tariffOccupancyFor(group.id, occupancy);
                const nonAc = findSlab(group.id, tier, "non-ac");
                const ac = findSlab(group.id, tier, "ac");
                return (
                  <div key={occupancy} className="border border-line p-4 text-sm">
                    <p className="font-medium">
                      {occupancy} guest{occupancy === 1 ? "" : "s"} in this room
                    </p>
                    <p className="mt-2">Non-AC {nonAc ? formatInr(nonAc.ratePerPerson) : "—"}</p>
                    <p>AC included {ac ? formatInr(ac.ratePerPerson) : "—"}</p>
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-ink/70">
                    <th className="py-2 pr-4 font-medium">Guests in this room</th>
                    <th className="py-2 pr-4 font-medium">Non-AC</th>
                    <th className="py-2 font-medium">AC included</th>
                  </tr>
                </thead>
                <tbody>
                  {occupancies.map((occupancy) => {
                    const tier = tariffOccupancyFor(group.id, occupancy);
                    const nonAc = findSlab(group.id, tier, "non-ac");
                    const ac = findSlab(group.id, tier, "ac");
                    return (
                      <tr key={occupancy} className="border-b border-line/70">
                        <td className="py-3 pr-4">{occupancy}</td>
                        <td className="py-3 pr-4">{nonAc ? formatInr(nonAc.ratePerPerson) : "—"}</td>
                        <td className="py-3">{ac ? formatInr(ac.ratePerPerson) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-ink/65">
              {copy.mealsIncluded} Larger parties can reserve more than one room in the same booking.
            </p>
          </div>
        </article>

        <aside className="h-fit border border-line bg-cream-raised p-5">
          <p className="text-sm text-ink/70">Check dates</p>
          <div className="mt-4">
            <Button href={bookingHref({})} className="w-full">
              Book this stay
            </Button>
          </div>
          {other ? (
            <p className="mt-5 text-sm leading-6">
              Looking for {other.id === "double-bed" ? "two beds" : "one bed"}?{" "}
              <Link className="underline decoration-honey underline-offset-4" href={`/rooms/${other.slug}`}>
                View {other.publicName}
              </Link>
            </p>
          ) : null}
        </aside>
      </Container>
      <Container className="pb-20">
        <div className="border border-line p-3 md:p-4">
          <BookingDesk />
        </div>
      </Container>
    </main>
  );
}
