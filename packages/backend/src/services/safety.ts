import { prisma } from "../db/client.js";
import type { ActionType } from "@lgx/shared";
import type { getSafetyConfig } from "./safetyConfig.service.js";

type SafetyConfigRow = Awaited<ReturnType<typeof getSafetyConfig>>;

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday as start of week
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function countActionsSince(actionType: ActionType | string, since: Date): Promise<number> {
  return prisma.action.count({
    where: {
      actionType: actionType as never,
      status: "success",
      executedAt: { gte: since },
    },
  });
}

export function isWithinActiveHours(config: SafetyConfigRow): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour >= config.activeHoursStartHour && hour < config.activeHoursEndHour;
}
