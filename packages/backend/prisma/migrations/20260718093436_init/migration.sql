-- CreateEnum
CREATE TYPE "Persona" AS ENUM ('radiologist', 'diagnostic_centre_owner', 'teleradiology_founder');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('found', 'queued_contact', 'contacted', 'connected', 'thanked', 'qualifying', 'qualified', 'disqualified', 'nurturing', 'meeting_booked', 'closed_lost');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('active', 'inactive', 'unknown');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('none', 'pending', 'accepted', 'withdrawn');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('search_scrape', 'view_profile', 'like_post', 'comment_post', 'connect_request', 'send_message', 'check_connection_status', 'check_reply');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('queued', 'in_progress', 'success', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "linkedin_profile_url" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "headline" TEXT,
    "location" TEXT,
    "persona" "Persona" NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'found',
    "activity_level" "ActivityLevel" NOT NULL DEFAULT 'unknown',
    "connection_status" "ConnectionStatus" NOT NULL DEFAULT 'none',
    "first_found_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_snapshots" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "headline" TEXT,
    "about_text" TEXT,
    "current_position" TEXT,
    "company" TEXT,
    "activity_signals" JSONB NOT NULL,
    "raw_extract" JSONB NOT NULL,

    CONSTRAINT "profile_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "action_type" "ActionType" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'queued',
    "scheduled_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "details" JSONB,
    "error_message" TEXT,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_linkedin_profile_url_key" ON "leads"("linkedin_profile_url");

-- CreateIndex
CREATE INDEX "profile_snapshots_lead_id_idx" ON "profile_snapshots"("lead_id");

-- CreateIndex
CREATE INDEX "actions_lead_id_idx" ON "actions"("lead_id");

-- CreateIndex
CREATE INDEX "actions_action_type_executed_at_idx" ON "actions"("action_type", "executed_at");

-- AddForeignKey
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "profile_snapshots_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
