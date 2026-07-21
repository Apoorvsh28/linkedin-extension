import type {
  Action,
  ActionListResponseDto,
  ApproveActionResponseDto,
  AnalyticsSummaryDto,
  BulkActionResultDto,
  Campaign,
  LeadDetailDto,
  LeadListResponseDto,
  Message,
  QueueSummaryDto,
  SafetyConfigRecordDto,
  SequenceStep,
  SystemLogListResponseDto,
} from "@lgx/shared";

const BASE_URL = "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${init?.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface CampaignInput {
  name: string;
  keywords: string[];
  locations: string[];
  persona?: string | null;
  status?: string;
  dailyConnectionLimit?: number;
  dailyMessageLimit?: number;
  dailySearchLimit?: number;
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
  engagementIntervalHours?: number;
  connectionNoteTemplate?: string | null;
  welcomeMessageTemplate?: string | null;
  qualificationQuestions?: string[];
  followUpTemplate?: string | null;
  industries?: string[];
  companySizeMin?: number | null;
  companySizeMax?: number | null;
  seniorities?: string[];
  currentCompanies?: string[];
  minActivityLevel?: string | null;
  sequenceSteps?: SequenceStep[] | null;
}

export const api = {
  listLeads: (params: Record<string, string> = {}) =>
    request<LeadListResponseDto>(`/leads?${new URLSearchParams(params)}`),

  getLead: (leadId: string) => request<LeadDetailDto>(`/leads/${leadId}`),

  patchLead: (
    leadId: string,
    body: {
      status?: string;
      campaignId?: string | null;
      notes?: string | null;
      meetingBooked?: boolean;
      dealStatus?: string;
      dealValue?: number | null;
      industry?: string | null;
      companySize?: number | null;
    },
  ) => request<LeadDetailDto>(`/leads/${leadId}`, { method: "PATCH", body: JSON.stringify(body) }),

  rescoreLead: (leadId: string) => request<LeadDetailDto>(`/leads/${leadId}/score`, { method: "POST" }),

  listMessages: (leadId: string) => request<Message[]>(`/leads/${leadId}/messages`),

  enqueueAction: (body: { leadId: string; actionType: string; details?: Record<string, unknown> }) =>
    request<Action>("/actions", { method: "POST", body: JSON.stringify(body) }),

  listActions: (params: Record<string, string> = {}) =>
    request<ActionListResponseDto>(`/actions?${new URLSearchParams(params)}`),

  listPendingApprovals: () => request<ApproveActionResponseDto[]>("/actions/pending-approval"),

  approveAction: (id: string) => request<Action>(`/actions/${id}/approve`, { method: "POST" }),

  rejectAction: (id: string, note?: string) =>
    request<Action>(`/actions/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) }),

  bulkApprove: (ids: string[]) =>
    request<BulkActionResultDto>("/actions/bulk-approve", { method: "POST", body: JSON.stringify({ ids }) }),

  bulkReject: (ids: string[]) =>
    request<BulkActionResultDto>("/actions/bulk-reject", { method: "POST", body: JSON.stringify({ ids }) }),

  requeueAction: (id: string) => request<Action>(`/actions/${id}/requeue`, { method: "POST" }),

  getSafetyConfig: () => request<SafetyConfigRecordDto>("/safety-config"),

  updateSafetyConfig: (body: Partial<SafetyConfigRecordDto>) =>
    request<SafetyConfigRecordDto>("/safety-config", { method: "PUT", body: JSON.stringify(body) }),

  setKillSwitch: (engaged: boolean) =>
    request<SafetyConfigRecordDto>("/safety-config/kill-switch", {
      method: "POST",
      body: JSON.stringify({ engaged }),
    }),

  listCampaigns: () => request<(Campaign & { _count: { leads: number } })[]>("/campaigns"),

  getCampaign: (id: string) => request<Campaign>(`/campaigns/${id}`),

  createCampaign: (body: CampaignInput) =>
    request<Campaign>("/campaigns", { method: "POST", body: JSON.stringify(body) }),

  updateCampaign: (id: string, body: Partial<CampaignInput>) =>
    request<Campaign>(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteCampaign: (id: string) => request(`/campaigns/${id}`, { method: "DELETE" }),

  generateSearchTasks: (id: string) =>
    request<{ created: number }>(`/campaigns/${id}/generate-search-tasks`, { method: "POST" }),

  pauseAllCampaigns: () =>
    request<{ pausedCampaigns: number; killSwitchEngaged: boolean }>("/campaigns/pause-all", { method: "POST" }),

  getAnalytics: (params: Record<string, string> = {}) =>
    request<AnalyticsSummaryDto>(`/analytics?${new URLSearchParams(params)}`),

  getQueueSummary: () => request<QueueSummaryDto>("/queues/summary"),

  listLogs: (params: Record<string, string> = {}) =>
    request<SystemLogListResponseDto>(`/logs?${new URLSearchParams(params)}`),
};
