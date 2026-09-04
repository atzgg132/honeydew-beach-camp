"use client";

import { Button } from "@/components/ui/Button";

export default function DeskError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-medium tracking-tight">This page failed</h1>
      <p className="mt-3 text-sm text-ink/70">Try again, or go back to Today.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button href="/admin" variant="secondary">
          Today
        </Button>
      </div>
    </div>
  );
}
