export default function DeskLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="h-8 w-40 rounded-[6px] bg-sand/60" />
      <div className="h-24 rounded-[6px] border border-line bg-cream-raised" />
      <div className="h-24 rounded-[6px] border border-line bg-cream-raised" />
    </div>
  );
}
