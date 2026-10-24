-- CreateEnum
CREATE TYPE "GroomingPaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- AlterTable
ALTER TABLE "grooming_bookings" ADD COLUMN     "payment_status" "GroomingPaymentStatus" NOT NULL DEFAULT 'UNPAID';
