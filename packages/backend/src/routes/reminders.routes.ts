import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { HttpError } from "../middleware/errorHandler.js";

export const remindersRouter: Router = Router();

const createSchema = z.object({
  leadId: z.string().uuid(),
  reminderType: z.string().min(1),
  dueAt: z.string().datetime(),
  note: z.string().nullable().optional(),
});

// POST /api/reminders
remindersRouter.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const reminder = await prisma.reminder.create({
      data: {
        leadId: body.leadId,
        reminderType: body.reminderType,
        dueAt: new Date(body.dueAt),
        note: body.note ?? null,
      },
    });
    res.status(201).json(reminder);
  } catch (err) {
    next(err);
  }
});

// GET /api/reminders?status=pending&dueBefore=...
remindersRouter.get("/", async (req, res, next) => {
  try {
    const { status, dueBefore } = req.query;
    const where: Record<string, unknown> = {};
    if (typeof status === "string") where.status = status;
    if (typeof dueBefore === "string") where.dueAt = { lte: new Date(dueBefore) };

    const reminders = await prisma.reminder.findMany({
      where,
      orderBy: { dueAt: "asc" },
      include: { lead: true },
    });
    res.json(reminders);
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  status: z.enum(["pending", "done", "dismissed"]),
});

// PATCH /api/reminders/:id
remindersRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const reminder = await prisma.reminder.findUnique({ where: { id: req.params.id } });
    if (!reminder) throw new HttpError(404, "Reminder not found");

    const updated = await prisma.reminder.update({
      where: { id: req.params.id },
      data: { status: body.status },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
