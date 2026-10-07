import { useState } from "react";
import { auth } from "../lib/supabase.js";
import logoIkbi from "../assets/logo-ikbi.svg";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message === "Invalid login credentials" ? "Email or password is incorrect." : error.message);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form onSubmit={submit} className="card" style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="brand" style={{ marginBottom: 6 }}>
          <img src={logoIkbi} alt="IKBi" className="brand-logo" />
          <div className="brand-text">
            <span className="brand-name">IKB Tasks</span>
            <span className="brand-sub">// internal · sign in</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        </div>
        {error && <div className="mono" style={{ fontSize: "0.72rem", color: "var(--fail)" }}>// {error}</div>}
        <button type="submit" className="btn btn-primary" disabled={busy || !email || !password}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
