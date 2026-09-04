import { formatInrPaise } from "@/lib/format";

export function Money({ paise, className }: { paise: number; className?: string }) {
  return <span className={className}>{formatInrPaise(paise)}</span>;
}
