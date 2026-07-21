import type { ActionReportDto, NextActionDto, SearchTaskReportDto } from "@lgx/shared";

export interface ExecuteActionMessage {
  type: "EXECUTE_ACTION";
  action: NextActionDto;
}

export interface ExecuteSearchMessage {
  type: "EXECUTE_SEARCH";
  taskId: string;
}

export interface TriggerTickMessage {
  type: "TRIGGER_TICK";
}

/**
 * Content scripts run inside https://www.linkedin.com — Chrome blocks a plain http://
 * fetch from a secure page as mixed content, regardless of host_permissions. So content
 * scripts never fetch the backend directly; they relay through the background service
 * worker (an extension-origin context, exempt from the page's mixed-content policy),
 * which holds the real api.ts client.
 */
export interface ApiCallMessage {
  type: "API_CALL";
  method: string;
  args: unknown[];
}

export interface ApiCallResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

export type RuntimeMessage = ExecuteActionMessage | ExecuteSearchMessage | TriggerTickMessage | ApiCallMessage;

export type ExecuteActionResult = ActionReportDto;
export type ExecuteSearchResult = SearchTaskReportDto;
