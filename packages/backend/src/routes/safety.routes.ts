import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { getSafetyConfig, SINGLETON_ID } from "../services/safetyConfig.service.js";

export const safetyRouter: Router = Router();

// GET /api/safety-config
safetyRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await getSafetyConfig());
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  killSwitch: z.boolean().optional(),
  connectionRequestsPerDay: z.number().int().positive().optional(),
  connectionRequestsPerWeek: z.number().int().positive().optional(),
  likesPerDay: z.number().int().positive().optional(),
  commentsPerDay: z.number().int().positive().optional(),
  messagesPerDay: z.number().int().positive().optional(),
  profileVisitsPerDay: z.number().int().positive().optional(),
  searchPagesPerDay: z.number().int().positive().optional(),
  activeHoursStartHour: z.number().int().min(0).max(23).optional(),
  activeHoursEndHour: z.number().int().min(0).max(23).optional(),
  activeHoursJitterMinutes: z.number().int().min(0).optional(),
  minDelaySeconds: z.number().int().positive().optional(),
  maxDelaySeconds: z.number().int().positive().optional(),
  breakEveryActionsMin: z.number().int().positive().optional(),
  breakEveryActionsMax: z.number().int().positive().optional(),
  breakDurationMinMinutes: z.number().int().positive().optional(),
  breakDurationMaxMinutes: z.number().int().positive().optional(),
  sessionMaxDurationMinutesMin: z.number().int().positive().optional(),
  sessionMaxDurationMinutesMax: z.number().int().positive().optional(),
  connectionCheckIntervalHours: z.number().int().positive().optional(),
  maxActionAttempts: z.number().int().positive().optional(),
});

// PUT /api/safety-config
safetyRouter.put("/", async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    await getSafetyConfig(); // ensure row exists
    const updated = await prisma.safetyConfig.update({
      where: { id: SINGLETON_ID },
      data: body,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/safety-config/kill-switch — quick toggle endpoint for the popup
safetyRouter.post("/kill-switch", async (req, res, next) => {
  try {
    const { engaged } = z.object({ engaged: z.boolean() }).parse(req.body);
    await getSafetyConfig();
    const updated = await prisma.safetyConfig.update({
      where: { id: SINGLETON_ID },
      data: { killSwitch: engaged },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
