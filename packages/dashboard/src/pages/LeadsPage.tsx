import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Send, Users } from "lucide-react";
import type { Campaign, Lead, LeadCrmStatus, Persona } from "@lgx/shared";
import { LEAD_CRM_STATUSES } from "@lgx/shared";
import { api } from "../lib/api.js";
import { PageHeader } from "../components/PageHeader.js";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

const PERSONAS: Persona[] = ["radiologist", "diagnostic_centre_owner", "teleradiology_founder"];
const PAGE_SIZE = 25;

export function LeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [persona, setPersona] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queueing, setQueueing] = useState(false);
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.listCampaigns().then(setCampaigns).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string> = { page: String(page), pageSize: String(PAGE_SIZE) };
    if (status) params.status = status;
    if (persona) params.persona = persona;
    if (campaignId) params.campaignId = campaignId;
    if (q) params.q = q;

    api
      .listLeads(params)
      .then((res) => {
        if (cancelled) return;
        setLeads(res.leads);
        setTotal(res.total);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [page, status, persona, campaignId, q]);

  useEffect(() => {
    setSelected(new Set());
  }, [leads]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectableIds = leads.filter((l) => l.status === "NEW").map((l) => l.id);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === selectableIds.length ? new Set() : new Set(selectableIds)));
  }

  async function queueConnectRequests(ids: string[]) {
    setQueueing(true);
    try {
      for (const leadId of ids) {
        await api.enqueueAction({ leadId, actionType: "connect_request" });
      }
      setQueuedIds((prev) => new Set([...prev, ...ids]));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setQueueing(false);
    }
  }

  return (
    <div>
      <PageHeader icon={Users} title="Leads" description="Every prospect found across your campaigns, with live status, score, and engagement progress." />

      <div className="filters">
        <input
          placeholder="Search name or headline…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">All statuses</option>
          {LEAD_CRM_STATUSES.map((s: LeadCrmStatus) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={persona}
          onChange={(e) => {
            setPage(1);
            setPersona(e.target.value);
          }}
        >
          <option value="">All personas</option>
          {PERSONAS.map((p) => (
            <option key={p} value={p}>
              {p.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={campaignId}
          onChange={(e) => {
            setPage(1);
            setCampaignId(e.target.value);
          }}
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {selected.size > 0 && (
        <div className="kill-switch-banner" style={{ marginBottom: 12 }}>
          <span>{selected.size} selected</span>
          <button className="primary" disabled={queueing} onClick={() => void queueConnectRequests([...selected])}>
            <Send size={14} />
            Queue connect request{selected.size > 1 ? "s" : ""}
          </button>
        </div>
      )}

      {!loading && leads.length === 0 ? (
        <div className="empty-state">
          <Users size={28} />
          No leads match these filters yet.
        </div>
      ) : (
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                {selectableIds.length > 0 && (
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === selectableIds.length}
                    onChange={toggleSelectAll}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </th>
              <th>Name</th>
              <th>Headline</th>
              <th>Persona</th>
              <th>Score</th>
              <th>Status</th>
              <th>Engagement day</th>
              <th>Last synced</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}>
                <td onClick={(e) => e.stopPropagation()}>
                  {lead.status === "NEW" && (
                    <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelected(lead.id)} />
                  )}
                </td>
                <td>
                  <div className="lead-cell">
                    <span className="avatar">{initials(lead.fullName)}</span>
                    {lead.fullName}
                  </div>
                </td>
                <td>{lead.headline ?? "—"}</td>
                <td>{lead.persona.replace(/_/g, " ")}</td>
                <td className="num">{lead.score ?? "—"}</td>
                <td>
                  <span className={`badge status-${lead.status}`}>{lead.status.replace(/_/g, " ")}</span>
                </td>
                <td className="num">{lead.campaignId ? `${lead.engagementDay}/4` : "—"}</td>
                <td>{new Date(lead.lastSyncedAt).toLocaleString()}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {lead.status === "NEW" &&
                    (queuedIds.has(lead.id) ? (
                      <span style={{ color: "var(--good-text)", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle2 size={13} />
                        Queued
                      </span>
                    ) : (
                      <button disabled={queueing} onClick={() => void queueConnectRequests([lead.id])}>
                        Queue connect
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages} ({total} leads)
        </span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
