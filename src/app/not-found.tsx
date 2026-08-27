import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/brand/Logo";
import { SiteShell } from "@/components/layout/SiteShell";

export default function NotFound() {
  return (
    <SiteShell>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pt-[var(--header)] pb-20 text-center">
        <Logo variant="mark" href={null} className="mx-auto" />
        <h1 className="font-serif mt-6 text-3xl tracking-tight">This page is not here</h1>
        <div className="mt-6 flex gap-3">
          <Button href="/">Home</Button>
          <Button href="/book" variant="secondary">
            Book now
          </Button>
        </div>
      </main>
    </SiteShell>
  );
}
