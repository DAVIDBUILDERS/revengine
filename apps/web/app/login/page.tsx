"use client";
import { useState, type FormEvent } from "react";
export default function Login() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [factor, setFactor] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await fetch(
        factor ? "/api/auth/verify-mfa" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            factor
              ? { factorId: factor, code: data.get("code") }
              : { email: data.get("email"), password: data.get("password") },
          ),
        },
      );
      const body = await result.json();
      if (!result.ok) throw new Error(body.message);
      if (!factor) {
        const factors = await fetch("/api/auth/factors");
        const list = await factors.json();
        if (list.factorId) {
          setFactor(list.factorId);
          setMessage("Enter the current code from your authenticator.");
          return;
        }
      }
      window.location.assign("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <a href="/" aria-label="David Engine home">
        <span className="brand-wordmark" role="img" aria-label="David Engine" />
      </a>
      <h1>Welcome back.</h1>
      <p>Sign in with your invited workspace account.</p>
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        {factor ? (
          <label className="field">
            Authenticator code
            <input
              className="input"
              name="code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
            />
          </label>
        ) : (
          <>
            <label className="field">
              Email address
              <input
                className="input"
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label className="field">
              Password
              <input
                className="input"
                name="password"
                type="password"
                minLength={8}
                autoComplete="current-password"
                required
              />
            </label>
          </>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Verifying…" : factor ? "Verify identity" : "Sign in"}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
      <p style={{ fontSize: 14, marginTop: 24 }}>
        Access is by invitation. Contact your workspace owner for account or
        authenticator recovery.
      </p>
    </main>
  );
}
