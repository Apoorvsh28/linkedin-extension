export type LogCategory =
  | "selector_failure"
  | "rate_limit"
  | "daily_limit"
  | "duplicate_skip"
  | "manual_rejection"
  | "template_error";

export const LOG_CATEGORIES: LogCategory[] = [
  "selector_failure",
  "rate_limit",
  "daily_limit",
  "duplicate_skip",
  "manual_rejection",
  "template_error",
];

export interface SystemLog {
  id: string;
  category: LogCategory;
  message: string;
  leadId: string | null;
  campaignId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}
