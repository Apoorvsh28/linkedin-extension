import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { LoginPage } from "./pages/LoginPage.js";
import { api, auth } from "./lib/api.js";
import { applyTheme, getStoredTheme } from "./lib/theme.js";
import "./style.css";

applyTheme(getStoredTheme()); // before first paint, to avoid a flash of the wrong theme

function AuthGate() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!auth.getToken()) {
      setAuthed(false);
      return;
    }
    api
      .me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return null;
  if (!authed) return <LoginPage onSuccess={() => setAuthed(true)} />;
  return <App onLogout={() => setAuthed(false)} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("dashboard root element missing");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  </React.StrictMode>,
);
