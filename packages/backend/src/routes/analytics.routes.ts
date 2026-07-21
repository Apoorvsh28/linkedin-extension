import { Router } from "express";
import type { LeadCrmStatus } from "@prisma/client";
import type { AnalyticsSummaryDto } from "@lgx/shared";
import { prisma } from "../db/client.js";

export const analyticsRouter: Router = Router();

const ACCEPTED_STATUSES: LeadCrmStatus[] = ["WELCOME_PENDING", "CONNECTED", "QUALIFY_PENDING", "QUALIFIED"];

// GET /api/analytics?campaignId=&since=ISO_DATE
analyticsRouter.get("/", async (req, res, next) => {
  try {
    const { campaignId, since } = req.query;
    const campaignFilter = typeof campaignId === "string" ? { campaignId } : {};
    const sinceDate = typeof since === "string" ? new Date(since) : undefined;

    const [searches, leadsFound, connectionsSent, connectionsAccepted, replies, meetingsBooked, dealsWon] =
      await Promise.all([
        prisma.searchTask.count({
          where: {
            status: "success",
            ...(sinceDate ? { executedAt: { gte: sinceDate } } : {}),
            ...campaignFilter,
          },
        }),
        prisma.lead.count({
          where: { ...campaignFilter, ...(sinceDate ? { firstFoundAt: { gte: sinceDate } } : {}) },
        }),
        prisma.action.count({
          where: {
            actionType: "connect_request",
            status: "success",
            ...(sinceDate ? { executedAt: { gte: sinceDate } } : {}),
            lead: campaignFilter,
          },
        }),
        prisma.lead.count({
          where: { ...campaignFilter, status: { in: ACCEPTED_STATUSES } },
        }),
        prisma.message.count({
          where: {
            direction: "inbound",
            ...(sinceDate ? { sentAt: { gte: sinceDate } } : {}),
            lead: campaignFilter,
          },
        }),
        prisma.lead.count({
          where: { ...campaignFilter, meetingBookedAt: sinceDate ? { gte: sinceDate } : { not: null } },
        }),
        prisma.lead.count({
          where: { ...campaignFilter, dealStatus: "won" },
        }),
      ]);

    const summary: AnalyticsSummaryDto = {
      searches,
      leadsFound,
      connectionsSent,
      connectionsAccepted,
      acceptanceRate: connectionsSent > 0 ? connectionsAccepted / connectionsSent : null,
      replies,
      meetingsBooked,
      dealsWon,
    };

    res.json(summary);
  } catch (err) {
    next(err);
  }
});
