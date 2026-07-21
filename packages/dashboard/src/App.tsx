import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Layers,
  Megaphone,
  MessageSquare,
  Monitor,
  Moon,
  OctagonX,
  Settings as SettingsIcon,
  Sun,
  Users,
  Zap,
} from "lucide-react";
import { CampaignsPage } from "./pages/CampaignsPage.js";
import { LeadsPage } from "./pages/LeadsPage.js";
import { LeadDetailPage } from "./pages/LeadDetailPage.js";
import { ActivitiesPage } from "./pages/ActivitiesPage.js";
import { MessagesPage } from "./pages/MessagesPage.js";
import { AnalyticsPage } from "./pages/AnalyticsPage.js";
import { QueuesPage } from "./pages/QueuesPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { api } from "./lib/api.js";
import { applyTheme, getStoredTheme, type ThemePreference } from "./lib/theme.js";

const NAV_ITEMS = [
  { section: "Pipeline", items: [
    { to: "/", end: true, label: "Campaigns", icon: Megaphone },
    { to: "/leads", label: "Leads", icon: Users },
    { to: "/queues", label: "Queues", icon: Layers },
  ] },
  { section: "Operations", items: [
    { to: "/activities", label: "Activities", icon: Activity },
    { to: "/messages", label: "Messages", icon: MessageSquare },
  ] },
  { section: "Insights", items: [
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
  ] },
  { section: "Config", items: [
    { to: "/settings", label: "Settings", icon: SettingsIcon },
  ] },
];

export function App() {
  const [theme, setTheme] = useState<ThemePreference>(getStoredTheme());
  const [killSwitch, setKillSwitch] = useState<boolean | null>(null);
  const [stopping, setStopping] = useState(false);
  const [stopResult, setStopResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      api
        .getSafetyConfig()
        .then((c) => !cancelled && setKillSwitch(c.killSwitch))
        .catch(() => undefined);
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function changeTheme(next: ThemePreference) {
    setTheme(next);
    applyTheme(next);
  }

  async function handleEmergencyStop() {
    if (!confirm("Pause every campaign and engage the kill switch immediately?")) return;
    setStopping(true);
    try {
      const { pausedCampaigns } = await api.pauseAllCampaigns();
      setStopResult(`${pausedCampaigns} campaign(s) paused, kill switch engaged.`);
      setKillSwitch(true);
    } catch (err) {
      setStopResult(err instanceof Error ? err.message : String(err));
    } finally {
      setStopping(false);
    }
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">
          <span className="logo-mark">
            <Zap size={15} strokeWidth={2.5} />
          </span>
          LGX
        </div>

        {NAV_ITEMS.map((group) => (
          <div key={group.section}>
            <div className="nav-section-label">{group.section}</div>
            {group.items.map(({ to, end, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>
                <Icon size={16} strokeWidth={2} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}

        <div className="nav-spacer" />

        <div className="nav-footer">
          <div className="system-status">
            <span className={`status-dot-lg ${killSwitch ? "off" : ""}`} />
            {killSwitch === null ? "Checking…" : killSwitch ? "Kill switch engaged" : "Automation live"}
          </div>

          <div className="theme-toggle">
            Theme
            <div className="theme-toggle-btns">
              <button className={theme === "light" ? "active" : ""} onClick={() => changeTheme("light")} aria-label="Light theme">
                <Sun size={13} />
              </button>
              <button className={theme === "system" ? "active" : ""} onClick={() => changeTheme("system")} aria-label="System theme">
                <Monitor size={13} />
              </button>
              <button className={theme === "dark" ? "active" : ""} onClick={() => changeTheme("dark")} aria-label="Dark theme">
                <Moon size={13} />
              </button>
            </div>
          </div>

          <button className="emergency-btn" disabled={stopping} onClick={() => void handleEmergencyStop()}>
            <OctagonX size={15} />
            Emergency stop
          </button>
          {stopResult && <div className="emergency-note">{stopResult}</div>}
        </div>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<CampaignsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/:leadId" element={<LeadDetailPage />} />
          <Route path="/queues" element={<QueuesPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
