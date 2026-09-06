-- CreateTable
CREATE TABLE "RefundOtpChallenge" (
    "id" UUID NOT NULL,
    "cancellationId" UUID NOT NULL,
    "otpHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMPTZ(3),
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefundOtpChallenge_cancellationId_createdAt_idx" ON "RefundOtpChallenge"("cancellationId", "createdAt");

-- AddForeignKey
ALTER TABLE "RefundOtpChallenge" ADD CONSTRAINT "RefundOtpChallenge_cancellationId_fkey" FOREIGN KEY ("cancellationId") REFERENCES "Cancellation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
