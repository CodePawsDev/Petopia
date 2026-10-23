-- CreateEnum
CREATE TYPE "GroomingBookingStatus" AS ENUM ('CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "grooming_bookings" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "groomer_id" UUID NOT NULL,
    "status" "GroomingBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "service_ends_at" TIMESTAMPTZ(3) NOT NULL,
    "occupied_ends_at" TIMESTAMPTZ(3) NOT NULL,
    "timezone" VARCHAR(100) NOT NULL,
    "pet_name" VARCHAR(100) NOT NULL,
    "pet_species" "PetSpecies" NOT NULL,
    "pet_weight_kg" DECIMAL(6,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'THB',
    "total_price_satang" INTEGER NOT NULL,
    "total_duration_minutes" INTEGER NOT NULL,
    "buffer_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "grooming_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grooming_booking_items" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "rate_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "kind" "GroomingServiceKind" NOT NULL,
    "price_satang" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "grooming_booking_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grooming_bookings_owner_id_starts_at_idx" ON "grooming_bookings"("owner_id", "starts_at");

-- CreateIndex
CREATE INDEX "grooming_bookings_pet_id_starts_at_idx" ON "grooming_bookings"("pet_id", "starts_at");

-- CreateIndex
CREATE INDEX "grooming_bookings_branch_id_starts_at_idx" ON "grooming_bookings"("branch_id", "starts_at");

-- CreateIndex
CREATE INDEX "grooming_bookings_groomer_id_starts_at_occupied_ends_at_idx" ON "grooming_bookings"("groomer_id", "starts_at", "occupied_ends_at");

-- CreateIndex
CREATE INDEX "grooming_booking_items_service_id_idx" ON "grooming_booking_items"("service_id");

-- CreateIndex
CREATE INDEX "grooming_booking_items_rate_id_idx" ON "grooming_booking_items"("rate_id");

-- CreateIndex
CREATE UNIQUE INDEX "grooming_booking_items_booking_id_service_id_key" ON "grooming_booking_items"("booking_id", "service_id");

-- CreateIndex
CREATE UNIQUE INDEX "grooming_booking_items_booking_id_sort_order_key" ON "grooming_booking_items"("booking_id", "sort_order");

-- AddForeignKey
ALTER TABLE "grooming_bookings" ADD CONSTRAINT "grooming_bookings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_bookings" ADD CONSTRAINT "grooming_bookings_groomer_id_fkey" FOREIGN KEY ("groomer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_bookings" ADD CONSTRAINT "grooming_bookings_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_bookings" ADD CONSTRAINT "grooming_bookings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_booking_items" ADD CONSTRAINT "grooming_booking_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "grooming_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_booking_items" ADD CONSTRAINT "grooming_booking_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "grooming_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_booking_items" ADD CONSTRAINT "grooming_booking_items_rate_id_fkey" FOREIGN KEY ("rate_id") REFERENCES "grooming_service_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Support UUID equality in GiST exclusion constraints.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Preserve valid monetary amounts, durations and pet weight.
ALTER TABLE "grooming_bookings"
ADD CONSTRAINT "grooming_bookings_values_check"
CHECK (
    "total_price_satang" >= 0
    AND "total_duration_minutes" > 0
    AND "buffer_minutes" = 15
    AND "pet_weight_kg" > 0
    AND "currency" = 'THB'
    AND "timezone" = 'Asia/Bangkok'
);

-- Stored timestamps must match the service duration and buffer.
ALTER TABLE "grooming_bookings"
ADD CONSTRAINT "grooming_bookings_duration_check"
CHECK (
    "service_ends_at" =
        "starts_at"
        + "total_duration_minutes" * INTERVAL '1 minute'
    AND "occupied_ends_at" =
        "service_ends_at"
        + "buffer_minutes" * INTERVAL '1 minute'
);

-- Appointment starts must fall on exact 15-minute boundaries.
ALTER TABLE "grooming_bookings"
ADD CONSTRAINT "grooming_bookings_start_boundary_check"
CHECK (
    EXTRACT(SECOND FROM "starts_at" AT TIME ZONE 'Asia/Bangkok') = 0
    AND EXTRACT(MINUTE FROM "starts_at" AT TIME ZONE 'Asia/Bangkok')::INTEGER % 15 = 0
);

-- Prevent overlapping occupied intervals for the same groomer,
-- including appointments at different branches.
-- Keep completed and no-show appointments in historical conflict checks.
-- Cancelled appointments release their occupied interval.
ALTER TABLE "grooming_bookings"
ADD CONSTRAINT "grooming_bookings_groomer_no_overlap"
EXCLUDE USING gist (
    "groomer_id" WITH =,
    tstzrange("starts_at", "occupied_ends_at", '[)') WITH &&
)
WHERE ("status" IN ('CONFIRMED', 'COMPLETED', 'NO_SHOW'));

ALTER TABLE "grooming_booking_items"
ADD CONSTRAINT "grooming_booking_items_values_check"
CHECK (
    "price_satang" >= 0
    AND "duration_minutes" > 0
    AND "sort_order" >= 0
);
