import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ExternalLink, RefreshCw, ScanEye, Zap } from "lucide-react";
import type { Campaign, SafetyConfigRecordDto } from "@lgx/shared";
import { api } from "../lib/api.js";
import { getDailyStats, getWorkerStatus, type DailyStats, type WorkerStatus } from "../lib/storage.js";

const STAT_ROWS: Array<{ actionType: string; label: string; capField: keyof SafetyConfigRecordDto }> = [
  { actionType: "connect_request", label: "Connection requests", capField: "connectionRequestsPerDay" },
  { actionType: "like_post", label: "Likes", capField: "likesPerDay" },
  { actionType: "comment_post", label: "Comments", capField: "commentsPerDay" },
  { actionType: "send_message", label: "Messages", capField: "messagesPerDay" },
  { actionType: "view_profile", label: "Profile views", capField: "profileVisitsPerDay" },
];

const STATUS_LABEL: Record<string, string> = {
  idle: "Idle",
  waiting: "Waiting",
  executing: "Running an action",
  on_break: "On break",
  session_ended: "Session ended",
  kill_switch: "Kill switch engaged",
  outside_active_hours: "Outside active hours",
  error: "Error",
};

const DASHBOARD_URL = "https://dashboard.leadgen.xcentic.com";

export function App() {
  const [config, setConfig] = useState<SafetyConfigRecordDto | null>(null);
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectorTestMode, setSelectorTestModeState] = useState(false);

  useEffect(() => {
    chrome.storage.local
      .get("selectorTestMode")
      .then((r) => setSelectorTestModeState(r.selectorTestMode === true));
  }, []);

  async function toggleSelectorTestMode() {
    const next = !selectorTestMode;
    await chrome.storage.local.set({ selectorTestMode: next });
    setSelectorTestModeState(next);
  }

  const refresh = useCallback(async () => {
    try {
      const [configResult, statusResult, statsResult, campaignsResult, approvalsResult] = await Promise.all([
        api.getSafetyConfig(),
        getWorkerStatus(),
        getDailyStats(),
        api.listCampaigns(),
        api.listPendingApprovals(),
      ]);
      setConfig(configResult);
      setStatus(statusResult);
      setStats(statsResult);
      setCampaigns(campaignsResult);
      setPendingApprovals(approvalsResult.length);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function toggleKillSwitch() {
    if (!config) return;
    setBusy(true);
    try {
      const updated = await api.setKillSwitch(!config.killSwitch);
      setConfig(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function triggerTick() {
    setBusy(true);
    try {
      await chrome.runtime.sendMessage({ type: "TRIGGER_TICK" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const engaged = config?.killSwitch ?? false;

  return (
    <div className="popup">
      <div className="header">
        <span className="logo-mark">
          <Zap size={12} strokeWidth={2.5} />
        </span>
        <h1>LinkedIn Lead-Gen</h1>
      </div>

      {error && (
        <div className="error">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {status && (
        <div className="status-pill">
          <span className={`status-dot ${status.state}`} />
          <span>
            {STATUS_LABEL[status.state] ?? status.state}
            {status.detail ? ` — ${status.detail}` : ""}
          </span>
        </div>
      )}

      <div className={`kill-switch-row ${engaged ? "engaged" : ""}`}>
        <div>
          <strong>Kill switch</strong>
          <div style={{ color: "var(--ink-muted)" }}>{engaged ? "All automation stopped" : "Automation active"}</div>
        </div>
        <button
          className={`toggle ${engaged ? "engaged" : ""}`}
          onClick={() => void toggleKillSwitch()}
          disabled={busy || !config}
          aria-label="Toggle kill switch"
        />
      </div>

      <div className="stats">
        <h2>Today</h2>
        {STAT_ROWS.map((row) => (
          <div className="stat-row" key={row.actionType}>
            <span>{row.label}</span>
            <span className="cap">
              {stats?.counts[row.actionType] ?? 0} / {config ? config[row.capField] : "…"}
            </span>
          </div>
        ))}
      </div>

      <div className="stats">
        <h2>Campaigns</h2>
        <div className="stat-row">
          <span>Active campaigns</span>
          <span className="cap">{campaigns.filter((c) => c.status === "active").length}</span>
        </div>
        <div className="stat-row">
          <span>Awaiting your approval</span>
          <span className="cap" style={pendingApprovals ? { color: "var(--critical)", fontWeight: 600 } : undefined}>
            {pendingApprovals ?? "…"}
          </span>
        </div>
      </div>

      <div className={`kill-switch-row ${selectorTestMode ? "info-active" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ScanEye size={15} style={{ flexShrink: 0, opacity: 0.7 }} />
          <div>
            <strong>Selector test mode</strong>
            <div style={{ color: "var(--ink-muted)" }}>
              {selectorTestMode ? "Highlighting matched elements on LinkedIn pages" : "Off"}
            </div>
          </div>
        </div>
        <button
          className={`toggle ${selectorTestMode ? "info-active" : ""}`}
          onClick={() => void toggleSelectorTestMode()}
          aria-label="Toggle selector test mode"
        />
      </div>

      <div className="actions">
        <button className="primary" onClick={() => void triggerTick()} disabled={busy}>
          <RefreshCw size={13} />
          Refresh now
        </button>
        <button
          onClick={() =>
            chrome.tabs.create({ url: pendingApprovals ? `${DASHBOARD_URL}/messages` : DASHBOARD_URL })
          }
        >
          Open dashboard
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}
