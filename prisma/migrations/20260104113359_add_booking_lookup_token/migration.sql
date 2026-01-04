-- CreateTable
CREATE TABLE "BookingLookupToken" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingLookupToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingLookupToken_tokenHash_key" ON "BookingLookupToken"("tokenHash");

-- CreateIndex
CREATE INDEX "BookingLookupToken_bookingId_idx" ON "BookingLookupToken"("bookingId");

-- CreateIndex
CREATE INDEX "BookingLookupToken_expiresAt_idx" ON "BookingLookupToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "BookingLookupToken" ADD CONSTRAINT "BookingLookupToken_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
