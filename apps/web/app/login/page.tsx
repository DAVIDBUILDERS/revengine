"use client";
import { useState, type FormEvent } from "react";
export default function Login() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login'|'register'|'recover'>('login');
  const [factor, setFactor] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await fetch(
        factor ? "/api/auth/verify-mfa" : mode === "login" ? "/api/auth/login" : "/api/onboarding/access",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            factor
              ? { factorId: factor, code: data.get("code") }
              : mode === "login" ? { email: data.get("email"), password: data.get("password") } : mode === "recover" ? {type:"recover",email:data.get("email")} : {type:"register",email:data.get("email"),password:data.get("password")},
          ),
        },
      );
      const body = await result.json();
      if (!result.ok) throw new Error(body.message);
      if (mode !== "login") { setMessage(body.message); return; }
      if (!factor) {
        const factors = await fetch("/api/auth/factors");
        const list = await factors.json();
        if (!factors.ok) throw new Error(list.message ?? "Could not verify account access. Try again.");
        if (list.factorId) {
          setFactor(list.factorId);
          setMessage("Enter the current code from your authenticator.");
          return;
        }
      }
      if (sessionStorage.getItem("david.pendingInvitation")) {
        window.location.assign("/join");
        return;
      }
      const assignments = await fetch("/api/workspaces", {cache:"no-store",credentials:"same-origin"});
      const access = await assignments.json();
      if (!assignments.ok) throw new Error(access.message ?? "Could not load your workspaces. Try again.");
      if (!Array.isArray(access.workspaces) || !access.workspaces.every((item: {id?: unknown} | null) => item && typeof item.id === "string"))
        throw new Error("Could not validate your workspaces. Try again.");
      if (access.requiresOperatorMfa) throw new Error("Complete multi-factor authentication to access your operator workspace.");
      window.location.assign(access.workspaces.length
        ? `/?workspace=${encodeURIComponent(access.workspaces.find((w:{id:string})=>w.id===sessionStorage.getItem("david.resumeWorkspace"))?.id??access.workspaces[0].id)}`
        : "/start");
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
      <p>{mode === "login" ? "Sign in to your workspace." : mode === "register" ? "Create an account, then confirm your email before setting up or joining a workspace." : "Request a password recovery email."}</p>
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
            {mode !== "recover" && <label className="field">
              Password
              <input
                className="input"
                name="password"
                type="password"
                minLength={mode === "register" ? 12 : 8}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
              />
            </label>}
          </>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Verifying…" : factor ? "Verify identity" : mode === "register" ? "Create account" : mode === "recover" ? "Send recovery email" : "Sign in"}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
      {!factor && <div className="flex wrap" style={{marginTop:24}}>{(['login','register','recover'] as const).filter(item=>item!==mode).map(item=><button className="link-button" key={item} onClick={()=>{setMode(item);setMessage('');}}>{item==='login'?'Sign in':item==='register'?'Create an account':'Forgot password?'}</button>)}</div>}
      <p><a href="/start">Set up a new company</a></p>
    </main>
  );
}
