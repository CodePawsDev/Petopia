-- CreateTable
CREATE TABLE "groomer_working_intervals" (
    "id" UUID NOT NULL,
    "groomer_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "groomer_working_intervals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groomer_time_offs" (
    "id" UUID NOT NULL,
    "groomer_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "groomer_time_offs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "groomer_working_intervals_branch_id_groomer_id_weekday_idx" ON "groomer_working_intervals"("branch_id", "groomer_id", "weekday");

-- CreateIndex
CREATE INDEX "groomer_working_intervals_groomer_id_weekday_idx" ON "groomer_working_intervals"("groomer_id", "weekday");

-- CreateIndex
CREATE INDEX "groomer_time_offs_branch_id_groomer_id_starts_at_idx" ON "groomer_time_offs"("branch_id", "groomer_id", "starts_at");

-- CreateIndex
CREATE INDEX "groomer_time_offs_groomer_id_starts_at_ends_at_idx" ON "groomer_time_offs"("groomer_id", "starts_at", "ends_at");

-- AddForeignKey
ALTER TABLE "groomer_working_intervals" ADD CONSTRAINT "groomer_working_intervals_groomer_id_fkey" FOREIGN KEY ("groomer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groomer_working_intervals" ADD CONSTRAINT "groomer_working_intervals_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groomer_time_offs" ADD CONSTRAINT "groomer_time_offs_groomer_id_fkey" FOREIGN KEY ("groomer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groomer_time_offs" ADD CONSTRAINT "groomer_time_offs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Support exclusion constraints combining UUIDs and ranges.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Monday = 1, Sunday = 7.
ALTER TABLE "groomer_working_intervals"
ADD CONSTRAINT "groomer_working_intervals_weekday_check"
CHECK ("weekday" BETWEEN 1 AND 7);

-- Working intervals must stay within 09:00–18:00.
ALTER TABLE "groomer_working_intervals"
ADD CONSTRAINT "groomer_working_intervals_minutes_check"
CHECK (
    "start_minute" >= 540
    AND "end_minute" <= 1080
    AND "start_minute" < "end_minute"
);

-- Prevent overlap for the same groomer across all branches.
-- Adjacent intervals are allowed: [09:00,12:00), [12:00,13:00).
ALTER TABLE "groomer_working_intervals"
ADD CONSTRAINT "groomer_working_intervals_no_overlap"
EXCLUDE USING gist (
    "groomer_id" WITH =,
    "weekday" WITH =,
    int4range("start_minute", "end_minute", '[)') WITH &&
);

-- Time off must have a positive duration.
ALTER TABLE "groomer_time_offs"
ADD CONSTRAINT "groomer_time_offs_time_check"
CHECK ("starts_at" < "ends_at");