import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";

export const logsRouter: Router = Router();

// GET /api/logs?category=&page=&pageSize=
logsRouter.get("/", async (req, res, next) => {
  try {
    const { category, page = "1", pageSize = "50" } = req.query;
    const where: Record<string, unknown> = {};
    if (typeof category === "string") where.category = category;

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSizeNum = Math.min(200, Math.max(1, Number(pageSize) || 50));

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
      }),
      prisma.systemLog.count({ where }),
    ]);

    res.json({ logs, total });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  category: z.enum([
    "selector_failure",
    "rate_limit",
    "daily_limit",
    "duplicate_skip",
    "manual_rejection",
    "template_error",
  ]),
  message: z.string().min(1),
  leadId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  meta: z.record(z.unknown()).optional(),
});

// POST /api/logs — content scripts report selector failures directly (not just console.warn)
logsRouter.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const log = await prisma.systemLog.create({
      data: { ...body, meta: body.meta ? (body.meta as Prisma.InputJsonValue) : undefined },
    });
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
});
