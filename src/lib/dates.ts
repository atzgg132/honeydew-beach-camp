/** Asia/Kolkata is UTC+05:30 with no daylight saving. */

export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string): boolean {
  return DATE_ONLY.test(value);
}

export function parseDateOnlyUtc(date: string): Date {
  if (!isDateOnly(date)) {
    throw new Error(`Expected YYYY-MM-DD, received ${date}`);
  }
  return new Date(`${date}T00:00:00.000Z`);
}

export function formatDateOnlyUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIstDate(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  return formatDateOnlyUtc(shifted);
}

export function addDays(date: string, days: number): string {
  const utc = parseDateOnlyUtc(date);
  utc.setUTCDate(utc.getUTCDate() + days);
  return formatDateOnlyUtc(utc);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!isDateOnly(checkIn) || !isDateOnly(checkOut)) return 0;
  const start = parseDateOnlyUtc(checkIn).getTime();
  const end = parseDateOnlyUtc(checkOut).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function compareDateOnly(a: string, b: string): number {
  return parseDateOnlyUtc(a).getTime() - parseDateOnlyUtc(b).getTime();
}

export function istDateTime(date: string, timeHHmm: string): Date {
  const [hours, minutes] = timeHHmm.split(":").map(Number);
  const utcMidnight = parseDateOnlyUtc(date);
  const asUtcWall = Date.UTC(
    utcMidnight.getUTCFullYear(),
    utcMidnight.getUTCMonth(),
    utcMidnight.getUTCDate(),
    hours,
    minutes,
    0,
    0,
  );
  return new Date(asUtcWall - IST_OFFSET_MS);
}

export function hoursUntilIst(date: string, timeHHmm: string, now: Date = new Date()): number {
  return (istDateTime(date, timeHHmm).getTime() - now.getTime()) / 3_600_000;
}

export function formatDisplayDate(date: string): string {
  const utc = parseDateOnlyUtc(date);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc);
}

export function formatShortDate(date: string): string {
  const utc = parseDateOnlyUtc(date);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(utc);
}

export function formatIstDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export function formatTimeLabel(timeHHmm: string): string {
  const [h, m] = timeHHmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}
