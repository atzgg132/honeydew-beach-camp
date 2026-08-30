import type { QuoteRequestInput } from "@/contracts/booking";
import { ApiError } from "@/contracts/errors";
import { physicalOccupancy } from "@/domain/booking/pricing";

export function validateRoomIntent(input: QuoteRequestInput): void {
  const clientIds = new Set<string>();
  const total = { adults: 0, childrenUnder5: 0, children5to10: 0 };
  for (const room of input.rooms) {
    if (clientIds.has(room.clientId)) {
      throw new ApiError(400, "INVALID_ALLOCATION", "Room identifiers must be unique.");
    }
    clientIds.add(room.clientId);
    const occupancy = physicalOccupancy(room.composition);
    const valid =
      room.roomGroupId === "single-bed"
        ? occupancy >= 1 && occupancy <= 3
        : occupancy >= 4 && occupancy <= 6;
    if (!valid) {
      throw new ApiError(400, "INVALID_ALLOCATION", "A room exceeds its allowed occupancy.");
    }
    total.adults += room.composition.adults;
    total.childrenUnder5 += room.composition.childrenUnder5;
    total.children5to10 += room.composition.children5to10;
  }
  if (
    total.adults !== input.composition.adults ||
    total.childrenUnder5 !== input.composition.childrenUnder5 ||
    total.children5to10 !== input.composition.children5to10
  ) {
    throw new ApiError(400, "INVALID_ALLOCATION", "Room guests must match the booking guests.");
  }
}
