export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatInrPaise(paise: number): string {
  return formatInr(paise / 100);
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function last10Digits(value: string): string {
  return digitsOnly(value).slice(-10);
}

export function formatPhoneDisplay(value: string): string {
  const digits = last10Digits(value);
  if (digits.length !== 10) return value;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}
