import { useEffect, useState } from "react";
import { Megaphone, Plus, RotateCw, Search, Trash2 } from "lucide-react";
import type { ActionType, ActivityLevel, Campaign, Persona, SequenceStep } from "@lgx/shared";
import { DEFAULT_SEQUENCE_STEPS } from "@lgx/shared";
import { api, type CampaignInput } from "../lib/api.js";
import { PageHeader } from "../components/PageHeader.js";

const PERSONAS: Persona[] = ["radiologist", "diagnostic_centre_owner", "teleradiology_founder"];
const ACTIVITY_LEVELS: ActivityLevel[] = ["active", "inactive", "unknown"];
const SEQUENCE_ACTION_TYPES: ActionType[] = [
  "view_profile",
  "like_post",
  "comment_post",
  "connect_request",
  "send_message",
];

const EMPTY_FORM: CampaignInput = {
  name: "",
  keywords: [],
  locations: [],
  persona: null,
  qualificationQuestions: [],
  connectionNoteTemplate: "",
  welcomeMessageTemplate: "",
  followUpTemplate: "",
  industries: [],
  seniorities: [],
  currentCompanies: [],
  companySizeMin: null,
  companySizeMax: null,
  minActivityLevel: null,
};

function toLines(values: string[]): string {
  return values.join("\n");
}

function fromLines(value: string): string[] {
  return value
    .split("\n")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<(Campaign & { _count: { leads: number } })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<CampaignInput>(EMPTY_FORM);
  const [keywordsText, setKeywordsText] = useState("");
  const [locationsText, setLocationsText] = useState("");
  const [questionsText, setQuestionsText] = useState("");
  const [industriesText, setIndustriesText] = useState("");
  const [senioritiesText, setSenioritiesText] = useState("");
  const [companiesText, setCompaniesText] = useState("");
  const [steps, setSteps] = useState<SequenceStep[]>(DEFAULT_SEQUENCE_STEPS);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedNote, setGeneratedNote] = useState<string | null>(null);

  function load() {
    api
      .listCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(load, []);

  function startNew() {
    setForm(EMPTY_FORM);
    setKeywordsText("");
    setLocationsText("");
    setQuestionsText("");
    setIndustriesText("");
    setSenioritiesText("");
    setCompaniesText("");
    setSteps(DEFAULT_SEQUENCE_STEPS);
    setEditingId("new");
  }

  function startEdit(campaign: Campaign) {
    setForm({
      name: campaign.name,
      keywords: campaign.keywords,
      locations: campaign.locations,
      persona: campaign.persona,
      status: campaign.status,
      dailyConnectionLimit: campaign.dailyConnectionLimit,
      dailyMessageLimit: campaign.dailyMessageLimit,
      dailySearchLimit: campaign.dailySearchLimit,
      minDelaySeconds: campaign.minDelaySeconds,
      maxDelaySeconds: campaign.maxDelaySeconds,
      engagementIntervalHours: campaign.engagementIntervalHours,
      connectionNoteTemplate: campaign.connectionNoteTemplate ?? "",
      welcomeMessageTemplate: campaign.welcomeMessageTemplate ?? "",
      followUpTemplate: campaign.followUpTemplate ?? "",
      qualificationQuestions: campaign.qualificationQuestions,
      companySizeMin: campaign.companySizeMin,
      companySizeMax: campaign.companySizeMax,
      minActivityLevel: campaign.minActivityLevel,
    });
    setKeywordsText(toLines(campaign.keywords));
    setLocationsText(toLines(campaign.locations));
    setQuestionsText(toLines(campaign.qualificationQuestions));
    setIndustriesText(toLines(campaign.industries));
    setSenioritiesText(toLines(campaign.seniorities));
    setCompaniesText(toLines(campaign.currentCompanies));
    setSteps(campaign.sequenceSteps && campaign.sequenceSteps.length > 0 ? campaign.sequenceSteps : DEFAULT_SEQUENCE_STEPS);
    setEditingId(campaign.id);
  }

  function addStep() {
    const nextDay = steps.length > 0 ? Math.max(...steps.map((s) => s.day)) + 1 : 1;
    setSteps([...steps, { day: nextDay, actions: [] }]);
  }

  function removeStep(day: number) {
    setSteps(steps.filter((s) => s.day !== day));
  }

  function toggleStepAction(day: number, actionType: ActionType) {
    setSteps(
      steps.map((s) =>
        s.day === day
          ? { ...s, actions: s.actions.includes(actionType) ? s.actions.filter((a) => a !== actionType) : [...s.actions, actionType] }
          : s,
      ),
    );
  }

  async function handleSave() {
    setSaving(true);
    const body: CampaignInput = {
      ...form,
      keywords: fromLines(keywordsText),
      locations: fromLines(locationsText),
      qualificationQuestions: fromLines(questionsText),
      industries: fromLines(industriesText),
      seniorities: fromLines(senioritiesText),
      currentCompanies: fromLines(companiesText),
      sequenceSteps: steps.filter((s) => s.actions.length > 0),
    };
    try {
      if (editingId === "new") {
        await api.createCampaign(body);
      } else if (editingId) {
        await api.updateCampaign(editingId, body);
      }
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(campaign: Campaign) {
    try {
      await api.updateCampaign(campaign.id, { status: campaign.status === "active" ? "paused" : "active" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteCampaign(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleGenerateSearchTasks(id: string) {
    setGeneratingId(id);
    setGeneratedNote(null);
    try {
      const { created } = await api.generateSearchTasks(id);
      setGeneratedNote(`${created} search task(s) queued.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        icon={Megaphone}
        title="Campaigns"
        description="Keyword + location targeting, daily limits, message sequences, and templates — one campaign per outreach motion."
        actions={
          editingId === null ? (
            <button className="primary" onClick={startNew}>
              <Plus size={15} />
              New campaign
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="error-banner">
          <span>{error}</span>
        </div>
      )}
      {generatedNote && (
        <div className="success-banner">
          <span>{generatedNote}</span>
        </div>
      )}

      {editingId !== null && (
        <div className="card">
          <h2>{editingId === "new" ? "New campaign" : "Edit campaign"}</h2>

          <div className="form-grid" style={{ marginBottom: 12 }}>
            <label className="form-row">
              Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="form-row">
              Persona
              <select
                value={form.persona ?? ""}
                onChange={(e) => setForm({ ...form, persona: e.target.value || null })}
              >
                <option value="">Any</option>
                {PERSONAS.map((p) => (
                  <option key={p} value={p}>
                    {p.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-grid" style={{ marginBottom: 12 }}>
            <label className="form-row">
              Keywords (one per line)
              <textarea value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} />
            </label>
            <label className="form-row">
              Locations (one per line, optional)
              <textarea value={locationsText} onChange={(e) => setLocationsText(e.target.value)} />
            </label>
          </div>

          <div className="form-grid" style={{ marginBottom: 12 }}>
            <label className="form-row">
              Daily connection limit
              <input
                type="number"
                value={form.dailyConnectionLimit ?? 15}
                onChange={(e) => setForm({ ...form, dailyConnectionLimit: Number(e.target.value) })}
              />
            </label>
            <label className="form-row">
              Daily message limit
              <input
                type="number"
                value={form.dailyMessageLimit ?? 25}
                onChange={(e) => setForm({ ...form, dailyMessageLimit: Number(e.target.value) })}
              />
            </label>
            <label className="form-row">
              Daily search limit
              <input
                type="number"
                value={form.dailySearchLimit ?? 15}
                onChange={(e) => setForm({ ...form, dailySearchLimit: Number(e.target.value) })}
              />
            </label>
            <label className="form-row">
              Engagement interval (hours between days)
              <input
                type="number"
                value={form.engagementIntervalHours ?? 24}
                onChange={(e) => setForm({ ...form, engagementIntervalHours: Number(e.target.value) })}
              />
            </label>
            <label className="form-row">
              Min delay between actions (seconds)
              <input
                type="number"
                value={form.minDelaySeconds ?? 20}
                onChange={(e) => setForm({ ...form, minDelaySeconds: Number(e.target.value) })}
              />
            </label>
            <label className="form-row">
              Max delay between actions (seconds)
              <input
                type="number"
                value={form.maxDelaySeconds ?? 90}
                onChange={(e) => setForm({ ...form, maxDelaySeconds: Number(e.target.value) })}
              />
            </label>
          </div>

          <h2>Targeting filters</h2>
          <p style={{ color: "var(--ink-muted)", fontSize: 12, marginTop: -8 }}>
            Applied from day 2 onward, once a profile scrape has data to check against. Day 1 always runs — that's
            what captures it.
          </p>
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <label className="form-row">
              Industries (one per line)
              <textarea value={industriesText} onChange={(e) => setIndustriesText(e.target.value)} />
            </label>
            <label className="form-row">
              Seniority (one per line: executive / director / manager / individual_contributor)
              <textarea value={senioritiesText} onChange={(e) => setSenioritiesText(e.target.value)} />
            </label>
            <label className="form-row">
              Current company (one per line, substring match)
              <textarea value={companiesText} onChange={(e) => setCompaniesText(e.target.value)} />
            </label>
            <label className="form-row">
              Min activity level
              <select
                value={form.minActivityLevel ?? ""}
                onChange={(e) => setForm({ ...form, minActivityLevel: e.target.value || null })}
              >
                <option value="">Any</option>
                {ACTIVITY_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Company size min
              <input
                type="number"
                value={form.companySizeMin ?? ""}
                onChange={(e) => setForm({ ...form, companySizeMin: e.target.value ? Number(e.target.value) : null })}
              />
            </label>
            <label className="form-row">
              Company size max
              <input
                type="number"
                value={form.companySizeMax ?? ""}
                onChange={(e) => setForm({ ...form, companySizeMax: e.target.value ? Number(e.target.value) : null })}
              />
            </label>
          </div>

          <h2>Message sequence</h2>
          <p style={{ color: "var(--ink-muted)", fontSize: 12, marginTop: -8 }}>
            One step per {form.engagementIntervalHours ?? 24}h. connect_request/send_message always require your
            approval regardless of position.
          </p>
          {steps.map((step) => (
            <div key={step.day} className="form-row" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Day {step.day}</strong>
                <button onClick={() => removeStep(step.day)}>Remove</button>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                {SEQUENCE_ACTION_TYPES.map((actionType) => (
                  <label key={actionType} style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 400 }}>
                    <input
                      type="checkbox"
                      checked={step.actions.includes(actionType)}
                      onChange={() => toggleStepAction(step.day, actionType)}
                    />
                    {actionType.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button onClick={addStep} style={{ marginBottom: 16 }}>
            Add day
          </button>

          <h2>Messaging templates</h2>
          <p style={{ color: "var(--ink-muted)", fontSize: 12, marginTop: -8 }}>
            Variables: {"{{name}} {{company}} {{headline}} {{location}}"}
          </p>
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <label className="form-row">
              Connection note template
              <textarea
                value={form.connectionNoteTemplate ?? ""}
                onChange={(e) => setForm({ ...form, connectionNoteTemplate: e.target.value })}
              />
            </label>
            <label className="form-row">
              Welcome message template
              <textarea
                value={form.welcomeMessageTemplate ?? ""}
                onChange={(e) => setForm({ ...form, welcomeMessageTemplate: e.target.value })}
              />
            </label>
            <label className="form-row">
              Follow-up template
              <textarea
                value={form.followUpTemplate ?? ""}
                onChange={(e) => setForm({ ...form, followUpTemplate: e.target.value })}
              />
            </label>
            <label className="form-row">
              Qualification questions (one per line)
              <textarea value={questionsText} onChange={(e) => setQuestionsText(e.target.value)} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="primary" disabled={saving || !form.name} onClick={() => void handleSave()}>
              Save campaign
            </button>
            <button onClick={() => setEditingId(null)}>Cancel</button>
          </div>
        </div>
      )}

      {campaigns.map((campaign) => (
        <div className="card" key={campaign.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: 15 }}>{campaign.name}</strong>
                <span className={`badge status-${campaign.status === "active" ? "NEW" : "CLOSED"}`}>
                  {campaign.status}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-secondary)" }}>
                {campaign.keywords.join(", ") || "no keywords"} · {campaign._count.leads} lead(s)
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => startEdit(campaign)}>Edit</button>
              <button disabled={generatingId === campaign.id} onClick={() => void handleGenerateSearchTasks(campaign.id)}>
                <Search size={14} />
                Generate search tasks
              </button>
              <button onClick={() => void toggleStatus(campaign)}>
                <RotateCw size={14} />
                {campaign.status === "active" ? "Pause" : "Resume"}
              </button>
              <button className="danger" onClick={() => void handleDelete(campaign.id)}>
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}

      {campaigns.length === 0 && editingId === null && (
        <div className="empty-state">
          <Megaphone size={28} />
          No campaigns yet — create one to start finding and engaging leads.
        </div>
      )}
    </div>
  );
}
