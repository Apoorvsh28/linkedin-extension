import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { HttpError } from "../middleware/errorHandler.js";
import { getSafetyConfig, SINGLETON_ID } from "../services/safetyConfig.service.js";

export const campaignsRouter: Router = Router();

const personaEnum = z.enum(["radiologist", "diagnostic_centre_owner", "teleradiology_founder"]);
const statusEnum = z.enum(["active", "paused", "completed"]);
const activityLevelEnum = z.enum(["active", "inactive", "unknown"]);
const actionTypeEnum = z.enum([
  "view_profile",
  "like_post",
  "comment_post",
  "connect_request",
  "send_message",
  "check_connection_status",
  "check_reply",
]);

const sequenceStepSchema = z.object({
  day: z.number().int().positive(),
  actions: z.array(actionTypeEnum).min(1),
});

const campaignInputSchema = z.object({
  name: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
  locations: z.array(z.string().min(1)).default([]),
  persona: personaEnum.nullable().optional(),
  status: statusEnum.optional(),
  dailyConnectionLimit: z.number().int().positive().optional(),
  dailyMessageLimit: z.number().int().positive().optional(),
  dailySearchLimit: z.number().int().positive().optional(),
  minDelaySeconds: z.number().int().positive().optional(),
  maxDelaySeconds: z.number().int().positive().optional(),
  engagementIntervalHours: z.number().int().min(0).optional(), // 0 means "advance on every engine tick, no wait"
  connectionNoteTemplate: z.string().nullable().optional(),
  welcomeMessageTemplate: z.string().nullable().optional(),
  qualificationQuestions: z.array(z.string().min(1)).optional(),
  followUpTemplate: z.string().nullable().optional(),
  industries: z.array(z.string().min(1)).optional(),
  companySizeMin: z.number().int().positive().nullable().optional(),
  companySizeMax: z.number().int().positive().nullable().optional(),
  seniorities: z.array(z.string().min(1)).optional(),
  currentCompanies: z.array(z.string().min(1)).optional(),
  minActivityLevel: activityLevelEnum.nullable().optional(),
  sequenceSteps: z.array(sequenceStepSchema).nullable().optional(),
});

// GET /api/campaigns
campaignsRouter.get("/", async (_req, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { leads: true } } },
    });
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id
campaignsRouter.get("/:id", async (req, res, next) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) throw new HttpError(404, "Campaign not found");
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns
campaignsRouter.post("/", async (req, res, next) => {
  try {
    const body = campaignInputSchema.parse(req.body);
    const campaign = await prisma.campaign.create({
      data: {
        ...body,
        persona: body.persona ?? null,
        sequenceSteps: body.sequenceSteps === undefined ? undefined : (body.sequenceSteps as Prisma.InputJsonValue),
      },
    });
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns/pause-all — emergency stop: pause every campaign and engage the kill switch
campaignsRouter.post("/pause-all", async (_req, res, next) => {
  try {
    const [{ count }] = await Promise.all([
      prisma.campaign.updateMany({ where: { status: "active" }, data: { status: "paused" } }),
      getSafetyConfig().then(() => prisma.safetyConfig.update({ where: { id: SINGLETON_ID }, data: { killSwitch: true } })),
    ]);
    res.json({ pausedCampaigns: count, killSwitchEngaged: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/campaigns/:id
campaignsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = campaignInputSchema.partial().parse(req.body);
    const existing = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Campaign not found");

    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        ...body,
        sequenceSteps: body.sequenceSteps === undefined ? undefined : (body.sequenceSteps as Prisma.InputJsonValue),
      },
    });
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/campaigns/:id
campaignsRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Campaign not found");
    await prisma.campaign.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns/:id/generate-search-tasks — (re)seed the search queue from keywords x locations
campaignsRouter.post("/:id/generate-search-tasks", async (req, res, next) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) throw new HttpError(404, "Campaign not found");

    const locations: (string | null)[] = campaign.locations.length > 0 ? campaign.locations : [null];
    let created = 0;

    for (const keyword of campaign.keywords) {
      for (const location of locations) {
        const existing = await prisma.searchTask.findFirst({
          where: { campaignId: campaign.id, keyword, location, status: { in: ["queued", "in_progress"] } },
        });
        if (existing) continue;

        await prisma.searchTask.create({ data: { campaignId: campaign.id, keyword, location } });
        created += 1;
      }
    }

    res.status(201).json({ created });
  } catch (err) {
    next(err);
  }
});
