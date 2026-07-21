export type Persona =
  | "radiologist"
  | "diagnostic_centre_owner"
  | "teleradiology_founder";

export type LeadCrmStatus =
  | "NEW"
  | "ENGAGING"
  | "CONNECT_APPROVAL"
  | "CONNECT_PENDING"
  | "WELCOME_PENDING"
  | "CONNECTED"
  | "QUALIFY_PENDING"
  | "QUALIFIED"
  | "MANUAL_FOLLOWUP"
  | "CLOSED";

export const LEAD_CRM_STATUSES: LeadCrmStatus[] = [
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

export type ActivityLevel = "active" | "inactive" | "unknown";

export const ACTIVITY_LEVELS: ActivityLevel[] = ["active", "inactive", "unknown"];

export type ConnectionStatus = "none" | "pending" | "accepted" | "withdrawn";

export type DealStatus = "open" | "won" | "lost";

export interface Lead {
  id: string;
  linkedinProfileUrl: string;
  fullName: string;
  headline: string | null;
  location: string | null;
  company: string | null;
  persona: Persona;
  status: LeadCrmStatus;
  activityLevel: ActivityLevel;
  connectionStatus: ConnectionStatus;
  campaignId: string | null;
  engagementDay: number;
  nextEngagementAt: string | null;
  engagedPostUrls: string[];
  meetingBookedAt: string | null;
  industry: string | null;
  seniority: string | null;
  companySize: number | null;
  score: number | null;
  scoreReason: string | null;
  dealStatus: DealStatus;
  dealValue: number | null;
  firstFoundAt: string;
  lastSyncedAt: string;
  notes: string | null;
}
