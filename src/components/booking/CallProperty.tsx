import { hotel } from "@/data/hotel";
import { copy } from "@/data/copy";

export function CallProperty({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-sm leading-6 text-ink/80"}>
      {copy.specialRequest}{" "}
      {hotel.phones.map((phone, index) => (
        <span key={phone.id}>
          {index > 0 ? " · " : null}
          <a className="underline decoration-honey underline-offset-4" href={`tel:+91${phone.number}`}>
            {phone.display}
          </a>
        </span>
      ))}
    </p>
  );
}
