-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AcMode" AS ENUM ('AC', 'NON_AC');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('ONLINE', 'PHONE', 'WALK_IN', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReservationState" AS ENUM ('HELD', 'CONFIRMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('CREATED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'PAID_UNALLOCATED');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_HOTEL_REVIEW', 'APPROVED', 'PROCESSING', 'PROCESSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BookingEventActor" AS ENUM ('CUSTOMER', 'ADMIN', 'SYSTEM', 'PAYMENT_WEBHOOK');

-- CreateTable
CREATE TABLE "HotelSettings" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "timezone" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "checkInLocalMinutes" INTEGER NOT NULL,
    "checkOutLocalMinutes" INTEGER NOT NULL,
    "minNights" INTEGER NOT NULL,
    "maxNights" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "HotelSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomGroup" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "publicName" TEXT NOT NULL,
    "occupancyMin" INTEGER NOT NULL,
    "occupancyMax" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RoomGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "roomGroupId" TEXT NOT NULL,
    "supportsAc" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffRevision" (
    "id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "retiredAt" TIMESTAMPTZ(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TariffRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffRate" (
    "id" UUID NOT NULL,
    "tariffRevisionId" UUID NOT NULL,
    "roomGroupId" TEXT NOT NULL,
    "tariffOccupancy" INTEGER NOT NULL,
    "acMode" "AcMode" NOT NULL,
    "ratePerPersonPaise" INTEGER NOT NULL,

    CONSTRAINT "TariffRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPolicyRevision" (
    "id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "advanceBasisPoints" INTEGER NOT NULL,
    "holdTtlMinutes" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "retiredAt" TIMESTAMPTZ(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingPolicyRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "reference" TEXT,
    "source" "BookingSource" NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "holdExpiresAt" TIMESTAMPTZ(3),
    "contactFullName" TEXT NOT NULL,
    "contactPhoneE164" TEXT NOT NULL,
    "contactPhoneLookupHash" CHAR(64) NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "adults" INTEGER NOT NULL,
    "childrenUnder5" INTEGER NOT NULL,
    "children5To10" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "tariffRevisionId" UUID NOT NULL,
    "policyRevisionId" UUID NOT NULL,
    "nights" INTEGER NOT NULL,
    "subtotalPaise" INTEGER NOT NULL,
    "advanceBasisPoints" INTEGER NOT NULL,
    "advanceDuePaise" INTEGER NOT NULL,
    "advancePaidPaise" INTEGER NOT NULL DEFAULT 0,
    "outstandingPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRoom" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "roomGroupId" TEXT NOT NULL,
    "roomGroupNameSnapshot" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "acMode" "AcMode" NOT NULL,
    "adults" INTEGER NOT NULL,
    "childrenUnder5" INTEGER NOT NULL,
    "children5To10" INTEGER NOT NULL,
    "physicalOccupancy" INTEGER NOT NULL,
    "billingHalfUnits" INTEGER NOT NULL,
    "tariffOccupancy" INTEGER NOT NULL,
    "ratePerPersonPaise" INTEGER NOT NULL,
    "nightlyTotalPaise" INTEGER NOT NULL,
    "nights" INTEGER NOT NULL,
    "stayTotalPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BookingRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomBlock" (
    "id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RoomBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomReservation" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "bookingRoomId" UUID,
    "roomBlockId" UUID,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "state" "ReservationState" NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),
    "releasedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RoomReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "status" "PaymentOrderStatus" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "providerExpiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" UUID NOT NULL,
    "paymentOrderId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "providerPaidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMPTZ(3),
    "resultCode" TEXT,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "csrfHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManageSession" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "csrfHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManageSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cancellation" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "slabId" TEXT NOT NULL,
    "slabLabel" TEXT NOT NULL,
    "hoursUntilCheckIn" DECIMAL(12,4) NOT NULL,
    "advancePaidPaise" INTEGER NOT NULL,
    "deductionBasisPoints" INTEGER NOT NULL,
    "deductionPaise" INTEGER NOT NULL,
    "refundablePaise" INTEGER NOT NULL,
    "refundStatus" "RefundStatus" NOT NULL,
    "actualRefundPaise" INTEGER,
    "providerRefundReference" TEXT,
    "cancelledAt" TIMESTAMPTZ(3) NOT NULL,
    "approvedAt" TIMESTAMPTZ(3),
    "processedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Cancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingEvent" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "actorType" "BookingEventActor" NOT NULL,
    "actorId" TEXT,
    "deltaPaise" INTEGER,
    "data" JSONB NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRequest" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "keyHash" CHAR(64) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "bookingId" UUID,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" UUID NOT NULL,
    "bucketKeyHash" CHAR(64) NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomGroup_slug_key" ON "RoomGroup"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Room_roomNumber_key" ON "Room"("roomNumber");

-- CreateIndex
CREATE INDEX "Room_roomGroupId_active_idx" ON "Room"("roomGroupId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TariffRevision_revision_key" ON "TariffRevision"("revision");

-- CreateIndex
CREATE INDEX "TariffRate_roomGroupId_tariffRevisionId_idx" ON "TariffRate"("roomGroupId", "tariffRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "TariffRate_tariffRevisionId_roomGroupId_tariffOccupancy_acM_key" ON "TariffRate"("tariffRevisionId", "roomGroupId", "tariffOccupancy", "acMode");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPolicyRevision_revision_key" ON "BookingPolicyRevision"("revision");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE INDEX "Booking_status_checkIn_checkOut_idx" ON "Booking"("status", "checkIn", "checkOut");

-- CreateIndex
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");

-- CreateIndex
CREATE INDEX "BookingRoom_bookingId_idx" ON "BookingRoom"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRoom_bookingId_displayOrder_key" ON "BookingRoom"("bookingId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RoomReservation_roomBlockId_key" ON "RoomReservation"("roomBlockId");

-- CreateIndex
CREATE INDEX "RoomReservation_roomId_state_checkIn_checkOut_idx" ON "RoomReservation"("roomId", "state", "checkIn", "checkOut");

-- CreateIndex
CREATE INDEX "RoomReservation_bookingRoomId_state_idx" ON "RoomReservation"("bookingRoomId", "state");

-- CreateIndex
CREATE INDEX "RoomReservation_expiresAt_state_idx" ON "RoomReservation"("expiresAt", "state");

-- CreateIndex
CREATE INDEX "PaymentOrder_bookingId_status_idx" ON "PaymentOrder"("bookingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_provider_providerOrderId_key" ON "PaymentOrder"("provider", "providerOrderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentOrderId_idx" ON "PaymentTransaction"("paymentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_provider_providerPaymentId_key" ON "PaymentTransaction"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_providerEventId_key" ON "WebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_tokenHash_key" ON "CheckoutSession"("tokenHash");

-- CreateIndex
CREATE INDEX "CheckoutSession_bookingId_expiresAt_idx" ON "CheckoutSession"("bookingId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManageSession_tokenHash_key" ON "ManageSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ManageSession_bookingId_expiresAt_idx" ON "ManageSession"("bookingId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cancellation_bookingId_key" ON "Cancellation"("bookingId");

-- CreateIndex
CREATE INDEX "BookingEvent_bookingId_createdAt_idx" ON "BookingEvent"("bookingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingEvent_bookingId_type_idempotencyKey_key" ON "BookingEvent"("bookingId", "type", "idempotencyKey");

-- CreateIndex
CREATE INDEX "IdempotencyRequest_expiresAt_idx" ON "IdempotencyRequest"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRequest_scope_keyHash_key" ON "IdempotencyRequest"("scope", "keyHash");

-- CreateIndex
CREATE INDEX "RateLimitBucket_windowStart_idx" ON "RateLimitBucket"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_bucketKeyHash_windowStart_windowSeconds_key" ON "RateLimitBucket"("bucketKeyHash", "windowStart", "windowSeconds");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomGroupId_fkey" FOREIGN KEY ("roomGroupId") REFERENCES "RoomGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffRate" ADD CONSTRAINT "TariffRate_tariffRevisionId_fkey" FOREIGN KEY ("tariffRevisionId") REFERENCES "TariffRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffRate" ADD CONSTRAINT "TariffRate_roomGroupId_fkey" FOREIGN KEY ("roomGroupId") REFERENCES "RoomGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tariffRevisionId_fkey" FOREIGN KEY ("tariffRevisionId") REFERENCES "TariffRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_policyRevisionId_fkey" FOREIGN KEY ("policyRevisionId") REFERENCES "BookingPolicyRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRoom" ADD CONSTRAINT "BookingRoom_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRoom" ADD CONSTRAINT "BookingRoom_roomGroupId_fkey" FOREIGN KEY ("roomGroupId") REFERENCES "RoomGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomReservation" ADD CONSTRAINT "RoomReservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomReservation" ADD CONSTRAINT "RoomReservation_bookingRoomId_fkey" FOREIGN KEY ("bookingRoomId") REFERENCES "BookingRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomReservation" ADD CONSTRAINT "RoomReservation_roomBlockId_fkey" FOREIGN KEY ("roomBlockId") REFERENCES "RoomBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManageSession" ADD CONSTRAINT "ManageSession_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cancellation" ADD CONSTRAINT "Cancellation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRequest" ADD CONSTRAINT "IdempotencyRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PostgreSQL-enforced domain invariants that Prisma Schema Language cannot express.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "HotelSettings"
  ADD CONSTRAINT "HotelSettings_operational_values_check" CHECK (
    "checkInLocalMinutes" BETWEEN 0 AND 1439 AND
    "checkOutLocalMinutes" BETWEEN 0 AND 1439 AND
    "minNights" > 0 AND "maxNights" >= "minNights"
  );

ALTER TABLE "RoomGroup"
  ADD CONSTRAINT "RoomGroup_occupancy_check" CHECK (
    "occupancyMin" > 0 AND "occupancyMax" >= "occupancyMin"
  );

ALTER TABLE "TariffRate"
  ADD CONSTRAINT "TariffRate_money_check" CHECK (
    "tariffOccupancy" > 0 AND
    "ratePerPersonPaise" > 0 AND
    mod("ratePerPersonPaise", 2) = 0
  );

ALTER TABLE "BookingPolicyRevision"
  ADD CONSTRAINT "BookingPolicyRevision_values_check" CHECK (
    "advanceBasisPoints" BETWEEN 0 AND 10000 AND "holdTtlMinutes" > 0
  );

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_dates_check" CHECK ("checkOut" > "checkIn"),
  ADD CONSTRAINT "Booking_composition_check" CHECK (
    "adults" > 0 AND "childrenUnder5" >= 0 AND "children5To10" >= 0
  ),
  ADD CONSTRAINT "Booking_money_check" CHECK (
    "nights" > 0 AND "subtotalPaise" >= 0 AND
    "advanceBasisPoints" BETWEEN 0 AND 10000 AND
    "advanceDuePaise" >= 0 AND "advancePaidPaise" >= 0 AND
    "outstandingPaise" >= 0
  ),
  ADD CONSTRAINT "Booking_lifecycle_check" CHECK (
    ("status" = 'PENDING_PAYMENT' AND "reference" IS NULL AND "holdExpiresAt" IS NOT NULL) OR
    ("status" = 'EXPIRED' AND "reference" IS NULL) OR
    ("status" IN ('CONFIRMED', 'CANCELLED') AND "reference" IS NOT NULL)
  );

ALTER TABLE "BookingRoom"
  ADD CONSTRAINT "BookingRoom_composition_check" CHECK (
    "adults" >= 0 AND "childrenUnder5" >= 0 AND "children5To10" >= 0 AND
    "physicalOccupancy" = "adults" + "childrenUnder5" + "children5To10" AND
    "billingHalfUnits" = ("adults" * 2) + "children5To10" AND
    "physicalOccupancy" BETWEEN 1 AND 6 AND
    "tariffOccupancy" BETWEEN 2 AND 6
  ),
  ADD CONSTRAINT "BookingRoom_money_check" CHECK (
    "ratePerPersonPaise" > 0 AND mod("ratePerPersonPaise", 2) = 0 AND
    "nightlyTotalPaise" >= 0 AND "nights" > 0 AND
    "stayTotalPaise" = "nightlyTotalPaise" * "nights"
  );

ALTER TABLE "RoomReservation"
  ADD CONSTRAINT "RoomReservation_dates_check" CHECK ("checkOut" > "checkIn"),
  ADD CONSTRAINT "RoomReservation_owner_check" CHECK (
    (("bookingRoomId" IS NOT NULL)::integer + ("roomBlockId" IS NOT NULL)::integer) = 1
  ),
  ADD CONSTRAINT "RoomReservation_hold_expiry_check" CHECK (
    "state" <> 'HELD' OR "expiresAt" IS NOT NULL
  ),
  ADD CONSTRAINT "RoomReservation_state_timestamps_check" CHECK (
    ("state" = 'HELD' AND "releasedAt" IS NULL) OR
    ("state" = 'CONFIRMED' AND "expiresAt" IS NULL AND "releasedAt" IS NULL) OR
    ("state" = 'RELEASED' AND "releasedAt" IS NOT NULL)
  );

ALTER TABLE "PaymentOrder"
  ADD CONSTRAINT "PaymentOrder_money_check" CHECK ("amountPaise" > 0);

ALTER TABLE "PaymentTransaction"
  ADD CONSTRAINT "PaymentTransaction_money_check" CHECK ("amountPaise" > 0);

ALTER TABLE "Cancellation"
  ADD CONSTRAINT "Cancellation_money_check" CHECK (
    "advancePaidPaise" >= 0 AND
    "deductionBasisPoints" BETWEEN 0 AND 10000 AND
    "deductionPaise" >= 0 AND "refundablePaise" >= 0 AND
    "deductionPaise" + "refundablePaise" = "advancePaidPaise" AND
    ("actualRefundPaise" IS NULL OR "actualRefundPaise" >= 0)
  );

ALTER TABLE "RateLimitBucket"
  ADD CONSTRAINT "RateLimitBucket_values_check" CHECK (
    "windowSeconds" > 0 AND "count" >= 0
  );

CREATE UNIQUE INDEX "TariffRevision_one_active_key"
  ON "TariffRevision" ((true)) WHERE "retiredAt" IS NULL;

CREATE UNIQUE INDEX "BookingPolicyRevision_one_active_key"
  ON "BookingPolicyRevision" ((true)) WHERE "retiredAt" IS NULL;

CREATE UNIQUE INDEX "RoomReservation_one_active_booking_room_key"
  ON "RoomReservation" ("bookingRoomId")
  WHERE "bookingRoomId" IS NOT NULL AND "state" IN ('HELD', 'CONFIRMED');

ALTER TABLE "RoomReservation"
  ADD CONSTRAINT "RoomReservation_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    daterange("checkIn", "checkOut", '[)') WITH &&
  ) WHERE ("state" IN ('HELD', 'CONFIRMED'));
