import { cancellationSlabs } from "@/data/policies";

export function CancellationTimeline() {
  return (
    <ol className="grid gap-4 md:grid-cols-3">
      {[...cancellationSlabs].reverse().map((slab) => (
        <li key={slab.id} className="border-t-2 border-honey pt-4">
          <p className="text-sm font-medium tracking-wide">{slab.label}</p>
          <p className="mt-2 text-3xl tracking-tight">{slab.deductionPercent}%</p>
          <p className="mt-2 text-sm leading-6 text-ink/70">{slab.explanation}</p>
        </li>
      ))}
    </ol>
  );
}
