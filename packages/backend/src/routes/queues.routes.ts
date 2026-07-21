import { Router } from "express";
import type { QueueStatusCountsDto, QueueSummaryDto } from "@lgx/shared";
import { QUEUE_BY_ACTION_TYPE } from "@lgx/shared";
import { prisma } from "../db/client.js";

export const queuesRouter: Router = Router();

function emptyCounts(): QueueStatusCountsDto {
  return {
    pending_approval: 0,
    queued: 0,
    in_progress: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    blocked: 0,
    dead_letter: 0,
  };
}

// GET /api/queues/summary — live counts per queue (Search/Engagement/Connection/Message) x status
queuesRouter.get("/summary", async (_req, res, next) => {
  try {
    const [actionGroups, searchGroups] = await Promise.all([
      prisma.action.groupBy({ by: ["actionType", "status"], _count: { _all: true } }),
      prisma.searchTask.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    const summary: QueueSummaryDto = {
      search: emptyCounts(),
      engagement: emptyCounts(),
      connection: emptyCounts(),
      message: emptyCounts(),
    };

    for (const group of searchGroups) {
      summary.search[group.status as keyof QueueStatusCountsDto] += group._count._all;
    }
    for (const group of actionGroups) {
      const category = QUEUE_BY_ACTION_TYPE[group.actionType];
      summary[category][group.status as keyof QueueStatusCountsDto] += group._count._all;
    }

    res.json(summary);
  } catch (err) {
    next(err);
  }
});
