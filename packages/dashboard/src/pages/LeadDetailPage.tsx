import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, CheckCircle2, ExternalLink, MessageCircle, Send, Sparkles, Target } from "lucide-react";
import type { DealStatus, LeadDetailDto, LeadCrmStatus, Message, MessageType } from "@lgx/shared";
import { LEAD_CRM_STATUSES } from "@lgx/shared";
import { api } from "../lib/api.js";

const MESSAGE_TYPES: MessageType[] = ["welcome_message", "qualification_question", "follow_up", "ai_reply", "manual"];
const DEAL_STATUSES: DealStatus[] = ["open", "won", "lost"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const [lead, setLead] = useState<LeadDetailDto | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [savingDeal, setSavingDeal] = useState(false);
  const [messageType, setMessageType] = useState<MessageType>("welcome_message");
  const [queueingMessage, setQueueingMessage] = useState(false);
  const [queueingConnect, setQueueingConnect] = useState(false);
  const [justQueued, setJustQueued] = useState<string | null>(null);

  function load() {
    if (!leadId) return;
    api
      .getLead(leadId)
      .then((res) => {
        setLead(res);
        setNotes(res.notes ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    api
      .listMessages(leadId)
      .then(setMessages)
      .catch(() => undefined);
  }

  useEffect(load, [leadId]);

  async function handleStatusChange(status: string) {
    if (!leadId) return;
    setSavingStatus(true);
    try {
      const updated = await api.patchLead(leadId, { status });
      setLead((prev) => (prev ? { ...prev, status: updated.status } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleSaveNotes() {
    if (!leadId) return;
    setSavingNotes(true);
    try {
      await api.patchLead(leadId, { notes });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingNotes(false);
    }
  }

  async function toggleMeetingBooked() {
    if (!leadId || !lead) return;
    setSavingMeeting(true);
    try {
      const updated = await api.patchLead(leadId, { meetingBooked: !lead.meetingBookedAt });
      setLead((prev) => (prev ? { ...prev, meetingBookedAt: updated.meetingBookedAt } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingMeeting(false);
    }
  }

  async function rescoreLead() {
    if (!leadId) return;
    setRescoring(true);
    try {
      const updated = await api.rescoreLead(leadId);
      setLead((prev) => (prev ? { ...prev, score: updated.score, scoreReason: updated.scoreReason } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRescoring(false);
    }
  }

  async function updateDealStatus(dealStatus: string) {
    if (!leadId) return;
    setSavingDeal(true);
    try {
      const updated = await api.patchLead(leadId, { dealStatus });
      setLead((prev) => (prev ? { ...prev, dealStatus: updated.dealStatus } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingDeal(false);
    }
  }

  async function updateDealValue(value: string) {
    if (!leadId) return;
    const dealValue = value ? Number(value) : null;
    try {
      const updated = await api.patchLead(leadId, { dealValue });
      setLead((prev) => (prev ? { ...prev, dealValue: updated.dealValue } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function queueConnectRequest() {
    if (!leadId) return;
    setQueueingConnect(true);
    try {
      await api.enqueueAction({ leadId, actionType: "connect_request" });
      setJustQueued("connect_request");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setQueueingConnect(false);
    }
  }

  async function queueMessage() {
    if (!leadId) return;
    setQueueingMessage(true);
    try {
      await api.enqueueAction({ leadId, actionType: "send_message", details: { messageType } });
      setJustQueued("send_message");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setQueueingMessage(false);
    }
  }

  if (error) return <div className="error-banner">{error}</div>;
  if (!lead) return <p>Loading…</p>;

  const latestSnapshot = lead.profileSnapshots[0];

  return (
    <div>
      <Link className="back-link" to="/leads">
        <ArrowLeft size={13} />
        Back to leads
      </Link>

      <div className="detail-header">
        <div className="detail-header-top">
          <span className="avatar">{initials(lead.fullName)}</span>
          <div>
            <h1 style={{ marginBottom: 0 }}>{lead.fullName}</h1>
            <p className="headline">{lead.headline ?? "No headline captured"}</p>
            <a className="profile-link" href={lead.linkedinProfileUrl} target="_blank" rel="noreferrer">
              View on LinkedIn <ExternalLink size={11} />
            </a>
          </div>
        </div>
        <select value={lead.status} disabled={savingStatus} onChange={(e) => void handleStatusChange(e.target.value)}>
          {LEAD_CRM_STATUSES.map((s: LeadCrmStatus) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="detail-grid">
        <div>
          <div className="card">
            <h2><MessageCircle size={13} /> Conversation</h2>
            {messages.length === 0 ? (
              <p className="empty-state">No messages logged yet.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`message ${m.direction}`}>
                  {m.content}
                  <div className="message-meta">
                    {m.messageType.replace(/_/g, " ")} · {new Date(m.sentAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <h2><CheckCircle2 size={13} /> Action history</h2>
            {lead.actions.length === 0 ? (
              <p className="empty-state">No actions recorded yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>When</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {lead.actions.map((a) => (
                    <tr key={a.id}>
                      <td>{a.actionType.replace(/_/g, " ")}</td>
                      <td>{a.status.replace(/_/g, " ")}</td>
                      <td>{a.executedAt ? new Date(a.executedAt).toLocaleString() : "—"}</td>
                      <td style={{ color: a.errorMessage ? "var(--critical)" : "var(--ink-muted)", fontSize: 12 }}>
                        {a.errorMessage ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <div className="card">
            <h2><Target size={13} /> Profile snapshot</h2>
            {latestSnapshot ? (
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                <div>
                  <strong>Position:</strong> {latestSnapshot.currentPosition ?? "—"}
                </div>
                <div>
                  <strong>Company:</strong> {latestSnapshot.company ?? "—"}
                </div>
                <div>
                  <strong>Posts (30d):</strong> {latestSnapshot.activitySignals.postCountLast30Days}
                </div>
                <div style={{ marginTop: 8, color: "var(--ink-secondary)" }}>{latestSnapshot.aboutText ?? "No about text"}</div>
              </div>
            ) : (
              <p className="empty-state">Not scraped yet.</p>
            )}
          </div>

          <div className="card">
            <h2><Send size={13} /> Queue outreach</h2>
            {lead.status === "NEW" && (
              <button className="primary" disabled={queueingConnect} onClick={() => void queueConnectRequest()}>
                <Send size={14} />
                Queue connect request
              </button>
            )}
            {lead.status !== "NEW" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select value={messageType} onChange={(e) => setMessageType(e.target.value as MessageType)}>
                  {MESSAGE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <button className="primary" disabled={queueingMessage} onClick={() => void queueMessage()}>
                  Queue message
                </button>
              </div>
            )}
            {justQueued && (
              <p style={{ color: "var(--good-text)", fontSize: 12, marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <CheckCircle2 size={13} />
                Sent to the Messages tab for your approval — nothing sends until you approve it there.
              </p>
            )}
          </div>

          <div className="card">
            <h2><Sparkles size={13} /> Score &amp; deal</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{lead.score ?? "—"}</div>
              <div style={{ fontSize: 12, color: "var(--ink-secondary)", flex: 1 }}>{lead.scoreReason ?? "Not scored yet."}</div>
              <button disabled={rescoring} onClick={() => void rescoreLead()}>
                Re-score
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={lead.dealStatus} disabled={savingDeal} onChange={(e) => void updateDealStatus(e.target.value)}>
                {DEAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Deal value"
                defaultValue={lead.dealValue ?? ""}
                onBlur={(e) => void updateDealValue(e.target.value)}
                style={{ width: 100 }}
              />
            </div>
          </div>

          <div className="card">
            <h2><Calendar size={13} /> Meeting</h2>
            <button disabled={savingMeeting} onClick={() => void toggleMeetingBooked()}>
              {lead.meetingBookedAt ? `Booked ${new Date(lead.meetingBookedAt).toLocaleDateString()} — unmark` : "Mark meeting booked"}
            </button>
          </div>

          <div className="card">
            <h2><Target size={13} /> Notes</h2>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div style={{ marginTop: 8 }}>
              <button className="primary" disabled={savingNotes} onClick={() => void handleSaveNotes()}>
                Save notes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
