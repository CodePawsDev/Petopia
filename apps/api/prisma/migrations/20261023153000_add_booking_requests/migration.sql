-- CreateTable
CREATE TABLE "grooming_booking_requests" (
    "owner_id" UUID NOT NULL,
    "request_key" UUID NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "booking_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grooming_booking_requests_pkey" PRIMARY KEY ("owner_id","request_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "grooming_booking_requests_booking_id_key" ON "grooming_booking_requests"("booking_id");

-- AddForeignKey
ALTER TABLE "grooming_booking_requests" ADD CONSTRAINT "grooming_booking_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_booking_requests"
ADD CONSTRAINT "grooming_booking_requests_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "grooming_bookings"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;