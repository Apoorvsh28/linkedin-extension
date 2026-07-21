import { useEffect, useState } from "react";
import { CheckCircle2, OctagonX, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import type { SafetyConfigRecordDto } from "@lgx/shared";
import { api } from "../lib/api.js";
import { PageHeader } from "../components/PageHeader.js";

const FIELD_GROUPS: Array<{ title: string; fields: Array<{ key: keyof SafetyConfigRecordDto; label: string }> }> = [
  {
    title: "Daily / weekly caps",
    fields: [
      { key: "connectionRequestsPerDay", label: "Connection requests / day" },
      { key: "connectionRequestsPerWeek", label: "Connection requests / week" },
      { key: "likesPerDay", label: "Likes / day" },
      { key: "commentsPerDay", label: "Comments / day" },
      { key: "messagesPerDay", label: "Messages / day" },
      { key: "profileVisitsPerDay", label: "Profile visits / day" },
      { key: "searchPagesPerDay", label: "Search pages / day" },
    ],
  },
  {
    title: "Active hours",
    fields: [
      { key: "activeHoursStartHour", label: "Start hour (0-23)" },
      { key: "activeHoursEndHour", label: "End hour (0-23)" },
      { key: "activeHoursJitterMinutes", label: "Jitter (minutes)" },
    ],
  },
  {
    title: "Pacing between actions",
    fields: [
      { key: "minDelaySeconds", label: "Min delay (seconds)" },
      { key: "maxDelaySeconds", label: "Max delay (seconds)" },
    ],
  },
  {
    title: "Breaks",
    fields: [
      { key: "breakEveryActionsMin", label: "Break every ≥ actions" },
      { key: "breakEveryActionsMax", label: "Break every ≤ actions" },
      { key: "breakDurationMinMinutes", label: "Break length min (minutes)" },
      { key: "breakDurationMaxMinutes", label: "Break length max (minutes)" },
    ],
  },
  {
    title: "Session length",
    fields: [
      { key: "sessionMaxDurationMinutesMin", label: "Session min (minutes)" },
      { key: "sessionMaxDurationMinutesMax", label: "Session max (minutes)" },
    ],
  },
  {
    title: "Reliability",
    fields: [
      { key: "connectionCheckIntervalHours", label: "Check invitations every (hours)" },
      { key: "maxActionAttempts", label: "Max retry attempts per action" },
    ],
  },
];

export function SettingsPage() {
  const [config, setConfig] = useState<SafetyConfigRecordDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function load() {
    api
      .getSafetyConfig()
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(load, []);

  function setField(key: keyof SafetyConfigRecordDto, value: number) {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const { id, killSwitch, updatedAt, ...rest } = config;
      const updated = await api.updateSafetyConfig(rest);
      setConfig(updated);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleKillSwitch() {
    if (!config) return;
    try {
      const updated = await api.setKillSwitch(!config.killSwitch);
      setConfig(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (error) return <div className="error-banner">{error}</div>;
  if (!config) return <p>Loading…</p>;

  return (
    <div>
      <PageHeader icon={SettingsIcon} title="Settings" description="Safety caps, pacing, breaks, and reliability — everything that keeps automation human-paced." />

      <div className={`kill-switch-banner ${config.killSwitch ? "engaged" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {config.killSwitch ? <OctagonX size={18} color="var(--critical)" /> : <ShieldCheck size={18} color="var(--good)" />}
          <div>
            <strong>Kill switch</strong>
            <div style={{ color: "var(--ink-secondary)", fontSize: 12.5 }}>
              {config.killSwitch ? "All automated actions are stopped." : "Automation is running within the limits below."}
            </div>
          </div>
        </div>
        <button className={config.killSwitch ? "danger" : ""} onClick={() => void toggleKillSwitch()}>
          {config.killSwitch ? "Disengage" : "Engage kill switch"}
        </button>
      </div>

      {FIELD_GROUPS.map((group) => (
        <div className="card" key={group.title}>
          <h2>{group.title}</h2>
          <div className="form-grid">
            {group.fields.map((field) => (
              <label className="form-row" key={field.key}>
                {field.label}
                <input
                  type="number"
                  value={config[field.key] as number}
                  onChange={(e) => setField(field.key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="primary" disabled={saving} onClick={() => void handleSave()}>
          Save changes
        </button>
        {savedAt && (
          <span style={{ color: "var(--good-text)", fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
            <CheckCircle2 size={14} />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
