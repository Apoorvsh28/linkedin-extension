import { useState, type FormEvent } from "react";
import { Zap } from "lucide-react";
import { api, auth } from "../lib/api.js";

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await api.login(email, password);
      auth.setToken(token);
      onSuccess();
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={(e) => void handleSubmit(e)}>
        <div className="nav-brand" style={{ padding: 0, marginBottom: 18 }}>
          <span className="logo-mark">
            <Zap size={15} strokeWidth={2.5} />
          </span>
          LGX
        </div>

        <h1 style={{ fontSize: 17, marginBottom: 4 }}>Sign in</h1>
        <p style={{ margin: "0 0 18px", color: "var(--ink-secondary)", fontSize: 13 }}>
          Admin access to the LGX dashboard.
        </p>

        {error && <div className="error-banner">{error}</div>}

        <label className="form-row">
          Email
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>

        <label className="form-row" style={{ marginTop: 12 }}>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <button className="primary" type="submit" disabled={loading} style={{ marginTop: 20, width: "100%" }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
