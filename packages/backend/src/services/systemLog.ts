import type { LogCategory } from "@lgx/shared";
import { prisma } from "../db/client.js";
import type { Prisma } from "@prisma/client";

export async function logSystemEvent(
  category: LogCategory,
  message: string,
  opts: { leadId?: string; campaignId?: string; meta?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await prisma.systemLog.create({
      data: {
        category,
        message,
        leadId: opts.leadId ?? null,
        campaignId: opts.campaignId ?? null,
        meta: (opts.meta as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (err) {
    console.error("[systemLog] failed to write log", err);
  }
}
