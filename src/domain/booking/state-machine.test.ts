import { describe, expect, it } from "vitest";
import { canTransition } from "@/domain/booking/state-machine";

describe("booking state machine", () => {
  it("allows only persisted lifecycle transitions", () => {
    expect(canTransition("PENDING_PAYMENT", "CONFIRMED")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "EXPIRED")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "EXPIRED")).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransition("EXPIRED", "CONFIRMED")).toBe(false);
  });
});
