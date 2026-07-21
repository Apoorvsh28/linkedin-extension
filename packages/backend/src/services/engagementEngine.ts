import type { EngineTickResultDto, SequenceStep } from "@lgx/shared";
import { APPROVAL_REQUIRED_ACTION_TYPES, DEFAULT_SEQUENCE_STEPS } from "@lgx/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { applyLeadEvent } from "./leadStateMachine.js";
import { onActionProposed } from "./approvalEvents.js";
import { guardDuplicateAction } from "./duplicatePrevention.js";
import { leadMatchesCampaignFilters } from "./campaignFilters.js";

function getSequenceSteps(campaign: { sequenceSteps: unknown }): SequenceStep[] {
  const raw = campaign.sequenceSteps as SequenceStep[] | null;
  if (Array.isArray(raw) && raw.length > 0) {
    return [...raw].sort((a, b) => a.day - b.day);
  }
  return DEFAULT_SEQUENCE_STEPS;
}

function appendNote(existing: string | null, note: string): string {
  return existing ? `${existing}\n${note}` : note;
}

/**
 * Advances every active campaign's leads through its message sequence (default: view+like ->
 * like+comment -> like another post -> connect_request, one step per campaign.engagementIntervalHours).
 * connect_request/send_message steps always land as pending_approval — this only decides *what* to
 * queue and *when*; actual dispatch pacing/caps are enforced later by /api/actions/next.
 * From the second step onward, a lead must still match the campaign's targeting filters (the first
 * step always runs regardless, since that's what captures the profile data those filters need).
 */
export async function runEngagementEngineTick(): Promise<EngineTickResultDto> {
  const result: EngineTickResultDto = { leadsAdvanced: 0, actionsCreated: 0, pendingApprovalsCreated: 0 };
  const now = new Date();

  const campaigns = await prisma.campaign.findMany({ where: { status: "active" } });

  for (const campaign of campaigns) {
    const steps = getSequenceSteps(campaign);
    // engagementIntervalHours is a required, non-nullable column (0 is a valid value meaning "no wait") — don't
    // fall back on it, or a campaign explicitly configured for 0-wait would silently get a 24h delay instead.
    const nextEngagementAt = new Date(now.getTime() + campaign.engagementIntervalHours * 60 * 60 * 1000);

    const leads = await prisma.lead.findMany({
      where: {
        campaignId: campaign.id,
        status: { in: ["NEW", "ENGAGING"] },
        engagementDay: { lt: steps.length },
        OR: [{ nextEngagementAt: null }, { nextEngagementAt: { lte: now } }],
      },
    });

    for (const lead of leads) {
      try {
        const stepIndex = lead.engagementDay;
        const step = steps[stepIndex];
        if (!step) continue;

        if (stepIndex > 0 && !leadMatchesCampaignFilters(lead, campaign)) {
          await applyLeadEvent(lead.id, "NEEDS_FOLLOWUP");
          await prisma.lead.update({
            where: { id: lead.id },
            data: { notes: appendNote(lead.notes, "Engagement stopped — lead no longer matches campaign targeting filters.") },
          });
          continue;
        }

        if (stepIndex === 0) {
          await applyLeadEvent(lead.id, "ENGAGEMENT_STARTED");
        }

        for (const actionType of step.actions) {
          if (await guardDuplicateAction(lead.id, actionType, campaign.id)) continue;

          const requiresApproval = APPROVAL_REQUIRED_ACTION_TYPES.includes(actionType);
          const messageType = actionType === "send_message" ? "follow_up" : undefined;
          const details: Record<string, unknown> | undefined =
            actionType === "like_post" && lead.engagedPostUrls.length > 0
              ? { excludePostUrls: lead.engagedPostUrls }
              : messageType
                ? { messageType }
                : undefined;

          await prisma.action.create({
            data: {
              leadId: lead.id,
              actionType,
              status: requiresApproval ? "pending_approval" : "queued",
              scheduledAt: now,
              details: details as Prisma.InputJsonValue | undefined,
            },
          });

          if (requiresApproval) {
            await onActionProposed(lead.id, actionType, messageType);
            result.pendingApprovalsCreated += 1;
          } else {
            result.actionsCreated += 1;
          }
        }

        const isLastStep = stepIndex === steps.length - 1;
        await prisma.lead.update({
          where: { id: lead.id },
          data: { engagementDay: stepIndex + 1, nextEngagementAt: isLastStep ? null : nextEngagementAt },
        });

        result.leadsAdvanced += 1;
      } catch (err) {
        console.error(`[engine] failed to advance lead ${lead.id}`, err);
      }
    }
  }

  return result;
}
