import type { PhysicalRoom, RoomGroup, RoomGroupId } from "@/types";

export const physicalRooms: PhysicalRoom[] = [
  { roomNumber: "401", roomGroupId: "single-bed", supportsAc: true },
  { roomNumber: "402", roomGroupId: "single-bed", supportsAc: true },
  { roomNumber: "405", roomGroupId: "single-bed", supportsAc: true },
  { roomNumber: "407", roomGroupId: "single-bed", supportsAc: true },
  { roomNumber: "403", roomGroupId: "double-bed", supportsAc: true },
  { roomNumber: "404", roomGroupId: "double-bed", supportsAc: true },
  { roomNumber: "406", roomGroupId: "double-bed", supportsAc: true },
];

export const roomGroups: RoomGroup[] = [
  {
    id: "single-bed",
    slug: "single-bed",
    publicName: "Single-Bed Room",
    occupancyMin: 1,
    occupancyMax: 3,
    roomNumbers: ["401", "402", "405", "407"],
    mediaIds: ["one-bed-01", "one-bed-02", "one-bed-03", "one-bed-04", "bathroom", "cottages"],
    shortDifference: "One bed. For one to three guests in each room.",
    description:
      "A Single-Bed Room at Honey Dew Beach Camp. Each room suits one, two, or three guests. One guest has its own Non-AC and AC tariff. Meals are included in the tariff. Air-conditioning can be included or left out. The rooms themselves are the same either way. Larger parties can reserve more than one room.",
  },
  {
    id: "double-bed",
    slug: "double-bed",
    publicName: "Double-Bed Room",
    occupancyMin: 4,
    occupancyMax: 6,
    roomNumbers: ["403", "404", "406"],
    mediaIds: ["two-bed-01", "two-bed-02", "two-bed-03", "bathroom", "cottages"],
    shortDifference: "Two beds. For four to six guests in each room.",
    description:
      "A Double-Bed Room at Honey Dew Beach Camp. Each room suits four, five, or six guests. Meals are included in the tariff. Air-conditioning can be included or left out. The rooms themselves are the same either way. Larger parties can reserve more than one room.",
  },
];

export function getRoomGroup(id: string): RoomGroup | undefined {
  return roomGroups.find((group) => group.id === id || group.slug === id);
}

export function inventoryCount(groupId: RoomGroupId): number {
  return physicalRooms.filter((room) => room.roomGroupId === groupId).length;
}

export function fullInventory() {
  return {
    "single-bed": inventoryCount("single-bed"),
    "double-bed": inventoryCount("double-bed"),
  };
}
