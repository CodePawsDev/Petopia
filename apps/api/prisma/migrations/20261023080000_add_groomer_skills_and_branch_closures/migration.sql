-- CreateTable
CREATE TABLE "groomer_service_skills" (
    "id" UUID NOT NULL,
    "groomer_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "species" "PetSpecies" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "groomer_service_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_closures" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branch_closures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "groomer_service_skills_service_id_species_active_idx" ON "groomer_service_skills"("service_id", "species", "active");

-- CreateIndex
CREATE UNIQUE INDEX "groomer_service_skills_groomer_id_service_id_species_key" ON "groomer_service_skills"("groomer_id", "service_id", "species");

-- CreateIndex
CREATE INDEX "branch_closures_branch_id_starts_at_ends_at_idx" ON "branch_closures"("branch_id", "starts_at", "ends_at");

-- AddForeignKey
ALTER TABLE "groomer_service_skills" ADD CONSTRAINT "groomer_service_skills_groomer_id_fkey" FOREIGN KEY ("groomer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groomer_service_skills" ADD CONSTRAINT "groomer_service_skills_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "grooming_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_closures" ADD CONSTRAINT "branch_closures_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A branch closure must have a positive duration.
ALTER TABLE "branch_closures"
ADD CONSTRAINT "branch_closures_time_check"
CHECK ("starts_at" < "ends_at");