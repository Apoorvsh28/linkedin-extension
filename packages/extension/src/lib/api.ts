import type {
  ScrapedLeadCardDto,
  ProfileSnapshotDto,
  NextActionDto,
  ActionReportDto,
  MessageReportDto,
  NextMessageResponseDto,
  NextCommentResponseDto,
  SafetyConfigRecordDto,
  LeadListResponseDto,
  LeadDetailDto,
  ReminderWithLeadDto,
  Campaign,
  NextSearchTaskDto,
  SearchTaskReportDto,
  EngineTickResultDto,
  ApproveActionResponseDto,
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

export const api = {
  upsertLeads: (cards: ScrapedLeadCardDto[]) =>
    request<{ upserted: number; leads: unknown[] }>("/leads", {
      method: "POST",
      body: JSON.stringify(cards),
    }),

  postSnapshot: (leadId: string, snapshot: ProfileSnapshotDto) =>
    request(`/leads/${leadId}/snapshot`, {
      method: "POST",
      body: JSON.stringify(snapshot),
    }),

  listLeads: (params: Record<string, string> = {}) =>
    request<LeadListResponseDto>(`/leads?${new URLSearchParams(params)}`),

  getLead: (leadId: string) => request<LeadDetailDto>(`/leads/${leadId}`),

  patchLead: (leadId: string, body: { status?: string; notes?: string | null }) =>
    request(`/leads/${leadId}`, { method: "PATCH", body: JSON.stringify(body) }),

  sendLeadEvent: (leadId: string, event: string) =>
    request(`/leads/${leadId}/events`, { method: "POST", body: JSON.stringify({ event }) }),

  nextAction: () => request<{ action: NextActionDto | null; reason?: string }>("/actions/next"),

  reportAction: (actionId: string, report: ActionReportDto) =>
    request(`/actions/${actionId}/report`, { method: "POST", body: JSON.stringify(report) }),

  enqueueAction: (body: {
    leadId: string;
    actionType: string;
    scheduledAt?: string;
    details?: Record<string, unknown>;
  }) => request("/actions", { method: "POST", body: JSON.stringify(body) }),

  logMessage: (leadId: string, report: MessageReportDto) =>
    request(`/leads/${leadId}/messages`, { method: "POST", body: JSON.stringify(report) }),

  listMessages: (leadId: string) => request(`/leads/${leadId}/messages`),

  nextMessage: (leadId: string, messageType: string) =>
    request<NextMessageResponseDto>(`/leads/${leadId}/messages/next`, {
      method: "POST",
      body: JSON.stringify({ messageType }),
    }),

  nextComment: (leadId: string, postSummary: string) =>
    request<NextCommentResponseDto>(`/leads/${leadId}/messages/next-comment`, {
      method: "POST",
      body: JSON.stringify({ postSummary }),
    }),

  getSafetyConfig: () => request<SafetyConfigRecordDto>("/safety-config"),

  updateSafetyConfig: (body: Partial<SafetyConfigRecordDto>) =>
    request<SafetyConfigRecordDto>("/safety-config", { method: "PUT", body: JSON.stringify(body) }),

  setKillSwitch: (engaged: boolean) =>
    request<SafetyConfigRecordDto>("/safety-config/kill-switch", {
      method: "POST",
      body: JSON.stringify({ engaged }),
    }),

  listReminders: (params: Record<string, string> = {}) =>
    request<ReminderWithLeadDto[]>(`/reminders?${new URLSearchParams(params)}`),

  createReminder: (body: { leadId: string; reminderType: string; dueAt: string; note?: string | null }) =>
    request("/reminders", { method: "POST", body: JSON.stringify(body) }),

  updateReminder: (id: string, status: "pending" | "done" | "dismissed") =>
    request(`/reminders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  listCampaigns: () => request<Campaign[]>("/campaigns"),

  listPendingApprovals: () => request<ApproveActionResponseDto[]>("/actions/pending-approval"),

  nextSearchTask: () => request<{ task: NextSearchTaskDto | null; reason?: string }>("/search-tasks/next"),

  reportSearchTask: (taskId: string, report: SearchTaskReportDto) =>
    request(`/search-tasks/${taskId}/report`, { method: "POST", body: JSON.stringify(report) }),

  engineTick: () => request<EngineTickResultDto>("/engine/tick", { method: "POST" }),
};
