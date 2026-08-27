import type { CancellationSlab } from "@/types";

export const cancellationSlabs: CancellationSlab[] = [
  {
    id: "within-24h",
    maxHoursBeforeCheckIn: 24,
    deductionPercent: 100,
    label: "Within 24 hours",
    explanation: "The full advance is retained. There is no refund of the advance.",
  },
  {
    id: "within-48h",
    maxHoursBeforeCheckIn: 48,
    deductionPercent: 50,
    label: "Within 48 hours",
    explanation: "50% of the advance is retained. The remainder is refundable, subject to hotel review.",
  },
  {
    id: "within-7d",
    maxHoursBeforeCheckIn: 7 * 24,
    deductionPercent: 30,
    label: "Within 7 days",
    explanation: "30% of the advance is retained. The remainder is refundable, subject to hotel review.",
  },
  {
    id: "within-15d",
    maxHoursBeforeCheckIn: 15 * 24,
    deductionPercent: 20,
    label: "Within 15 days",
    explanation: "20% of the advance is retained. The remainder is refundable, subject to hotel review.",
  },
  {
    id: "within-30d",
    maxHoursBeforeCheckIn: 30 * 24,
    deductionPercent: 10,
    label: "Within 30 days",
    explanation: "10% of the advance is retained. The remainder is refundable, subject to hotel review.",
  },
  {
    id: "beyond-30d",
    maxHoursBeforeCheckIn: null,
    deductionPercent: 0,
    label: "More than 30 days",
    explanation: "No deduction from the advance. The advance is refundable, subject to hotel review.",
  },
];

export const childPolicy = {
  under5: "Children under 5 years are not charged.",
  age5to10: "Children from 5 to 10 years are charged at half the guest tariff.",
};

export const refundNote =
  "Cancelling a booking does not send a refund automatically. Honey Dew Beach Camp reviews the cancellation and processes any refund.";
