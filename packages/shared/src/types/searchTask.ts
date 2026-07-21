import type { ActionStatus } from "./action.js";

export interface SearchTask {
  id: string;
  campaignId: string;
  keyword: string;
  location: string | null;
  status: ActionStatus;
  attempts: number;
  scheduledAt: string;
  executedAt: string | null;
  leadsFound: number | null;
  errorMessage: string | null;
}
