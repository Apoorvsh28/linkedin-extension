import type { ActionType, NextActionDto, NextSearchTaskDto } from "@lgx/shared";
import { api } from "../lib/api.js";
import { randomIntBetween, sleep } from "../lib/delay.js";
import {
  getLastInvitationCheckAt,
  getPacing,
  getSession,
  incrementDailyStat,
  setLastInvitationCheckAt,
  setPacing,
  setSession,
  setWorkerStatus,
} from "../lib/storage.js";
import type { ApiCallResponse, ExecuteActionResult, ExecuteSearchResult, RuntimeMessage } from "../lib/messages.js";

const TICK_ALARM = "lgx-tick";

const PROFILE_DISPATCHED_ACTIONS = new Set<ActionType>([
  "view_profile",
  "like_post",
  "comment_post",
  "connect_request",
  "send_message",
  "check_connection_status",
]);

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
  void tick();
});

chrome.runtime.onStartup.addListener(() => {
  void tick();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK_ALARM) void tick();
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "TRIGGER_TICK") {
    void tick().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "API_CALL") {
    void handleApiCallRelay(message.method, message.args).then(sendResponse);
    return true;
  }
  return false;
});

// Content scripts can't fetch http://localhost directly from an https://linkedin.com page
// (mixed content) — they relay through here instead, where the extension's own origin applies.
async function handleApiCallRelay(method: string, args: unknown[]): Promise<ApiCallResponse> {
  const fn = (api as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method];
  if (typeof fn !== "function") {
    return { ok: false, error: `Unknown API method: ${method}` };
  }
  try {
    const result = await fn(...args);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

let ticking = false;

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    await runTick();
  } catch (err) {
    console.error("[lgx background] tick failed", err);
    await setWorkerStatus("error", err instanceof Error ? err.message : String(err));
  } finally {
    ticking = false;
  }
}

async function runTick(): Promise<void> {
  const now = Date.now();
  const pacing = await getPacing();

  if (pacing.onBreakUntil && now < pacing.onBreakUntil) {
    await setWorkerStatus("on_break", `resuming ${new Date(pacing.onBreakUntil).toLocaleTimeString()}`);
    return;
  }

  const session = await getSession();
  if (session && now > session.endsAt) {
    await setSession(null);
    await setPacing({ ...pacing, onBreakUntil: null, actionsSinceBreak: 0 });
    await setWorkerStatus("session_ended", "session length reached, will start a fresh session on next tick");
    return;
  }

  const config = await api.getSafetyConfig();

  if (config.killSwitch) {
    await setWorkerStatus("kill_switch");
    return;
  }

  // Advances campaign engagement sequencing and raises approval requests server-side.
  // Cheap and DB-only — runs every tick regardless of active hours so approvals are
  // ready to review whenever the user opens the dashboard.
  await api.engineTick().catch((err) => console.error("[lgx background] engine tick failed", err));
  await maybeCheckInvitations(config);

  if (pacing.nextActionEarliestAt && now < pacing.nextActionEarliestAt) {
    await setWorkerStatus("waiting", `next check ${new Date(pacing.nextActionEarliestAt).toLocaleTimeString()}`);
    return;
  }

  if (!session) {
    const durationMin = randomIntBetween(config.sessionMaxDurationMinutesMin, config.sessionMaxDurationMinutesMax);
    await setSession({ startedAt: now, endsAt: now + durationMin * 60_000 });
  }

  const { action, reason: actionReason } = await api.nextAction();

  if (action) {
    await setWorkerStatus("executing", `${action.actionType} for ${action.linkedinProfileUrl}`);
    const result = await dispatchAction(action);
    await api.reportAction(action.actionId, result).catch((err) => console.error("[lgx background] failed to report action", err));
    if (result.status === "success") await incrementDailyStat(action.actionType);
    await advancePacing(config, pacing);
    return;
  }

  // Nothing to act on right now — fall back to the search queue before idling.
  const { task, reason: searchReason } = await api.nextSearchTask();

  if (task) {
    await setWorkerStatus("executing", `search: ${task.keyword}`);
    const result = await dispatchSearchTask(task);
    await api
      .reportSearchTask(task.taskId, result)
      .catch((err) => console.error("[lgx background] failed to report search task", err));
    if (result.status === "success") await incrementDailyStat("search_scrape");
    await advancePacing(config, pacing);
    return;
  }

  const reason = actionReason ?? searchReason ?? "no eligible action";
  const retrySeconds = reason === "outside_active_hours" ? 15 * 60 : 30;
  await setPacing({ ...pacing, nextActionEarliestAt: now + retrySeconds * 1000 });
  await setWorkerStatus("idle", reason);
}

async function maybeCheckInvitations(config: Awaited<ReturnType<typeof api.getSafetyConfig>>): Promise<void> {
  const now = Date.now();
  const lastCheck = await getLastInvitationCheckAt();
  const intervalMs = config.connectionCheckIntervalHours * 60 * 60 * 1000;
  if (now - lastCheck < intervalMs) return;

  await setLastInvitationCheckAt(now);
  try {
    await chrome.tabs.create({ url: "https://www.linkedin.com/mynetwork/invitation-manager/sent/", active: false });
  } catch (err) {
    console.error("[lgx background] failed to open invitation manager", err);
  }
}

async function advancePacing(
  config: Awaited<ReturnType<typeof api.getSafetyConfig>>,
  previous: Awaited<ReturnType<typeof getPacing>>,
): Promise<void> {
  const now = Date.now();
  const actionsSinceBreak = previous.actionsSinceBreak + 1;

  if (actionsSinceBreak >= previous.nextBreakThreshold) {
    const breakMinutes = randomIntBetween(config.breakDurationMinMinutes, config.breakDurationMaxMinutes);
    await setPacing({
      nextActionEarliestAt: now,
      actionsSinceBreak: 0,
      nextBreakThreshold: randomIntBetween(config.breakEveryActionsMin, config.breakEveryActionsMax),
      onBreakUntil: now + breakMinutes * 60_000,
    });
    await setWorkerStatus("on_break", `${breakMinutes}m break`);
    return;
  }

  const delaySeconds = randomIntBetween(config.minDelaySeconds, config.maxDelaySeconds);
  await setPacing({
    ...previous,
    actionsSinceBreak,
    nextActionEarliestAt: now + delaySeconds * 1000,
    onBreakUntil: null,
  });
  await setWorkerStatus("waiting", `next action in ~${delaySeconds}s`);
}

async function dispatchAction(action: NextActionDto): Promise<ExecuteActionResult> {
  if (!PROFILE_DISPATCHED_ACTIONS.has(action.actionType)) {
    return { status: "skipped", errorMessage: `no dispatcher registered for ${action.actionType}` };
  }

  try {
    const tabId = await openTabAndWaitForLoad(action.linkedinProfileUrl);
    await sleep(750); // let the content script's message listener register after navigation
    const response = await sendTabMessage<ExecuteActionResult>(
      tabId,
      { type: "EXECUTE_ACTION", action },
      45_000,
    );
    return response ?? { status: "failed", errorMessage: "content script did not respond in time" };
  } catch (err) {
    return { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) };
  }
}

async function dispatchSearchTask(task: NextSearchTaskDto): Promise<ExecuteSearchResult> {
  try {
    const url = new URL(task.searchUrl);
    url.searchParams.set("lgxCampaignId", task.campaignId);
    const tabId = await openTabAndWaitForLoad(url.toString());
    await sleep(750);
    const response = await sendTabMessage<ExecuteSearchResult>(
      tabId,
      { type: "EXECUTE_SEARCH", taskId: task.taskId },
      60_000, // scrolling through search results takes longer than a single profile action
    );
    return response ?? { status: "failed", errorMessage: "content script did not respond in time" };
  } catch (err) {
    return { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) };
  }
}

async function openTabAndWaitForLoad(url: string): Promise<number> {
  const tab = await chrome.tabs.create({ url, active: true });
  if (tab.id === undefined) throw new Error("failed to open tab");
  const tabId = tab.id;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("timed out waiting for page load"));
    }, 30_000);

    function listener(updatedTabId: number, info: chrome.tabs.TabChangeInfo): void {
      if (updatedTabId === tabId && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });

  return tabId;
}

function sendTabMessage<T>(tabId: number, message: RuntimeMessage, timeoutMs: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), timeoutMs);
    chrome.tabs.sendMessage(tabId, message, (response: T | undefined) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        resolve({ status: "failed", errorMessage: chrome.runtime.lastError.message } as T);
        return;
      }
      resolve(response);
    });
  });
}
