export type ActionType =
  | "view_profile"
  | "like_post"
  | "comment_post"
  | "connect_request"
  | "send_message"
  | "check_connection_status"
  | "check_reply";

/**
 * pending_approval: awaiting a human decision in the Messages tab (connect_request/send_message only).
 * blocked: a human rejected it in the approval queue.
 * dead_letter: exhausted all retry attempts (exponential backoff) — needs manual requeue.
 * queued -> in_progress -> success | failed (retried as queued with backoff, up to SafetyConfig.maxActionAttempts,
 * then dead_letter) | skipped.
 */
export type ActionStatus =
  | "pending_approval"
  | "queued"
  | "in_progress"
  | "success"
  | "failed"
  | "skipped"
  | "blocked"
  | "dead_letter";

export type QueueCategory = "search" | "engagement" | "connection" | "message";

export const QUEUE_BY_ACTION_TYPE: Record<ActionType, QueueCategory> = {
  view_profile: "engagement",
  like_post: "engagement",
  comment_post: "engagement",
  connect_request: "connection",
  send_message: "message",
  check_connection_status: "connection",
  check_reply: "message",
};

/** Action types that require human approval before they become dispatchable ("queued"). */
export const APPROVAL_REQUIRED_ACTION_TYPES: ActionType[] = ["connect_request", "send_message"];

export interface Action {
  id: string;
  leadId: string;
  actionType: ActionType;
  status: ActionStatus;
  attempts: number;
  lastAttemptAt: string | null;
  scheduledAt: string | null;
  executedAt: string | null;
  details: Record<string, unknown> | null;
  errorMessage: string | null;
}
