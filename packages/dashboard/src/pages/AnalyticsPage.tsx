import { useEffect, useState } from "react";
import {
  BarChart3,
  Handshake,
  Link2,
  MessageSquare,
  Search,
  Target,
  Trophy,
  UserPlus,
} from "lucide-react";
import type { AnalyticsSummaryDto, Campaign } from "@lgx/shared";
import { api } from "../lib/api.js";
import { PageHeader } from "../components/PageHeader.js";

const TILES: Array<{ key: keyof AnalyticsSummaryDto; label: string; icon: typeof Search }> = [
  { key: "searches", label: "Searches", icon: Search },
  { key: "leadsFound", label: "Leads found", icon: UserPlus },
  { key: "connectionsSent", label: "Connections sent", icon: Link2 },
  { key: "connectionsAccepted", label: "Connections accepted", icon: Handshake },
  { key: "replies", label: "Replies", icon: MessageSquare },
  { key: "meetingsBooked", label: "Meetings booked", icon: Target },
  { key: "dealsWon", label: "Deals won", icon: Trophy },
];

// Ordinal ramp, lightest->darkest, funnel stages narrowing top to bottom (all steps within the
// 250-600 band so the same set clears the 2:1 floor on both light and dark surfaces).
const FUNNEL_COLORS = [
  "var(--seq-250)",
  "var(--seq-300)",
  "var(--seq-350)",
  "var(--seq-450)",
  "var(--seq-500)",
  "var(--seq-550)",
  "var(--seq-600)",
];

function Funnel({ summary }: { summary: AnalyticsSummaryDto }) {
  const stages: Array<{ label: string; value: number }> = [
    { label: "Searches", value: summary.searches },
    { label: "Leads found", value: summary.leadsFound },
    { label: "Connections sent", value: summary.connectionsSent },
    { label: "Accepted", value: summary.connectionsAccepted },
    { label: "Replies", value: summary.replies },
    { label: "Meetings", value: summary.meetingsBooked },
    { label: "Deals won", value: summary.dealsWon },
  ];
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="funnel">
      {stages.map((s, i) => (
        <div className="funnel-row" key={s.label}>
          <div className="funnel-label">{s.label}</div>
          <div className="funnel-track">
            <div
              className="funnel-fill"
              style={{ width: `${Math.max(4, (s.value / max) * 100)}%`, background: FUNNEL_COLORS[i] }}
            />
          </div>
          <div className="funnel-value">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummaryDto | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listCampaigns().then(setCampaigns).catch(() => undefined);
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (campaignId) params.campaignId = campaignId;
    api
      .getAnalytics(params)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [campaignId]);

  return (
    <div>
      <PageHeader icon={BarChart3} title="Analytics" description="Pipeline volume and conversion, from first search to closed deal." />

      <div className="filters">
        <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {summary && (
        <>
          <div className="analytics-grid" style={{ marginBottom: 16 }}>
            {TILES.map((tile) => {
              const Icon = tile.icon;
              return (
                <div className="card analytics-tile" key={tile.key}>
                  <span className="tile-icon">
                    <Icon size={15} />
                  </span>
                  <div className="analytics-value">{summary[tile.key] ?? 0}</div>
                  <div className="analytics-label">{tile.label}</div>
                </div>
              );
            })}
            <div className="card analytics-tile">
              <span className="tile-icon">
                <Handshake size={15} />
              </span>
              <div className="analytics-value">
                {summary.acceptanceRate !== null ? `${Math.round(summary.acceptanceRate * 100)}%` : "—"}
              </div>
              <div className="analytics-label">Acceptance rate</div>
            </div>
          </div>

          <div className="card">
            <h2>Funnel</h2>
            <Funnel summary={summary} />
          </div>
        </>
      )}
    </div>
  );
}
