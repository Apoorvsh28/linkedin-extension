import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { HttpError } from "../middleware/errorHandler.js";
import { generateNextComment, generateNextMessage } from "../services/claude.service.js";

export const messagesRouter: Router = Router({ mergeParams: true });

const messageTypeEnum = z.enum([
  "connection_note",
  "welcome_message",
  "qualification_question",
  "follow_up",
  "ai_reply",
  "manual",
]);

const logMessageSchema = z.object({
  direction: z.enum(["outbound", "inbound"]),
  messageType: messageTypeEnum,
  content: z.string().min(1),
  sentAt: z.string().datetime().optional(),
  linkedinMessageId: z.string().optional(),
});

// POST /api/leads/:leadId/messages — log a sent/received message
messagesRouter.post("/", async (req, res, next) => {
  try {
    const { leadId } = req.params as { leadId: string };
    const body = logMessageSchema.parse(req.body);

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new HttpError(404, "Lead not found");

    const message = await prisma.message.create({
      data: {
        leadId,
        direction: body.direction,
        messageType: body.messageType,
        content: body.content,
        sentAt: body.sentAt ? new Date(body.sentAt) : new Date(),
        linkedinMessageId: body.linkedinMessageId ?? null,
      },
    });

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/:leadId/messages — conversation history
messagesRouter.get("/", async (req, res, next) => {
  try {
    const { leadId } = req.params as { leadId: string };
    const messages = await prisma.message.findMany({
      where: { leadId },
      orderBy: { sentAt: "asc" },
    });
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

const nextMessageSchema = z.object({
  messageType: messageTypeEnum,
});

// POST /api/leads/:leadId/next-message — Claude-generated reply + qualification
messagesRouter.post("/next", async (req, res, next) => {
  try {
    const { leadId } = req.params as { leadId: string };
    const body = nextMessageSchema.parse(req.body);

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new HttpError(404, "Lead not found");

    const history = await prisma.message.findMany({
      where: { leadId },
      orderBy: { sentAt: "asc" },
    });

    const result = await generateNextMessage({
      persona: lead.persona,
      fullName: lead.fullName,
      headline: lead.headline,
      messageType: body.messageType,
      conversationHistory: history as never,
    });

    if (result.qualification.keyAnswers.length > 0) {
      await prisma.qualificationAnswer.createMany({
        data: result.qualification.keyAnswers.map((a) => ({
          leadId,
          questionKey: a.questionKey,
          questionText: a.questionKey,
          answerText: a.answer,
          confidence: result.qualification.personaMatchConfidence,
        })),
      });
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: result.qualification.nextStatusRecommendation },
    });

    res.json({
      content: result.replyMessage,
      messageType: body.messageType,
    });
  } catch (err) {
    next(err);
  }
});

const nextCommentSchema = z.object({
  postSummary: z.string().min(1),
});

// POST /api/leads/:leadId/next-comment — Claude-generated post comment
messagesRouter.post("/next-comment", async (req, res, next) => {
  try {
    const { leadId } = req.params as { leadId: string };
    const body = nextCommentSchema.parse(req.body);

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new HttpError(404, "Lead not found");

    const content = await generateNextComment({
      persona: lead.persona,
      fullName: lead.fullName,
      postSummary: body.postSummary,
    });

    res.json({ content });
  } catch (err) {
    next(err);
  }
});
