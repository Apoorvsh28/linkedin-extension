export interface PacingState {
  nextActionEarliestAt: number;
  actionsSinceBreak: number;
  nextBreakThreshold: number;
  onBreakUntil: number | null;
}

const DEFAULT_PACING: PacingState = {
  nextActionEarliestAt: 0,
  actionsSinceBreak: 0,
  nextBreakThreshold: 10,
  onBreakUntil: null,
};

export interface SessionState {
  startedAt: number;
  endsAt: number;
}

export type WorkerState =
  | "idle"
  | "waiting"
  | "executing"
  | "on_break"
  | "session_ended"
  | "kill_switch"
  | "outside_active_hours"
  | "error";

export interface WorkerStatus {
  state: WorkerState;
  detail?: string;
  updatedAt: number;
}

export interface DailyStats {
  date: string;
  counts: Record<string, number>;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getPacing(): Promise<PacingState> {
  const { pacing } = await chrome.storage.local.get("pacing");
  return { ...DEFAULT_PACING, ...(pacing as Partial<PacingState> | undefined) };
}

export async function setPacing(pacing: PacingState): Promise<void> {
  await chrome.storage.local.set({ pacing });
}

export async function getSession(): Promise<SessionState | null> {
  const { session } = await chrome.storage.local.get("session");
  return (session as SessionState | undefined) ?? null;
}

export async function setSession(session: SessionState | null): Promise<void> {
  await chrome.storage.local.set({ session });
}

export async function getWorkerStatus(): Promise<WorkerStatus> {
  const { workerStatus } = await chrome.storage.local.get("workerStatus");
  return (workerStatus as WorkerStatus | undefined) ?? { state: "idle", updatedAt: Date.now() };
}

export async function setWorkerStatus(state: WorkerState, detail?: string): Promise<void> {
  const workerStatus: WorkerStatus = { state, detail, updatedAt: Date.now() };
  await chrome.storage.local.set({ workerStatus });
}

export async function getDailyStats(): Promise<DailyStats> {
  const { dailyStats } = await chrome.storage.local.get("dailyStats");
  const today = todayKey();
  const stats = dailyStats as DailyStats | undefined;
  if (!stats || stats.date !== today) {
    return { date: today, counts: {} };
  }
  return stats;
}

export async function incrementDailyStat(actionType: string): Promise<DailyStats> {
  const stats = await getDailyStats();
  stats.counts[actionType] = (stats.counts[actionType] ?? 0) + 1;
  await chrome.storage.local.set({ dailyStats: stats });
  return stats;
}

export async function getLastInvitationCheckAt(): Promise<number> {
  const { lastInvitationCheckAt } = await chrome.storage.local.get("lastInvitationCheckAt");
  return typeof lastInvitationCheckAt === "number" ? lastInvitationCheckAt : 0;
}

export async function setLastInvitationCheckAt(timestamp: number): Promise<void> {
  await chrome.storage.local.set({ lastInvitationCheckAt: timestamp });
}

const MAX_LOGGED_MESSAGE_KEYS = 500;

export async function hasLoggedMessage(key: string): Promise<boolean> {
  const { loggedMessageKeys } = await chrome.storage.local.get("loggedMessageKeys");
  return Array.isArray(loggedMessageKeys) && (loggedMessageKeys as string[]).includes(key);
}

export async function markMessageLogged(key: string): Promise<void> {
  const { loggedMessageKeys } = await chrome.storage.local.get("loggedMessageKeys");
  const keys = Array.isArray(loggedMessageKeys) ? (loggedMessageKeys as string[]) : [];
  keys.push(key);
  await chrome.storage.local.set({ loggedMessageKeys: keys.slice(-MAX_LOGGED_MESSAGE_KEYS) });
}
