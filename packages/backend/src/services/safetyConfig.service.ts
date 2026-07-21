import { prisma } from "../db/client.js";
import { DEFAULT_SAFETY_CONFIG } from "@lgx/shared";

const SINGLETON_ID = "singleton";

export async function getSafetyConfig() {
  const existing = await prisma.safetyConfig.findUnique({ where: { id: SINGLETON_ID } });
  if (existing) return existing;

  const d = DEFAULT_SAFETY_CONFIG;
  return prisma.safetyConfig.create({
    data: {
      id: SINGLETON_ID,
      killSwitch: d.killSwitch,
      connectionRequestsPerDay: d.caps.connectionRequestsPerDay,
      connectionRequestsPerWeek: d.caps.connectionRequestsPerWeek,
      likesPerDay: d.caps.likesPerDay,
      commentsPerDay: d.caps.commentsPerDay,
      messagesPerDay: d.caps.messagesPerDay,
      profileVisitsPerDay: d.caps.profileVisitsPerDay,
      searchPagesPerDay: d.caps.searchPagesPerDay,
      activeHoursStartHour: d.activeHours.startHour,
      activeHoursEndHour: d.activeHours.endHour,
      activeHoursJitterMinutes: d.activeHours.jitterMinutes,
      minDelaySeconds: d.minDelaySeconds,
      maxDelaySeconds: d.maxDelaySeconds,
      breakEveryActionsMin: d.breakEveryActionsMin,
      breakEveryActionsMax: d.breakEveryActionsMax,
      breakDurationMinMinutes: d.breakDurationMinMinutes,
      breakDurationMaxMinutes: d.breakDurationMaxMinutes,
      sessionMaxDurationMinutesMin: d.sessionMaxDurationMinutesMin,
      sessionMaxDurationMinutesMax: d.sessionMaxDurationMinutesMax,
      connectionCheckIntervalHours: d.connectionCheckIntervalHours,
      maxActionAttempts: d.maxActionAttempts,
    },
  });
}

export { SINGLETON_ID };
