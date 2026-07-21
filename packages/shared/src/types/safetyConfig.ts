export interface SafetyCaps {
  connectionRequestsPerDay: number;
  connectionRequestsPerWeek: number;
  likesPerDay: number;
  commentsPerDay: number;
  messagesPerDay: number;
  profileVisitsPerDay: number;
  searchPagesPerDay: number;
}

export const DEFAULT_SAFETY_CAPS: SafetyCaps = {
  connectionRequestsPerDay: 15,
  connectionRequestsPerWeek: 80,
  likesPerDay: 25,
  commentsPerDay: 8,
  messagesPerDay: 25,
  profileVisitsPerDay: 60,
  searchPagesPerDay: 15,
};

export interface ActiveHoursWindow {
  startHour: number;
  endHour: number;
  jitterMinutes: number;
}

export interface SafetyConfig {
  caps: SafetyCaps;
  killSwitch: boolean;
  activeHours: ActiveHoursWindow;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  breakEveryActionsMin: number;
  breakEveryActionsMax: number;
  breakDurationMinMinutes: number;
  breakDurationMaxMinutes: number;
  sessionMaxDurationMinutesMin: number;
  sessionMaxDurationMinutesMax: number;
  connectionCheckIntervalHours: number;
  maxActionAttempts: number;
}

export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  caps: DEFAULT_SAFETY_CAPS,
  killSwitch: false,
  activeHours: { startHour: 9, endHour: 19, jitterMinutes: 30 },
  minDelaySeconds: 20,
  maxDelaySeconds: 90,
  breakEveryActionsMin: 8,
  breakEveryActionsMax: 12,
  breakDurationMinMinutes: 3,
  breakDurationMaxMinutes: 10,
  sessionMaxDurationMinutesMin: 60,
  sessionMaxDurationMinutesMax: 180,
  connectionCheckIntervalHours: 4,
  maxActionAttempts: 3,
};
