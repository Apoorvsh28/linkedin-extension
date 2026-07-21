import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { ActionType, BulkActionResultDto } from "@lgx/shared";
import { leadTemplateVariables, renderTemplate } from "@lgx/shared";
import { prisma } from "../db/client.js";
import { HttpError } from "../middleware/errorHandler.js";
import { getSafetyConfig } from "../services/safetyConfig.service.js";
import { onActionProposed, onActionRejected, onActionSentSuccessfully } from "../services/approvalEvents.js";
import { guardDuplicateAction } from "../services/duplicatePrevention.js";
import { decideRetry } from "../services/retry.js";
import { logSystemEvent } from "../services/systemLog.js";
import { isWithinActiveHours, countActionsSince, startOfToday, startOfWeek } from "../services/safety.js";

export const actionsRouter: Router = Router();

const actionTypeToCapField: Record<string, keyof Awaited<ReturnType<typeof getSafetyConfig>> | null> = {
  connect_request: "connectionRequestsPerDay",
  like_post: "likesPerDay",
  comment_post: "commentsPerDay",
  send_message: "messagesPerDay",
  view_profile: "profileVisitsPerDay",
  check_connection_status: null,
  check_reply: null,
};

async function countCampaignActionsSince(campaignId: string, actionType: ActionType, since: Date): Promise<number> {
  return prisma.action.count({
    where: { actionType, status: "success", executedAt: { gte: since }, lead: { campaignId } },
  });
}

// GET /api/actions — activities/logs listing (Success/Failed/Retry-in-progress/Blocked/Dead-letter all derivable from status+attempts)
actionsRouter.get("/", async (req, res, next) => {
  try {
    const { status, actionType, leadId, page = "1", pageSize = "50" } = req.query;

    const where: Record<string, unknown> = {};
    if (typeof status === "string") where.status = status;
    if (typeof actionType === "string") where.actionType = actionType;
    if (typeof leadId === "string") where.leadId = leadId;

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSizeNum = Math.min(200, Math.max(1, Number(pageSize) || 50));

    const [actions, total] = await Promise.all([
      prisma.action.findMany({
        where,
        orderBy: { scheduledAt: "desc" },
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
        include: {
          lead: { select: { id: true, fullName: true, headline: true, company: true, location: true, linkedinProfileUrl: true, campaignId: true } },
        },
      }),
      prisma.action.count({ where }),
    ]);

    res.json({ actions, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/actions/pending-approval — the human approval queue (connect_request / send_message)
actionsRouter.get("/pending-approval", async (_req, res, next) => {
  try {
    const actions = await prisma.action.findMany({
      where: { status: "pending_approval" },
      orderBy: { scheduledAt: "asc" },
      include: {
        lead: { select: { id: true, fullName: true, headline: true, company: true, location: true, linkedinProfileUrl: true, campaignId: true } },
      },
    });
    res.json(actions);
  } catch (err) {
    next(err);
  }
});

// GET /api/actions/next — next queued action allowed under safety caps + campaign caps + active hours
actionsRouter.get("/next", async (_req, res, next) => {
  try {
    const config = await getSafetyConfig();

    if (config.killSwitch) {
      res.json({ action: null, reason: "kill_switch_engaged" });
      return;
    }

    if (!isWithinActiveHours(config)) {
      res.json({ action: null, reason: "outside_active_hours" });
      return;
    }

    const candidates = await prisma.action.findMany({
      where: { status: "queued", OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] },
      orderBy: { scheduledAt: "asc" },
      take: 25,
      include: { lead: { include: { campaign: true } } },
    });

    for (const candidate of candidates) {
      const capField = actionTypeToCapField[candidate.actionType];
      if (capField) {
        const dailyCount = await countActionsSince(candidate.actionType, startOfToday());
        if (dailyCount >= (config[capField] as number)) {
          await logSystemEvent("rate_limit", `Global daily cap reached for ${candidate.actionType}`, {
            leadId: candidate.leadId,
          });
          continue;
        }

        if (candidate.actionType === "connect_request") {
          const weeklyCount = await countActionsSince("connect_request", startOfWeek());
          if (weeklyCount >= config.connectionRequestsPerWeek) {
            await logSystemEvent("rate_limit", "Weekly connection request cap reached", { leadId: candidate.leadId });
            continue;
          }
        }
      }

      const campaign = candidate.lead.campaign;
      if (campaign) {
        if (campaign.status !== "active") continue;

        if (candidate.actionType === "connect_request") {
          const count = await countCampaignActionsSince(campaign.id, "connect_request", startOfToday());
          if (count >= campaign.dailyConnectionLimit) {
            await logSystemEvent("daily_limit", `Campaign daily connection limit reached (${campaign.name})`, {
              leadId: candidate.leadId,
              campaignId: campaign.id,
            });
            continue;
          }
        }
        if (candidate.actionType === "send_message") {
          const count = await countCampaignActionsSince(campaign.id, "send_message", startOfToday());
          if (count >= campaign.dailyMessageLimit) {
            await logSystemEvent("daily_limit", `Campaign daily message limit reached (${campaign.name})`, {
              leadId: candidate.leadId,
              campaignId: campaign.id,
            });
            continue;
          }
        }
      }

      res.json({
        action: {
          actionId: candidate.id,
          leadId: candidate.leadId,
          actionType: candidate.actionType,
          linkedinProfileUrl: candidate.lead.linkedinProfileUrl,
          details: candidate.details ?? null,
        },
      });
      return;
    }

    res.json({ action: null, reason: "no_eligible_action" });
  } catch (err) {
    next(err);
  }
});

const reportSchema = z.object({
  status: z.enum(["success", "failed", "skipped"]),
  details: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
});

// POST /api/actions/:id/report — worker reports outcome of an executed action
actionsRouter.post("/:id/report", async (req, res, next) => {
  try {
    const body = reportSchema.parse(req.body);
    const action = await prisma.action.findUnique({ where: { id: req.params.id } });
    if (!action) throw new HttpError(404, "Action not found");

    const config = await getSafetyConfig();
    let status: "success" | "skipped" | "queued" | "dead_letter" = body.status === "failed" ? "queued" : body.status;
    let attempts = action.attempts;
    let scheduledAt = action.scheduledAt;

    if (body.status === "failed") {
      attempts += 1;
      const decision = decideRetry(attempts, config.maxActionAttempts);
      status = decision.status;
      scheduledAt = decision.nextScheduledAt ?? action.scheduledAt;
    }

    const updated = await prisma.action.update({
      where: { id: action.id },
      data: {
        status,
        attempts,
        scheduledAt,
        lastAttemptAt: new Date(),
        executedAt: new Date(),
        details: body.details
          ? (body.details as Prisma.InputJsonValue)
          : (action.details ?? Prisma.JsonNull),
        errorMessage: body.errorMessage ?? null,
      },
    });

    if (body.status === "success") {
      const messageType = (action.details as { messageType?: string } | null)?.messageType;
      await onActionSentSuccessfully(action.leadId, action.actionType, messageType);

      if (action.actionType === "like_post") {
        const likedPostUrl = body.details?.likedPostUrl;
        if (typeof likedPostUrl === "string") {
          await prisma.lead.update({
            where: { id: action.leadId },
            data: { engagedPostUrls: { push: likedPostUrl } },
          });
        }
      }
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

async function approveOne(actionId: string): Promise<void> {
  const action = await prisma.action.findUnique({
    where: { id: actionId },
    include: { lead: { include: { campaign: true } } },
  });
  if (!action) throw new HttpError(404, "Action not found");
  if (action.status !== "pending_approval") throw new HttpError(409, "Action is not awaiting approval");

  const campaign = action.lead.campaign;
  const existingDetails = (action.details as Record<string, unknown> | null) ?? {};
  const messageType = existingDetails.messageType as string | undefined;
  let content: string | undefined;

  if (action.actionType === "connect_request") {
    if (campaign?.connectionNoteTemplate) {
      content = renderTemplate(campaign.connectionNoteTemplate, leadTemplateVariables(action.lead));
    } else if (campaign) {
      await logSystemEvent("template_error", `No connection note template on campaign "${campaign.name}" — sending without a note`, {
        leadId: action.leadId,
        campaignId: campaign.id,
      });
    }
  } else if (action.actionType === "send_message") {
    const template =
      messageType === "welcome_message"
        ? campaign?.welcomeMessageTemplate
        : messageType === "qualification_question"
          ? undefined // qualification questions are asked via Claude, not a static template
          : campaign?.followUpTemplate;
    if (template) {
      content = renderTemplate(template, leadTemplateVariables(action.lead));
    } else if (campaign && (messageType === "welcome_message" || messageType === "follow_up")) {
      await logSystemEvent("template_error", `No ${messageType} template on campaign "${campaign.name}" — will generate live instead`, {
        leadId: action.leadId,
        campaignId: campaign.id,
      });
    }
  }

  await prisma.action.update({
    where: { id: action.id },
    data: {
      status: "queued",
      details: content ? { ...existingDetails, content } : (action.details ?? Prisma.JsonNull),
    },
  });

  await onActionProposed(action.leadId, action.actionType, messageType); // no-op if already in the right status; kept for direct-approve paths that skipped creation-time proposal
}

// POST /api/actions/:id/approve — human approves a pending connect_request/send_message, rendering its template
actionsRouter.post("/:id/approve", async (req, res, next) => {
  try {
    await approveOne(req.params.id);
    const updated = await prisma.action.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const rejectSchema = z.object({ note: z.string().optional() });

async function rejectOne(actionId: string, note?: string): Promise<void> {
  const action = await prisma.action.findUnique({ where: { id: actionId } });
  if (!action) throw new HttpError(404, "Action not found");
  if (action.status !== "pending_approval") throw new HttpError(409, "Action is not awaiting approval");

  const messageType = (action.details as { messageType?: string } | null)?.messageType;

  await prisma.action.update({
    where: { id: action.id },
    data: { status: "blocked", errorMessage: note ?? "Rejected by user" },
  });

  await onActionRejected(action.leadId, action.actionType, messageType);
  await logSystemEvent("manual_rejection", `${action.actionType} rejected${note ? `: ${note}` : ""}`, {
    leadId: action.leadId,
  });
}

// POST /api/actions/:id/reject — human declines a pending connect_request/send_message
actionsRouter.post("/:id/reject", async (req, res, next) => {
  try {
    const body = rejectSchema.parse(req.body ?? {});
    await rejectOne(req.params.id, body.note);
    const updated = await prisma.action.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const bulkSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

async function runBulk(ids: string[], fn: (id: string) => Promise<void>): Promise<BulkActionResultDto> {
  const result: BulkActionResultDto = { succeeded: [], failed: [] };
  for (const id of ids) {
    try {
      await fn(id);
      result.succeeded.push(id);
    } catch (err) {
      result.failed.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

// POST /api/actions/bulk-approve
actionsRouter.post("/bulk-approve", async (req, res, next) => {
  try {
    const body = bulkSchema.parse(req.body);
    res.json(await runBulk(body.ids, approveOne));
  } catch (err) {
    next(err);
  }
});

// POST /api/actions/bulk-reject
actionsRouter.post("/bulk-reject", async (req, res, next) => {
  try {
    const body = bulkSchema.parse(req.body);
    res.json(await runBulk(body.ids, (id) => rejectOne(id)));
  } catch (err) {
    next(err);
  }
});

// POST /api/actions/:id/requeue — manual recovery from dead_letter
actionsRouter.post("/:id/requeue", async (req, res, next) => {
  try {
    const action = await prisma.action.findUnique({ where: { id: req.params.id } });
    if (!action) throw new HttpError(404, "Action not found");
    if (action.status !== "dead_letter") throw new HttpError(409, "Action is not in the dead-letter queue");

    const updated = await prisma.action.update({
      where: { id: action.id },
      data: { status: "queued", attempts: 0, scheduledAt: new Date(), errorMessage: null },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const enqueueSchema = z.object({
  leadId: z.string().uuid(),
  actionType: z.enum([
    "view_profile",
    "like_post",
    "comment_post",
    "connect_request",
    "send_message",
    "check_connection_status",
    "check_reply",
  ]),
  scheduledAt: z.string().datetime().optional(),
  details: z.record(z.unknown()).optional(),
});

// POST /api/actions — enqueue a new action (dashboard-triggered). connect_request/send_message land as
// pending_approval so they go through the Messages approval queue rather than dispatching immediately.
actionsRouter.post("/", async (req, res, next) => {
  try {
    const body = enqueueSchema.parse(req.body);

    const lead = await prisma.lead.findUnique({ where: { id: body.leadId } });
    if (!lead) throw new HttpError(404, "Lead not found");

    if (await guardDuplicateAction(body.leadId, body.actionType, lead.campaignId)) {
      throw new HttpError(409, `A live ${body.actionType} action already exists for this lead`);
    }

    const requiresApproval = body.actionType === "connect_request" || body.actionType === "send_message";

    const action = await prisma.action.create({
      data: {
        leadId: body.leadId,
        actionType: body.actionType,
        status: requiresApproval ? "pending_approval" : "queued",
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : new Date(),
        details: body.details ? (body.details as Prisma.InputJsonValue) : undefined,
      },
    });

    if (requiresApproval) {
      await onActionProposed(body.leadId, body.actionType, body.details?.messageType as string | undefined);
    }

    res.status(201).json(action);
  } catch (err) {
    next(err);
  }
});
