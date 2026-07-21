import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Inbox, MessageSquare, X } from "lucide-react";
import type { ApproveActionResponseDto, Campaign } from "@lgx/shared";
import { leadTemplateVariables, renderTemplate } from "@lgx/shared";
import { api } from "../lib/api.js";
import { PageHeader } from "../components/PageHeader.js";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function previewFor(item: ApproveActionResponseDto, campaigns: Map<string, Campaign>): string | null {
  const campaign = item.lead.campaignId ? campaigns.get(item.lead.campaignId) : undefined;
  if (!campaign) return null;

  const template =
    item.actionType === "connect_request"
      ? campaign.connectionNoteTemplate
      : (item.details?.messageType as string | undefined) === "welcome_message"
        ? campaign.welcomeMessageTemplate
        : campaign.followUpTemplate;

  if (!template) return null;
  return renderTemplate(template, leadTemplateVariables({ fullName: item.lead.fullName, company: item.lead.company, headline: item.lead.headline, location: item.lead.location }));
}

export function MessagesPage() {
  const [items, setItems] = useState<ApproveActionResponseDto[]>([]);
  const [campaigns, setCampaigns] = useState<Map<string, Campaign>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  function load() {
    Promise.all([api.listPendingApprovals(), api.listCampaigns()])
      .then(([approvals, campaignList]) => {
        setItems(approvals);
        setCampaigns(new Map(campaignList.map((c) => [c.id, c])));
        setSelected(new Set());
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(load, []);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await api.approveAction(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    try {
      await api.rejectAction(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  async function handleBulk(action: "approve" | "reject") {
    setBulkBusy(true);
    try {
      const ids = [...selected];
      const result = action === "approve" ? await api.bulkApprove(ids) : await api.bulkReject(ids);
      setItems((prev) => prev.filter((i) => !result.succeeded.includes(i.id)));
      setSelected(new Set());
      if (result.failed.length > 0) {
        setError(`${result.failed.length} item(s) failed: ${result.failed.map((f) => f.error).join("; ")}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        icon={MessageSquare}
        title="Messages"
        description="Connection requests and messages wait here until you approve them — nothing sends automatically."
      />

      {error && <div className="error-banner">{error}</div>}

      {items.length > 0 && (
        <div className="filters" style={{ marginBottom: 12 }}>
          <label className="pill-checkbox">
            <input type="checkbox" checked={selected.size === items.length} onChange={toggleSelectAll} />
            Select all
          </label>
          {selected.size > 0 && (
            <>
              <button className="primary" disabled={bulkBusy} onClick={() => void handleBulk("approve")}>
                <Check size={14} />
                Approve {selected.size} selected
              </button>
              <button disabled={bulkBusy} onClick={() => void handleBulk("reject")}>
                <X size={14} />
                Reject {selected.size} selected
              </button>
            </>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <Inbox size={28} />
          Nothing waiting on you right now.
        </div>
      ) : (
        items.map((item) => {
          const preview = previewFor(item, campaigns);
          return (
            <div className="card" key={item.id}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelected(item.id)} />
                  <span className="avatar">{initials(item.lead.fullName)}</span>
                  <div>
                    <strong>
                      <Link to={`/leads/${item.lead.id}`}>{item.lead.fullName}</Link>
                    </strong>
                    <div style={{ color: "var(--ink-muted)", fontSize: 12 }}>
                      {item.actionType.replace(/_/g, " ")}
                      {typeof item.details?.messageType === "string" ? ` · ${item.details.messageType.replace(/_/g, " ")}` : ""}
                    </div>
                  </div>
                </div>
              </div>

              {preview ? (
                <div className="message outbound" style={{ marginLeft: 0 }}>
                  {preview}
                </div>
              ) : (
                <p style={{ color: "var(--ink-muted)", fontSize: 12.5 }}>
                  No campaign template for this lead — it will send without pre-written text (connect: no note /
                  message: generated live by Claude at send time).
                </p>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="primary" disabled={busyId === item.id} onClick={() => void handleApprove(item.id)}>
                  <Check size={14} />
                  Approve
                </button>
                <button disabled={busyId === item.id} onClick={() => void handleReject(item.id)}>
                  <X size={14} />
                  Reject
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
