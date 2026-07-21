import { Router } from "express";
import { z } from "zod";
import type { NextSearchTaskDto } from "@lgx/shared";
import { buildPeopleSearchUrl } from "@lgx/shared";
import { prisma } from "../db/client.js";
import { HttpError } from "../middleware/errorHandler.js";
import { getSafetyConfig } from "../services/safetyConfig.service.js";
import { isWithinActiveHours, startOfToday } from "../services/safety.js";
import { decideRetry } from "../services/retry.js";
import { logSystemEvent } from "../services/systemLog.js";

export const searchTasksRouter: Router = Router();

// GET /api/search-tasks/next — next queued search task allowed under campaign search cap + active hours
searchTasksRouter.get("/next", async (_req, res, next) => {
  try {
    const config = await getSafetyConfig();

    if (config.killSwitch) {
      res.json({ task: null, reason: "kill_switch_engaged" });
      return;
    }
    if (!isWithinActiveHours(config)) {
      res.json({ task: null, reason: "outside_active_hours" });
      return;
    }

    const candidates = await prisma.searchTask.findMany({
      where: { status: "queued", scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 25,
      include: { campaign: true },
    });

    for (const candidate of candidates) {
      if (candidate.campaign.status !== "active") continue;

      const todayCount = await prisma.searchTask.count({
        where: { campaignId: candidate.campaignId, status: "success", executedAt: { gte: startOfToday() } },
      });
      if (todayCount >= candidate.campaign.dailySearchLimit) {
        await logSystemEvent("daily_limit", `Campaign daily search limit reached (${candidate.campaign.name})`, {
          campaignId: candidate.campaignId,
        });
        continue;
      }

      const task: NextSearchTaskDto = {
        taskId: candidate.id,
        campaignId: candidate.campaignId,
        keyword: candidate.keyword,
        location: candidate.location,
        searchUrl: buildPeopleSearchUrl(candidate.keyword, candidate.location),
      };
      res.json({ task });
      return;
    }

    res.json({ task: null, reason: "no_eligible_task" });
  } catch (err) {
    next(err);
  }
});

const reportSchema = z.object({
  status: z.enum(["success", "failed", "skipped"]),
  leadsFound: z.number().int().optional(),
  errorMessage: z.string().optional(),
});

// POST /api/search-tasks/:id/report
searchTasksRouter.post("/:id/report", async (req, res, next) => {
  try {
    const body = reportSchema.parse(req.body);
    const task = await prisma.searchTask.findUnique({ where: { id: req.params.id } });
    if (!task) throw new HttpError(404, "Search task not found");

    const config = await getSafetyConfig();
    let status: "success" | "skipped" | "queued" | "dead_letter" = body.status === "failed" ? "queued" : body.status;
    let attempts = task.attempts;
    let scheduledAt = task.scheduledAt;

    if (body.status === "failed") {
      attempts += 1;
      const decision = decideRetry(attempts, config.maxActionAttempts);
      status = decision.status;
      scheduledAt = decision.nextScheduledAt ?? task.scheduledAt;
    }

    const updated = await prisma.searchTask.update({
      where: { id: task.id },
      data: {
        status,
        attempts,
        scheduledAt,
        executedAt: new Date(),
        leadsFound: body.leadsFound ?? task.leadsFound,
        errorMessage: body.errorMessage ?? null,
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
