-- One guest is its own tariff tier (AC and Non-AC). Bookings may now store tariffOccupancy = 1.

ALTER TABLE "BookingRoom" DROP CONSTRAINT "BookingRoom_composition_check";

ALTER TABLE "BookingRoom"
  ADD CONSTRAINT "BookingRoom_composition_check" CHECK (
    "adults" >= 0 AND "childrenUnder5" >= 0 AND "children5To10" >= 0 AND
    "physicalOccupancy" = "adults" + "childrenUnder5" + "children5To10" AND
    "billingHalfUnits" = ("adults" * 2) + "children5To10" AND
    "physicalOccupancy" BETWEEN 1 AND 6 AND
    "tariffOccupancy" BETWEEN 1 AND 6
  );

INSERT INTO "TariffRate" (
  "id",
  "tariffRevisionId",
  "roomGroupId",
  "tariffOccupancy",
  "acMode",
  "ratePerPersonPaise"
)
SELECT gen_random_uuid(), revision.id, 'single-bed', 1, 'AC'::"AcMode", 149900
FROM "TariffRevision" revision
WHERE NOT EXISTS (
  SELECT 1
  FROM "TariffRate" rate
  WHERE rate."tariffRevisionId" = revision.id
    AND rate."roomGroupId" = 'single-bed'
    AND rate."tariffOccupancy" = 1
    AND rate."acMode" = 'AC'
);

INSERT INTO "TariffRate" (
  "id",
  "tariffRevisionId",
  "roomGroupId",
  "tariffOccupancy",
  "acMode",
  "ratePerPersonPaise"
)
SELECT gen_random_uuid(), revision.id, 'single-bed', 1, 'NON_AC'::"AcMode", 119900
FROM "TariffRevision" revision
WHERE NOT EXISTS (
  SELECT 1
  FROM "TariffRate" rate
  WHERE rate."tariffRevisionId" = revision.id
    AND rate."roomGroupId" = 'single-bed'
    AND rate."tariffOccupancy" = 1
    AND rate."acMode" = 'NON_AC'
);
