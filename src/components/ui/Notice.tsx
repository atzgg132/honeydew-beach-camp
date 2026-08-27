import { cn } from "@/lib/cn";

export function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "demo" | "error" | "success";
}) {
  return (
    <p
      className={cn(
        "rounded-[6px] border px-4 py-3 text-sm leading-6",
        tone === "demo" && "border-honey/50 bg-mist/35 text-ink",
        tone === "info" && "border-line bg-cream-raised text-ink",
        tone === "error" && "border-danger/30 bg-danger/5 text-danger",
        tone === "success" && "border-lagoon-800/20 bg-mist/40 text-ink",
      )}
    >
      {children}
    </p>
  );
}
