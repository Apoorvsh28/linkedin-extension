import type { ActivityLevel, Persona } from "./lead.js";
import type { ActionType } from "./action.js";

export type CampaignStatus = "active" | "paused" | "completed";

/** One day of the engagement sequence. connect_request always requires human approval regardless of position. */
export interface SequenceStep {
  day: number;
  actions: ActionType[];
}

export const DEFAULT_SEQUENCE_STEPS: SequenceStep[] = [
  { day: 1, actions: ["view_profile", "like_post"] },
  { day: 2, actions: ["like_post", "comment_post"] },
  { day: 3, actions: ["like_post"] },
  { day: 4, actions: ["connect_request"] },
];

export interface Campaign {
  id: string;
  name: string;
  keywords: string[];
  locations: string[];
  persona: Persona | null;
  status: CampaignStatus;
  dailyConnectionLimit: number;
  dailyMessageLimit: number;
  dailySearchLimit: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  engagementIntervalHours: number;
  connectionNoteTemplate: string | null;
  welcomeMessageTemplate: string | null;
  qualificationQuestions: string[];
  followUpTemplate: string | null;
  industries: string[];
  companySizeMin: number | null;
  companySizeMax: number | null;
  seniorities: string[];
  currentCompanies: string[];
  minActivityLevel: ActivityLevel | null;
  sequenceSteps: SequenceStep[] | null;
  createdAt: string;
  updatedAt: string;
}
