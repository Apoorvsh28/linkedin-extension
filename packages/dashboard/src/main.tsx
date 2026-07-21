import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { applyTheme, getStoredTheme } from "./lib/theme.js";
import "./style.css";

applyTheme(getStoredTheme()); // before first paint, to avoid a flash of the wrong theme

const root = document.getElementById("root");
if (!root) throw new Error("dashboard root element missing");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
