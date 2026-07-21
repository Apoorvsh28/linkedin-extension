-- CreateEnum
CREATE TYPE "LeadCrmStatus" AS ENUM ('NEW', 'ENGAGING', 'CONNECT_PENDING', 'CONNECTED', 'QUALIFIED', 'MANUAL_FOLLOWUP', 'CLOSED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('active', 'paused', 'completed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionStatus" ADD VALUE 'pending_approval';
ALTER TYPE "ActionStatus" ADD VALUE 'blocked';

-- AlterEnum
BEGIN;
CREATE TYPE "ActionType_new" AS ENUM ('view_profile', 'like_post', 'comment_post', 'connect_request', 'send_message', 'check_connection_status', 'check_reply');
ALTER TABLE "actions" ALTER COLUMN "action_type" TYPE "ActionType_new" USING ("action_type"::text::"ActionType_new");
ALTER TYPE "ActionType" RENAME TO "ActionType_old";
ALTER TYPE "ActionType_new" RENAME TO "ActionType";
DROP TYPE "ActionType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "MessageType_new" AS ENUM ('connection_note', 'welcome_message', 'qualification_question', 'follow_up', 'ai_reply', 'manual');
ALTER TABLE "messages" ALTER COLUMN "message_type" TYPE "MessageType_new" USING ("message_type"::text::"MessageType_new");
ALTER TYPE "MessageType" RENAME TO "MessageType_old";
ALTER TYPE "MessageType_new" RENAME TO "MessageType";
DROP TYPE "MessageType_old";
COMMIT;

-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_attempt_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "stage",
ADD COLUMN     "campaign_id" TEXT,
ADD COLUMN     "company" TEXT,
ADD COLUMN     "engaged_post_urls" TEXT[],
ADD COLUMN     "engagement_day" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "next_engagement_at" TIMESTAMP(3),
ADD COLUMN     "status" "LeadCrmStatus" NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "safety_config" ADD COLUMN     "connection_check_interval_hours" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "max_action_attempts" INTEGER NOT NULL DEFAULT 3;

-- DropTable
DROP TABLE "search_keywords";

-- DropEnum
DROP TYPE "LeadStage";

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[],
    "locations" TEXT[],
    "persona" "Persona",
    "status" "CampaignStatus" NOT NULL DEFAULT 'active',
    "daily_connection_limit" INTEGER NOT NULL DEFAULT 15,
    "daily_message_limit" INTEGER NOT NULL DEFAULT 25,
    "daily_search_limit" INTEGER NOT NULL DEFAULT 15,
    "min_delay_seconds" INTEGER NOT NULL DEFAULT 20,
    "max_delay_seconds" INTEGER NOT NULL DEFAULT 90,
    "engagement_interval_hours" INTEGER NOT NULL DEFAULT 24,
    "connection_note_template" TEXT,
    "welcome_message_template" TEXT,
    "qualification_questions" TEXT[],
    "follow_up_template" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_tasks" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "location" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executed_at" TIMESTAMP(3),
    "leads_found" INTEGER,
    "error_message" TEXT,

    CONSTRAINT "search_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_tasks_campaign_id_idx" ON "search_tasks"("campaign_id");

-- CreateIndex
CREATE INDEX "search_tasks_status_scheduled_at_idx" ON "search_tasks"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "actions_status_scheduled_at_idx" ON "actions"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "leads_campaign_id_idx" ON "leads"("campaign_id");

-- CreateIndex
CREATE INDEX "leads_status_next_engagement_at_idx" ON "leads"("status", "next_engagement_at");

-- AddForeignKey
ALTER TABLE "search_tasks" ADD CONSTRAINT "search_tasks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
