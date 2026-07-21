import { useEffect, useState } from "react";
import { Layers, Search, Users, Link2, MessageSquare } from "lucide-react";
import type { QueueStatusCountsDto, QueueSummaryDto } from "@lgx/shared";
import { api } from "../lib/api.js";
import { PageHeader } from "../components/PageHeader.js";

const QUEUES: Array<{ key: keyof QueueSummaryDto; label: string; icon: typeof Search }> = [
  { key: "search", label: "Search Queue", icon: Search },
  { key: "engagement", label: "Engagement Queue", icon: Users },
  { key: "connection", label: "Connection Queue", icon: Link2 },
  { key: "message", label: "Message Queue", icon: MessageSquare },
];

const STATUS_ORDER: Array<keyof QueueStatusCountsDto> = [
  "pending_approval",
  "queued",
  "in_progress",
  "success",
  "failed",
  "skipped",
  "blocked",
  "dead_letter",
];

export function QueuesPage() {
  const [summary, setSummary] = useState<QueueSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .getQueueSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <PageHeader icon={Layers} title="Queues" description="Live counts of everything in flight, refreshed every few seconds." />
      {error && <div className="error-banner">{error}</div>}

      {summary &&
        QUEUES.map(({ key, label, icon: Icon }) => {
          const counts = summary[key];
          return (
            <div className="card" key={key}>
              <h2>
                <Icon size={13} /> {label}
              </h2>
              <div className="queue-status-row">
                {STATUS_ORDER.map((status) => (
                  <div className="queue-tile" key={status}>
                    <div
                      className="qval"
                      style={{
                        color: status === "dead_letter" || status === "blocked" ? "var(--critical)" : "var(--ink)",
                      }}
                    >
                      {counts[status]}
                    </div>
                    <div className="qlabel">{status.replace(/_/g, " ")}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
