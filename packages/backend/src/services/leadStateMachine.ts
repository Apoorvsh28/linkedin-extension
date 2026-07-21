import type { LeadCrmStatus } from "@lgx/shared";
import { prisma } from "../db/client.js";

export type LeadEvent =
  | "ENGAGEMENT_STARTED"
  | "CONNECT_PROPOSED"
  | "CONNECT_REJECTED"
  | "CONNECT_REQUEST_SENT"
  | "CONNECTION_ACCEPTED"
  | "WELCOME_PROPOSED"
  | "WELCOME_REJECTED"
  | "WELCOME_SENT"
  | "QUALIFY_PROPOSED"
  | "QUALIFY_REJECTED"
  | "QUALIFY_SENT"
  | "QUALIFIED"
  | "NEEDS_FOLLOWUP"
  | "CLOSE";

export const LEAD_EVENTS: LeadEvent[] = [
  "ENGAGEMENT_STARTED",
  "CONNECT_PROPOSED",
  "CONNECT_REJECTED",
  "CONNECT_REQUEST_SENT",
  "CONNECTION_ACCEPTED",
  "WELCOME_PROPOSED",
  "WELCOME_REJECTED",
  "WELCOME_SENT",
  "QUALIFY_PROPOSED",
  "QUALIFY_REJECTED",
  "QUALIFY_SENT",
  "QUALIFIED",
  "NEEDS_FOLLOWUP",
  "CLOSE",
];

const ALL_STATUSES: LeadCrmStatus[] = [
  "NEW",
  "ENGAGING",
  "CONNECT_APPROVAL",
  "CONNECT_PENDING",
  "WELCOME_PENDING",
  "CONNECTED",
  "QUALIFY_PENDING",
  "QUALIFIED",
  "MANUAL_FOLLOWUP",
  "CLOSED",
];
const NOT_CLOSED = ALL_STATUSES.filter((s) => s !== "CLOSED");

const TRANSITIONS: Record<LeadEvent, { from: LeadCrmStatus[]; to: LeadCrmStatus }> = {
  ENGAGEMENT_STARTED: { from: ["NEW"], to: "ENGAGING" },
  CONNECT_PROPOSED: { from: ["ENGAGING"], to: "CONNECT_APPROVAL" },
  CONNECT_REJECTED: { from: ["CONNECT_APPROVAL"], to: "ENGAGING" },
  CONNECT_REQUEST_SENT: { from: ["CONNECT_APPROVAL"], to: "CONNECT_PENDING" },
  CONNECTION_ACCEPTED: { from: ["CONNECT_PENDING"], to: "WELCOME_PENDING" },
  WELCOME_PROPOSED: { from: ["CONNECT_PENDING", "CONNECTED"], to: "WELCOME_PENDING" },
  WELCOME_REJECTED: { from: ["WELCOME_PENDING"], to: "CONNECTED" },
  WELCOME_SENT: { from: ["WELCOME_PENDING"], to: "CONNECTED" },
  QUALIFY_PROPOSED: { from: ["CONNECTED"], to: "QUALIFY_PENDING" },
  QUALIFY_REJECTED: { from: ["QUALIFY_PENDING"], to: "CONNECTED" },
  QUALIFY_SENT: { from: ["QUALIFY_PENDING"], to: "CONNECTED" },
  QUALIFIED: { from: ["CONNECTED"], to: "QUALIFIED" },
  NEEDS_FOLLOWUP: { from: NOT_CLOSED, to: "MANUAL_FOLLOWUP" },
  CLOSE: { from: NOT_CLOSED, to: "CLOSED" },
};

/** Pure transition lookup — returns null if the event isn't valid from the current status. */
export function nextLeadStatus(current: LeadCrmStatus, event: LeadEvent): LeadCrmStatus | null {
  const transition = TRANSITIONS[event];
  return transition.from.includes(current) ? transition.to : null;
}

/** Applies an event via Prisma. No-ops (returns the unchanged lead) on an invalid transition rather than throwing. */
export async function applyLeadEvent(leadId: string, event: LeadEvent) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;

  const next = nextLeadStatus(lead.status, event);
  if (!next) return lead;

  return prisma.lead.update({
    where: { id: leadId },
    data: { status: next, lastSyncedAt: new Date() },
  });
}
