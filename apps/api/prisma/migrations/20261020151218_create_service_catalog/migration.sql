-- CreateEnum
CREATE TYPE "GroomingServiceKind" AS ENUM ('BATH', 'BATH_WITH_HAIRCUT', 'COAT_SPA', 'EAR_CLEANING', 'NAIL_TRIMMING', 'TOOTH_BRUSHING');

-- CreateTable
CREATE TABLE "grooming_services" (
    "id" UUID NOT NULL,
    "business_unit_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000),
    "kind" "GroomingServiceKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "grooming_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grooming_service_rates" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "species" "PetSpecies" NOT NULL,
    "min_weight_kg" DECIMAL(6,3) NOT NULL,
    "max_weight_kg" DECIMAL(6,3) NOT NULL,
    "price_satang" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "requires_assessment" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "grooming_service_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grooming_services_business_unit_id_active_sort_order_idx" ON "grooming_services"("business_unit_id", "active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "grooming_services_business_unit_id_code_key" ON "grooming_services"("business_unit_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "grooming_services_business_unit_id_kind_key" ON "grooming_services"("business_unit_id", "kind");

-- CreateIndex
CREATE INDEX "grooming_service_rates_service_id_species_active_idx" ON "grooming_service_rates"("service_id", "species", "active");

-- CreateIndex
CREATE UNIQUE INDEX "grooming_service_rates_service_id_species_min_weight_kg_max_key" ON "grooming_service_rates"("service_id", "species", "min_weight_kg", "max_weight_kg");

-- AddForeignKey
ALTER TABLE "grooming_services" ADD CONSTRAINT "grooming_services_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_service_rates" ADD CONSTRAINT "grooming_service_rates_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "grooming_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Support equality comparisons in the GiST exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Validate weight bounds, species limits, price and duration
ALTER TABLE "grooming_service_rates"
ADD CONSTRAINT "grooming_service_rates_values_check"
CHECK (
    "min_weight_kg" >= 0
    AND "max_weight_kg" > "min_weight_kg"
    AND "price_satang" > 0
    AND "duration_minutes" > 0
    AND (
        ("species" = 'DOG' AND "max_weight_kg" <= 80)
        OR ("species" = 'CAT' AND "max_weight_kg" <= 15)
        OR ("species" = 'RABBIT' AND "max_weight_kg" <= 8)
    )
    AND ("species" <> 'RABBIT' OR "requires_assessment")
);

-- Active rates for the same service and species must not overlap
ALTER TABLE "grooming_service_rates"
ADD CONSTRAINT "grooming_service_rates_no_active_overlap"
EXCLUDE USING gist (
    "service_id" WITH =,
    "species" WITH =,
    numrange("min_weight_kg", "max_weight_kg", '(]') WITH &&
)
WHERE ("active");

