-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('open', 'won', 'lost');

-- CreateEnum
CREATE TYPE "LogCategory" AS ENUM ('selector_failure', 'rate_limit', 'daily_limit', 'duplicate_skip', 'manual_rejection', 'template_error');

-- AlterEnum
ALTER TYPE "ActionStatus" ADD VALUE 'dead_letter';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadCrmStatus" ADD VALUE 'CONNECT_APPROVAL';
ALTER TYPE "LeadCrmStatus" ADD VALUE 'WELCOME_PENDING';
ALTER TYPE "LeadCrmStatus" ADD VALUE 'QUALIFY_PENDING';

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "company_size_max" INTEGER,
ADD COLUMN     "company_size_min" INTEGER,
ADD COLUMN     "current_companies" TEXT[],
ADD COLUMN     "industries" TEXT[],
ADD COLUMN     "min_activity_level" "ActivityLevel",
ADD COLUMN     "seniorities" TEXT[],
ADD COLUMN     "sequence_steps" JSONB;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "company_size" INTEGER,
ADD COLUMN     "deal_status" "DealStatus" NOT NULL DEFAULT 'open',
ADD COLUMN     "deal_value" DOUBLE PRECISION,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "score" INTEGER,
ADD COLUMN     "score_reason" TEXT,
ADD COLUMN     "seniority" TEXT;

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "category" "LogCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "lead_id" TEXT,
    "campaign_id" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_logs_category_created_at_idx" ON "system_logs"("category", "created_at");

