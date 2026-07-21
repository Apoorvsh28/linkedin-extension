-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('outbound', 'inbound');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('thank_you', 'qualification_question', 'ai_reply', 'manual');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('pending', 'done', 'dismissed');

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "message_type" "MessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedin_message_id" TEXT,
    "ai_model_used" TEXT,
    "ai_input_tokens" INTEGER,
    "ai_output_tokens" INTEGER,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualification_answers" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "question_key" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "answer_text" TEXT NOT NULL,
    "extracted_value" JSONB,
    "confidence" DOUBLE PRECISION,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qualification_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "reminder_type" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_config" (
    "id" TEXT NOT NULL,
    "kill_switch" BOOLEAN NOT NULL DEFAULT false,
    "connection_requests_per_day" INTEGER NOT NULL,
    "connection_requests_per_week" INTEGER NOT NULL,
    "likes_per_day" INTEGER NOT NULL,
    "comments_per_day" INTEGER NOT NULL,
    "messages_per_day" INTEGER NOT NULL,
    "profile_visits_per_day" INTEGER NOT NULL,
    "search_pages_per_day" INTEGER NOT NULL,
    "active_hours_start_hour" INTEGER NOT NULL,
    "active_hours_end_hour" INTEGER NOT NULL,
    "active_hours_jitter_minutes" INTEGER NOT NULL,
    "min_delay_seconds" INTEGER NOT NULL,
    "max_delay_seconds" INTEGER NOT NULL,
    "break_every_actions_min" INTEGER NOT NULL,
    "break_every_actions_max" INTEGER NOT NULL,
    "break_duration_min_minutes" INTEGER NOT NULL,
    "break_duration_max_minutes" INTEGER NOT NULL,
    "session_max_duration_minutes_min" INTEGER NOT NULL,
    "session_max_duration_minutes_max" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safety_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_lead_id_idx" ON "messages"("lead_id");

-- CreateIndex
CREATE INDEX "qualification_answers_lead_id_idx" ON "qualification_answers"("lead_id");

-- CreateIndex
CREATE INDEX "reminders_lead_id_idx" ON "reminders"("lead_id");

-- CreateIndex
CREATE INDEX "reminders_due_at_status_idx" ON "reminders"("due_at", "status");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualification_answers" ADD CONSTRAINT "qualification_answers_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
