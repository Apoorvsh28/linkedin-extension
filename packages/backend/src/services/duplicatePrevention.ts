import type { ActionType } from "@lgx/shared";
import { prisma } from "../db/client.js";
import { logSystemEvent } from "./systemLog.js";

const LIVE_STATUSES = ["pending_approval", "queued", "in_progress"] as const;

export async function hasLiveDuplicate(leadId: string, actionType: ActionType): Promise<boolean> {
  const existing = await prisma.action.findFirst({
    where: { leadId, actionType, status: { in: [...LIVE_STATUSES] } },
  });
  return existing !== null;
}

/** Returns true (and logs) if a live duplicate already exists — caller should skip creating a new one. */
export async function guardDuplicateAction(
  leadId: string,
  actionType: ActionType,
  campaignId?: string | null,
): Promise<boolean> {
  const dup = await hasLiveDuplicate(leadId, actionType);
  if (dup) {
    await logSystemEvent("duplicate_skip", `Skipped duplicate ${actionType} for lead ${leadId} — one is already live`, {
      leadId,
      campaignId: campaignId ?? undefined,
    });
  }
  return dup;
}
