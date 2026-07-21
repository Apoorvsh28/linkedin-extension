import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, History, RotateCcw, ScrollText } from "lucide-react";
import type { ActionListItemDto, LogCategory, SystemLog } from "@lgx/shared";
import { LOG_CATEGORIES } from "@lgx/shared";
import { api } from "../lib/api.js";
import { PageHeader } from "../components/PageHeader.js";

type LogFilter = "all" | "success" | "failed" | "retry" | "blocked" | "dead_letter";

const FILTERS: Array<{ key: LogFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "success", label: "Success" },
  { key: "failed", label: "Failed" },
  { key: "retry", label: "Retry" },
  { key: "blocked", label: "Blocked" },
  { key: "dead_letter", label: "Dead letter" },
];

function ActionsLog() {
  const [actions, setActions] = useState<ActionListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<LogFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [requeueingId, setRequeueingId] = useState<string | null>(null);

  function load() {
    const params: Record<string, string> = { pageSize: "100" };
    if (filter === "success" || filter === "failed" || filter === "blocked" || filter === "dead_letter") {
      params.status = filter;
    }

    api
      .listActions(params)
      .then((res) => {
        const filtered =
          filter === "retry" ? res.actions.filter((a) => a.attempts > 0 && a.status === "queued") : res.actions;
        setActions(filtered);
        setTotal(filter === "retry" ? filtered.length : res.total);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(load, [filter]);

  async function handleRequeue(id: string) {
    setRequeueingId(id);
    try {
      await api.requeueAction(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRequeueingId(null);
    }
  }

  return (
    <div>
      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? "primary" : ""} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
        <span style={{ alignSelf: "center", color: "var(--ink-muted)", fontSize: 12.5 }}>{total} action(s)</span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {actions.length === 0 ? (
        <div className="empty-state">
          <History size={26} />
          Nothing here.
        </div>
      ) : (
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Lead</th>
              <th>Type</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>When</th>
              <th>Detail</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link to={`/leads/${a.lead.id}`}>{a.lead.fullName}</Link>
                </td>
                <td>{a.actionType.replace(/_/g, " ")}</td>
                <td>
                  <span
                    className={`badge status-${
                      a.status === "success" ? "QUALIFIED" : a.status === "dead_letter" || a.status === "failed" || a.status === "blocked" ? "CLOSED" : "NEW"
                    }`}
                  >
                    {a.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="num">{a.attempts}</td>
                <td>{a.executedAt ? new Date(a.executedAt).toLocaleString() : "—"}</td>
                <td style={{ color: a.errorMessage ? "var(--critical)" : "var(--ink-muted)", fontSize: 12 }}>{a.errorMessage ?? "—"}</td>
                <td>
                  {a.status === "dead_letter" && (
                    <button disabled={requeueingId === a.id} onClick={() => void handleRequeue(a.id)}>
                      <RotateCcw size={13} />
                      Requeue
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

function SystemLogsView() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [category, setCategory] = useState<LogCategory | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params: Record<string, string> = { pageSize: "100" };
    if (category) params.category = category;
    api
      .listLogs(params)
      .then((res) => setLogs(res.logs))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [category]);

  return (
    <div>
      <div className="filters">
        <button className={category === "" ? "primary" : ""} onClick={() => setCategory("")}>
          All
        </button>
        {LOG_CATEGORIES.map((c) => (
          <button key={c} className={category === c ? "primary" : ""} onClick={() => setCategory(c)}>
            {c.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {logs.length === 0 ? (
        <div className="empty-state">
          <ScrollText size={26} />
          No system log entries.
        </div>
      ) : (
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Message</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>
                  <span className="badge">{l.category.replace(/_/g, " ")}</span>
                </td>
                <td>{l.message}</td>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

export function ActivitiesPage() {
  const [view, setView] = useState<"actions" | "logs">("actions");

  return (
    <div>
      <PageHeader icon={Activity} title="Activities" description="Every action the extension has taken or attempted, plus system-level events." />
      <div className="filters" style={{ marginBottom: 4 }}>
        <button className={view === "actions" ? "primary" : ""} onClick={() => setView("actions")}>
          <History size={14} />
          Action history
        </button>
        <button className={view === "logs" ? "primary" : ""} onClick={() => setView("logs")}>
          <ScrollText size={14} />
          System logs
        </button>
      </div>
      {view === "actions" ? <ActionsLog /> : <SystemLogsView />}
    </div>
  );
}
