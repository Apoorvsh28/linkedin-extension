import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { HttpError } from "../middleware/errorHandler.js";
import { applyLeadEvent, LEAD_EVENTS, type LeadEvent } from "../services/leadStateMachine.js";
import { logSystemEvent } from "../services/systemLog.js";
import { scoreLead } from "../services/claude.service.js";
import { classifySeniority } from "../services/seniority.js";

export const leadsRouter: Router = Router();

const personaEnum = z.enum([
  "radiologist",
  "diagnostic_centre_owner",
  "teleradiology_founder",
]);

const scrapedLeadCardSchema = z.object({
  linkedinProfileUrl: z.string().url(),
  fullName: z.string().min(1),
  headline: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  persona: personaEnum,
  campaignId: z.string().uuid().optional(),
});

const bulkUpsertSchema = z.array(scrapedLeadCardSchema).min(1);

// POST /api/leads — bulk upsert scraped search-result cards
leadsRouter.post("/", async (req, res, next) => {
  try {
    const cards = bulkUpsertSchema.parse(req.body);

    const existingUrls = new Set(
      (
        await prisma.lead.findMany({
          where: { linkedinProfileUrl: { in: cards.map((c) => c.linkedinProfileUrl) } },
          select: { linkedinProfileUrl: true },
        })
      ).map((l) => l.linkedinProfileUrl),
    );

    for (const card of cards) {
      if (existingUrls.has(card.linkedinProfileUrl)) {
        await logSystemEvent("duplicate_skip", `${card.fullName} already known — refreshed instead of re-added`, {
          campaignId: card.campaignId,
        });
      }
    }

    const results = await Promise.all(
      cards.map((card) =>
        prisma.lead.upsert({
          where: { linkedinProfileUrl: card.linkedinProfileUrl },
          update: {
            fullName: card.fullName,
            headline: card.headline ?? undefined,
            location: card.location ?? undefined,
            lastSyncedAt: new Date(),
          },
          create: {
            linkedinProfileUrl: card.linkedinProfileUrl,
            fullName: card.fullName,
            headline: card.headline ?? null,
            location: card.location ?? null,
            persona: card.persona,
            campaignId: card.campaignId ?? null,
          },
        }),
      ),
    );

    res.status(201).json({ upserted: results.length, leads: results });
  } catch (err) {
    next(err);
  }
});

const snapshotSchema = z.object({
  headline: z.string().nullable().optional(),
  aboutText: z.string().nullable().optional(),
  currentPosition: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  activitySignals: z.object({
    recentPostTimestamps: z.array(z.string()),
    postCountLast30Days: z.number(),
  }),
  rawExtract: z.record(z.unknown()),
});

// POST /api/leads/:id/snapshot — profile scrape result
leadsRouter.post("/:id/snapshot", async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = snapshotSchema.parse(req.body);

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new HttpError(404, "Lead not found");

    const snapshot = await prisma.profileSnapshot.create({
      data: {
        leadId: id,
        headline: body.headline ?? null,
        aboutText: body.aboutText ?? null,
        currentPosition: body.currentPosition ?? null,
        company: body.company ?? null,
        activitySignals: body.activitySignals as Prisma.InputJsonValue,
        rawExtract: body.rawExtract as Prisma.InputJsonValue,
      },
    });

    await prisma.lead.update({
      where: { id },
      data: {
        headline: body.headline ?? lead.headline,
        company: body.company ?? lead.company,
        activityLevel: body.activitySignals.postCountLast30Days > 0 ? "active" : "inactive",
        seniority: classifySeniority(body.currentPosition ?? body.headline ?? lead.headline),
        lastSyncedAt: new Date(),
      },
    });

    res.status(201).json(snapshot);

    // Fire-and-forget: score after responding so a slow/unavailable Claude call never blocks the scrape flow.
    void scoreAndPersist(id, {
      persona: lead.persona,
      fullName: lead.fullName,
      headline: body.headline ?? lead.headline,
      currentPosition: body.currentPosition ?? null,
      company: body.company ?? lead.company,
      aboutText: body.aboutText ?? null,
      postCountLast30Days: body.activitySignals.postCountLast30Days,
    });
  } catch (err) {
    next(err);
  }
});

async function scoreAndPersist(
  leadId: string,
  input: Parameters<typeof scoreLead>[0],
): Promise<void> {
  try {
    const { score, reason } = await scoreLead(input);
    await prisma.lead.update({ where: { id: leadId }, data: { score, scoreReason: reason } });
  } catch (err) {
    console.error(`[leads] failed to score lead ${leadId}`, err);
  }
}

// POST /api/leads/:id/score — manual re-score using the latest profile snapshot
leadsRouter.post("/:id/score", async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: { profileSnapshots: { orderBy: { scrapedAt: "desc" }, take: 1 } },
    });
    if (!lead) throw new HttpError(404, "Lead not found");

    const snapshot = lead.profileSnapshots[0];
    const activitySignals = snapshot?.activitySignals as { postCountLast30Days?: number } | undefined;

    const { score, reason } = await scoreLead({
      persona: lead.persona,
      fullName: lead.fullName,
      headline: lead.headline,
      currentPosition: snapshot?.currentPosition ?? null,
      company: lead.company,
      aboutText: snapshot?.aboutText ?? null,
      postCountLast30Days: activitySignals?.postCountLast30Days ?? 0,
    });

    const updated = await prisma.lead.update({ where: { id: lead.id }, data: { score, scoreReason: reason } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/leads — filterable CRM list
leadsRouter.get("/", async (req, res, next) => {
  try {
    const { status, persona, campaignId, q, page = "1", pageSize = "50" } = req.query;

    const where: Record<string, unknown> = {};
    if (typeof status === "string") where.status = status;
    if (typeof persona === "string") where.persona = persona;
    if (typeof campaignId === "string") where.campaignId = campaignId;
    if (typeof q === "string" && q.length > 0) {
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { headline: { contains: q, mode: "insensitive" } },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSizeNum = Math.min(200, Math.max(1, Number(pageSize) || 50));

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { lastSyncedAt: "desc" },
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({ leads, total, page: pageNum, pageSize: pageSizeNum });
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/:id — detail
leadsRouter.get("/:id", async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        profileSnapshots: { orderBy: { scrapedAt: "desc" }, take: 5 },
        actions: { orderBy: { scheduledAt: "desc" }, take: 20 },
      },
    });
    if (!lead) throw new HttpError(404, "Lead not found");
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

const leadStatusEnum = z.enum([
  "NEW",
  "ENGAGING",
  "CONNECT_APPROVAL",
  "CONNECT_PENDING",
  "WELCOME_PENDING",
  "CONNECTED",
  "QUALIFY_PENDING",
  "QUALIFIED",
  "MANUAL_FOLLOWUP",
  "CLOSED",
]);
const dealStatusEnum = z.enum(["open", "won", "lost"]);

const patchSchema = z.object({
  status: leadStatusEnum.optional(),
  campaignId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  meetingBooked: z.boolean().optional(),
  dealStatus: dealStatusEnum.optional(),
  dealValue: z.number().nullable().optional(),
  industry: z.string().nullable().optional(),
  companySize: z.number().int().nullable().optional(),
});

// PATCH /api/leads/:id — manual status override / campaign assignment / notes / meeting-booked / deal toggle
leadsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = patchSchema.parse(req.body);
    const data: Prisma.LeadUncheckedUpdateInput = {
      ...(body.status ? { status: body.status } : {}),
      ...(body.campaignId !== undefined ? { campaignId: body.campaignId } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.meetingBooked !== undefined ? { meetingBookedAt: body.meetingBooked ? new Date() : null } : {}),
      ...(body.dealStatus ? { dealStatus: body.dealStatus } : {}),
      ...(body.dealValue !== undefined ? { dealValue: body.dealValue } : {}),
      ...(body.industry !== undefined ? { industry: body.industry } : {}),
      ...(body.companySize !== undefined ? { companySize: body.companySize } : {}),
    };
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data });
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

const eventSchema = z.object({
  event: z.enum(LEAD_EVENTS as [string, ...string[]]),
});

// POST /api/leads/:id/events — state-machine-guarded status transition (used by the extension's monitors)
leadsRouter.post("/:id/events", async (req, res, next) => {
  try {
    const body = eventSchema.parse(req.body);
    const lead = await applyLeadEvent(req.params.id, body.event as LeadEvent);
    if (!lead) throw new HttpError(404, "Lead not found");
    res.json(lead);
  } catch (err) {
    next(err);
  }
});
