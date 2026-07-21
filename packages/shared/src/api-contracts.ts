import type { Lead, Persona } from "./types/lead.js";
import type { Action, ActionType } from "./types/action.js";
import type { MessageType } from "./types/message.js";
import type { Reminder } from "./types/reminder.js";
import type { SystemLog } from "./types/systemLog.js";

export interface ScrapedLeadCardDto {
  linkedinProfileUrl: string;
  fullName: string;
  headline: string | null;
  location: string | null;
  persona: Persona;
  campaignId?: string;
}

export interface ProfileSnapshotDto {
  headline: string | null;
  aboutText: string | null;
  currentPosition: string | null;
  company: string | null;
  activitySignals: {
    recentPostTimestamps: string[];
    postCountLast30Days: number;
  };
  rawExtract: Record<string, unknown>;
}

export interface NextActionDto {
  actionId: string;
  leadId: string;
  actionType: ActionType;
  linkedinProfileUrl: string;
  details: Record<string, unknown> | null;
}

export interface ActionReportDto {
  status: "success" | "failed" | "skipped";
  details?: Record<string, unknown>;
  errorMessage?: string;
}

export interface ConnectionStatusReportDto {
  connectionStatus: "accepted" | "withdrawn";
  observedAt: string;
}

export interface MessageReportDto {
  direction: "outbound" | "inbound";
  messageType: MessageType;
  content: string;
  sentAt: string;
  linkedinMessageId?: string;
}

export interface NextMessageResponseDto {
  content: string;
  messageType: MessageType;
}

export interface NextCommentResponseDto {
  content: string;
}

export interface ActivityClassificationInput {
  recentPostTimestamps: string[];
}

export interface SafetyConfigRecordDto {
  id: string;
  killSwitch: boolean;
  connectionRequestsPerDay: number;
  connectionRequestsPerWeek: number;
  likesPerDay: number;
  commentsPerDay: number;
  messagesPerDay: number;
  profileVisitsPerDay: number;
  searchPagesPerDay: number;
  activeHoursStartHour: number;
  activeHoursEndHour: number;
  activeHoursJitterMinutes: number;
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
  updatedAt: string;
}

export interface LeadListResponseDto {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProfileSnapshotRecordDto extends ProfileSnapshotDto {
  id: string;
  leadId: string;
  scrapedAt: string;
}

export interface LeadDetailDto extends Lead {
  profileSnapshots: ProfileSnapshotRecordDto[];
  actions: Action[];
}

export interface ReminderWithLeadDto extends Reminder {
  lead: Lead;
}

/** Minimal lead context embedded alongside an Action for list/queue views. */
export interface LeadSummaryDto {
  id: string;
  fullName: string;
  headline: string | null;
  company: string | null;
  location: string | null;
  linkedinProfileUrl: string;
  campaignId: string | null;
}

export interface ActionListItemDto extends Action {
  lead: LeadSummaryDto;
}

export interface ActionListResponseDto {
  actions: ActionListItemDto[];
  total: number;
}

export interface ApproveActionResponseDto extends Action {
  lead: LeadSummaryDto;
}

export interface NextSearchTaskDto {
  taskId: string;
  campaignId: string;
  keyword: string;
  location: string | null;
  searchUrl: string;
}

export interface SearchTaskReportDto {
  status: "success" | "failed" | "skipped";
  leadsFound?: number;
  errorMessage?: string;
}

export interface EngineTickResultDto {
  leadsAdvanced: number;
  actionsCreated: number;
  pendingApprovalsCreated: number;
}

export interface QueueStatusCountsDto {
  pending_approval: number;
  queued: number;
  in_progress: number;
  success: number;
  failed: number;
  skipped: number;
  blocked: number;
  dead_letter: number;
}

export interface QueueSummaryDto {
  search: QueueStatusCountsDto;
  engagement: QueueStatusCountsDto;
  connection: QueueStatusCountsDto;
  message: QueueStatusCountsDto;
}

export interface BulkActionRequestDto {
  ids: string[];
}

export interface BulkActionResultDto {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
}

export interface SystemLogListResponseDto {
  logs: SystemLog[];
  total: number;
}
