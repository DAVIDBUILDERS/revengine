"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowRight, ArrowUpRight, Calendar, Check, CheckCircle2,
  FileSpreadsheet, FileText, Globe, LockKeyhole, Mail, Plus, ShieldCheck,
} from "lucide-react";
import type { ConnectionCapability } from "@david/contracts";
import { words } from "@david/ui";
import type { ScreenProps } from "./app-shell";
import { Badge, Button, dateTime, Drawer } from "./ui";
import { SourceSetup, supportsResource } from "./source-setup";
import { CompanyConnectionMap } from "./company-connection-map";
import { CompanySystemDetails } from "./company-system-details";
import type { SystemKind } from "@david/domain/company-connections";
import { GoogleConnectionExperience, type GoogleCapability } from "./google-connection-experience";
import "./connections-studio.css";

const capabilities = [
  { id: "sheets", label: "Selected Sheets", description: "The source records your team works from.", Icon: FileSpreadsheet },
  { id: "mail", label: "Gmail send & replies", description: "Approved senders and enrolled conversations.", Icon: Mail },
  { id: "calendar", label: "Owned calendars", description: "Availability and approved booking calendars.", Icon: Calendar },
] as const;

type Handoff = {
  phase: "preparing" | "redirecting" | "error" | "review" | "cancelled" | "expired" | "failed";
  connectionId?: string;
  message?: string;
};
type SourceLaunch = { requestId: number; connectionId: string; resourceType: "sheet" | "calendar" | "mailbox" };
const intentKey = (workspaceId: string) => `david.google-intent.${workspaceId}`;
function forgetIntent(workspaceId: string) {
  try { window.sessionStorage.removeItem(intentKey(workspaceId)); } catch { /* Storage is optional. */ }
}
function savedCapabilities(workspaceId: string): GoogleCapability[] | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(intentKey(workspaceId)) ?? "null");
    if (!value || typeof value.at !== "number" || Date.now() - value.at > 3_600_000 || value.at > Date.now() || !Array.isArray(value.capabilities)) return null;
    const valid = capabilities.map((item) => item.id);
    if (!value.capabilities.length || !value.capabilities.every((item: GoogleCapability) => valid.includes(item))) return null;
    return [...new Set<GoogleCapability>(value.capabilities)];
  } catch { return null; }
}
function clearReturnHint() {
  const url = new URL(window.location.href);
  url.searchParams.delete("google");
  url.searchParams.delete("connection");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

function connectionIcon(connection: ConnectionCapability) {
  if (connection.provider === "website") return Globe;
  if (connection.operations.some((operation) => /calendar|book/.test(operation))) return Calendar;
  if (connection.operations.some((operation) => /gmail|send|reply/.test(operation))) return Mail;
  return FileText;
}

function isStale(connection: ConnectionCapability, asOf: string) {
  return (connection.health === "healthy" || connection.health === "fixture") && !!connection.lastSyncAt && Date.parse(asOf) - Date.parse(connection.lastSyncAt) > connection.freshnessSeconds * 1000;
}

export function ConnectionsStudio({ state, navigate, act, busy }: ScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [scopes, setScopes] = useState<GoogleCapability[]>(["sheets"]);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [sourceLaunch, setSourceLaunch] = useState<SourceLaunch>();
  const [websiteRequest, setWebsiteRequest] = useState(0);
  const [systemKind, setSystemKind] = useState<SystemKind | null>(null);
  const [proposalChoice, setProposalChoice] = useState(false);
  const pendingRequest = useRef<AbortController | null>(null);
  const redirectFrame = useRef<number | null>(null);
  const authorizationUrl = useRef<string | null>(null);
  const connection = state.connections.find((item) => item.id === selected);
  const fixture = state.workspace.mode === "fixture";
  const canConfigure = !fixture && ["workspace_owner", "david_operator"].includes(state.context.role);
  const returnedConnection = state.connections.find((item) => item.id === handoff?.connectionId && item.workspaceId === state.workspace.id && item.provider === "google");
  const readiness = [
    { label: "Integration readiness", short: "Access", value: state.readiness.integration, description: "Accounts, scopes and selected resources." },
    { label: "Action readiness", short: "Authority", value: state.readiness.action, description: "Current rules, facts and operating permission." },
    { label: "Measurement readiness", short: "Evidence", value: state.readiness.measurement, description: "Sources that verify the outcome." },
  ];

  useEffect(() => {
    function resume() {
      if (fixture) return;
      const query = new URLSearchParams(window.location.search);
      const intent = savedCapabilities(state.workspace.id);
      if (intent) setScopes(intent);
      const outcome = query.get("google");
      const matchingWorkspace = !query.get("workspace") || query.get("workspace") === state.workspace.id;
      if (matchingWorkspace && outcome === "review") {
        setHandoff({ phase: "review", connectionId: query.get("connection") ?? undefined });
      } else if (matchingWorkspace && (outcome === "cancelled" || outcome === "expired" || outcome === "failed")) {
        setHandoff({ phase: outcome });
      } else if (intent) {
        setHandoff({ phase: "cancelled", message: "You’re back in DAVID. Review the current account access in Connections, or start a new Google authorization." });
      } else setHandoff(null);
    }
    function resetPending() {
      pendingRequest.current?.abort();
      pendingRequest.current = null;
      authorizationUrl.current = null;
      if (redirectFrame.current !== null) cancelAnimationFrame(redirectFrame.current);
      setConnecting(false);
      resume();
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) resetPending();
    }
    resume();
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", resetPending);
    return () => {
      pendingRequest.current?.abort();
      pendingRequest.current = null;
      if (redirectFrame.current !== null) cancelAnimationFrame(redirectFrame.current);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", resetPending);
    };
  }, [state.workspace.id, fixture]);

  function closeHandoff(restoreFocus = true) {
    pendingRequest.current?.abort();
    pendingRequest.current = null;
    authorizationUrl.current = null;
    if (redirectFrame.current !== null) cancelAnimationFrame(redirectFrame.current);
    setConnecting(false);
    setHandoff(null);
    setSourceLaunch(undefined);
    setWebsiteRequest(0);
    forgetIntent(state.workspace.id);
    clearReturnHint();
    if (restoreFocus) requestAnimationFrame(() => document.getElementById("review-google-authorization")?.focus());
  }

  function chooseResource(resourceType: SourceLaunch["resourceType"]) {
    if (!canConfigure || !returnedConnection || !["healthy", "unconfigured"].includes(returnedConnection.health)) return;
    const connectionId = returnedConnection.id;
    closeHandoff(false);
    setSourceLaunch((current) => ({ requestId: (current?.requestId ?? 0) + 1, connectionId, resourceType }));
  }

  function continueToGoogle() {
    if (authorizationUrl.current) window.location.assign(authorizationUrl.current);
  }

  function openSetup() {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "profile");
    url.searchParams.set("setup", "2");
    window.history.replaceState({}, "", url.pathname + url.search);
    navigate("activation");
  }

  function chooseTeam() {
    const url = new URL(window.location.href);
    url.searchParams.set("team", "build");
    window.history.replaceState({}, "", url.pathname + url.search);
    navigate("team");
  }

  function setupGoogle(resourceType: SourceLaunch["resourceType"]) {
    setProposalChoice(false);
    const account = state.connections.find(item => item.workspaceId === state.workspace.id && item.provider === "google" && ["healthy", "unconfigured"].includes(item.health) && supportsResource(item, resourceType));
    if (account && canConfigure) {
      setSourceLaunch(current => ({ requestId: (current?.requestId ?? 0) + 1, connectionId: account.id, resourceType }));
      return;
    }
    const capability: GoogleCapability = resourceType === "sheet" ? "sheets" : resourceType === "mailbox" ? "mail" : "calendar";
    setScopes(current => [...new Set([...current, capability])]);
    requestAnimationFrame(() => {
      document.getElementById("connect-google-title")?.scrollIntoView({ block: "center", behavior: "smooth" });
      document.getElementById("review-google-authorization")?.focus({ preventScroll: true });
    });
  }

  function setupSystem(kind: SystemKind) {
    if (kind === "website") setWebsiteRequest(current => current + 1);
    else if (kind === "proposals") setProposalChoice(true);
    else if (kind === "mail" || kind === "calendar") setupGoogle(kind === "mail" ? "mailbox" : "calendar");
    else setSystemKind(kind);
  }

  async function connect(requestedCapabilities = scopes) {
    if (!canConfigure || connecting || pendingRequest.current || !requestedCapabilities.length) return;
    const controller = new AbortController();
    pendingRequest.current = controller;
    setSelected(null);
    setSourceLaunch(undefined);
    setWebsiteRequest(0);
    setScopes(requestedCapabilities);
    setConnecting(true);
    setConnectionMessage("");
    setHandoff({ phase: "preparing" });
    clearReturnHint();
    // Only non-secret selection intent survives navigation. Tokens and OAuth URLs do not.
    try { window.sessionStorage.setItem(intentKey(state.workspace.id), JSON.stringify({ capabilities: requestedCapabilities, at: Date.now() })); } catch { /* OAuth does not depend on browser storage. */ }
    try {
      const response = await fetch("/api/google/connect", {
        method: "POST",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: state.workspace.id, capabilities: requestedCapabilities }),
      });
      const result = await response.json();
      if (controller.signal.aborted || pendingRequest.current !== controller) return;
      if (!response.ok) throw new Error(result.message ?? result.error ?? "Google authorization could not start.");
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "accounts.google.com") {
        throw new Error("An unexpected authorization destination was rejected.");
      }
      authorizationUrl.current = url.toString();
      setHandoff({ phase: "redirecting" });
      redirectFrame.current = requestAnimationFrame(() => {
        if (!controller.signal.aborted && pendingRequest.current === controller) continueToGoogle();
      });
    } catch (error) {
      if (controller.signal.aborted || pendingRequest.current !== controller) return;
      setHandoff({ phase: "error", message: error instanceof Error && error.name === "TimeoutError" ? "Google authorization took too long to start. Please try again." : error instanceof Error ? error.message : "Google authorization could not start. Please try again." });
      pendingRequest.current = null;
    } finally {
      if (!controller.signal.aborted) setConnecting(false);
    }
  }

  if (handoff) return <GoogleConnectionExperience
    phase={handoff.phase}
    capabilities={scopes}
    connection={returnedConnection}
    message={handoff.message}
    onClose={() => closeHandoff()}
    onRetry={(capability) => void connect(capability ? [...new Set([...scopes, capability])] : scopes)}
    onContinue={handoff.phase === "redirecting" ? continueToGoogle : undefined}
    onChooseResource={chooseResource}
    busy={connecting}
    canConfigure={canConfigure}
  />;

  async function disconnect() {
    if (!canConfigure || !connection || connecting) return;
    setConnecting(true);
    setConnectionMessage("");
    try {
      const response = await fetch("/api/google/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: state.workspace.id, connectionId: connection.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? result.error ?? "Connection could not be disconnected.");
      setConnectionMessage(result.message ?? "Connection disconnected. Further access is stopped. The workspace refreshes automatically.");
    } catch (error) {
      setConnectionMessage(error instanceof Error ? error.message : "Disconnect failed.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="connections-studio">
      <header className="studio-heading">
        <div>
          <span className="studio-kicker">DAVID / YOUR SYSTEMS</span>
          <h1>Connections<span aria-hidden="true">.</span></h1>
          <p>{state.workspace.name} · A clear view of what your team can access.</p>
        </div>
        <Button onClick={chooseTeam}>Choose your team <ArrowUpRight size={15} /></Button>
      </header>

      <CompanyConnectionMap state={state} onSetup={setupSystem} onChooseTeam={chooseTeam} onManageSystem={setSystemKind} />

      <section className="connections-readiness" aria-label="Independent readiness checks">
        {readiness.map((item, index) => (
          <div key={item.label} className="connections-readiness-item">
            <span className="connections-step">0{index + 1}</span>
            <div><h2>{item.short}</h2><p>{item.description}</p></div>
            <span className={`connections-check ${item.value ? "is-verified" : ""}`} aria-label={`${item.label}: ${item.value ? "verified" : "blocked"}`}>
              {item.value ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{item.value ? "Verified" : "Needs review"}
            </span>
          </div>
        ))}
      </section>

      <section className="connections-accounts" aria-labelledby="bound-sources-title">
        <div className="connections-section-heading"><div><span className="studio-kicker">ACCOUNTS & RESOURCES</span><h2 id="bound-sources-title">Your source network</h2></div><span>Last checked {dateTime(state.readiness.evaluatedAt)}</span></div>
        {state.connections.length ? <div className="connections-account-grid">
          {state.connections.map((item) => {
            const Icon = connectionIcon(item);
            const stale = isStale(item, state.asOf);
            return <article className="connections-account" key={item.id}>
              <div className="connections-account-top"><span className="connections-provider-icon"><Icon size={21} /></span><Badge status={stale ? "stale" : item.health} /></div>
              <p className="studio-kicker">{words(item.provider)} / SOURCE</p>
              <h3>{item.identity}</h3><p className="connections-resource">{item.resource}</p>
              <div className="connections-operation-list">{item.operations.map((operation) => <span key={operation}>{words(operation)}</span>)}</div>
              <div className="connections-account-bottom"><div><span>Source owner</span><strong>{item.owner || "Not assigned"}</strong></div><Button className="btn-small" onClick={() => { setSelected(item.id); setConnectionMessage(""); }}>Inspect <ArrowUpRight size={13} /></Button></div>
              <p className="connections-sync">Last sync {dateTime(item.lastSyncAt)} · {Math.round(item.freshnessSeconds / 60)} min freshness limit</p>
            </article>;
          })}
        </div> : <div className="connections-empty"><span className="connections-empty-icon"><Plus size={26} /></span><div><h3>No bound connections yet</h3><p>Connect your company’s accounts, then choose their approved resources. These sources stay with the company when you change specialists.</p></div></div>}
      </section>

      <section className="connections-compose" aria-labelledby="connect-google-title">
        <div className="connections-compose-intro"><span className="studio-kicker">ADD A CONNECTION</span><h2 id="connect-google-title">Google Workspace</h2><p>Authorize the capabilities your company uses once, then reuse them across your team. Choose the exact resources after returning from Google.</p><span className="connections-provider-label"><ShieldCheck size={15} /> Permission reviewed with Google</span></div>
        <div className="connections-compose-controls">
          <Button className="btn-small" disabled={!canConfigure || connecting} onClick={() => setScopes(["sheets", "mail", "calendar"])}>Select all company capabilities</Button>
          <fieldset className="connections-capabilities"><legend>Choose capabilities</legend>
            {capabilities.map(({ id, label, description, Icon }) => <label className={`connections-capability ${scopes.includes(id) ? "is-selected" : ""}`} key={id}>
              <input type="checkbox" checked={scopes.includes(id)} disabled={!canConfigure || connecting} onChange={(event) => setScopes((current) => event.target.checked ? [...current, id] : current.filter((item) => item !== id))} />
              <span className="connections-capability-check" aria-hidden="true">{scopes.includes(id) ? <Check size={12} /> : <Plus size={12} />}</span><Icon size={22} /><strong>{label}</strong><span>{description}</span>
            </label>)}
          </fieldset>
          <p className="connections-consent-note"><LockKeyhole size={15} /><span>{fixture ? "Google authorization is disabled in fixture mode. Configure a hosted nonproduction project and authenticated operator before connecting a real account." : !canConfigure ? "A workspace owner or assigned DAVID operator must authorize connections. You can still inspect the access granted to this workspace." : "Sheets uses drive.file for selected files; Calendar supports owned calendars. Gmail reply reading requests mailbox-wide restricted access, even though DAVID processes only enrolled conversations. Review the actual Google consent grant."}</span></p>
          <Button id="review-google-authorization" variant="primary" disabled={!canConfigure || connecting || !scopes.length} onClick={() => void connect()}>{connecting ? "Starting authorization…" : "Review Google authorization"}<ArrowRight size={15} /></Button>
          {connectionMessage && !connection && <p className="notice" role="status">{connectionMessage}</p>}
        </div>
      </section>

      <div className="connections-source-setup"><SourceSetup state={state} launch={sourceLaunch} websiteRequest={websiteRequest} /></div>

      <section className="connections-next" aria-labelledby="connection-next-title">
        <div className="connections-section-heading"><div><span className="studio-kicker">THE NEXT CONNECTION</span><h2 id="connection-next-title">What needs attention</h2></div><span>{state.readiness.blockers.length} open requirement{state.readiness.blockers.length === 1 ? "" : "s"}</span></div>
        {state.readiness.blockers.length ? <div className="connections-blockers">{state.readiness.blockers.map((blocker, index) => <details key={`${blocker.code}:${index}`} className="connections-blocker"><summary><span className="connections-step">{(index + 1).toString().padStart(2, "0")}</span><strong>{blocker.message}</strong><span>{words(blocker.dimension)}</span><Plus size={15} /></summary><div><p>{blocker.nextStep}</p><span>Accountable owner: {blocker.owner}</span></div></details>)}</div> : <div className="connections-clear"><CheckCircle2 size={20} /><p>No current blockers. Each action checks its own readiness again immediately before dispatch.</p></div>}
      </section>

      {systemKind && <CompanySystemDetails key={`${state.workspace.id}:${systemKind}`} state={state} act={act} busy={busy} kind={systemKind} onClose={() => setSystemKind(null)} />}
      <Drawer open={proposalChoice} onClose={() => setProposalChoice(false)} title="Your company’s proposal records" description="Choose the source you use. Its records stay in this workspace when you change specialists.">
        <div className="stack company-system-details">
          <div className="company-system-inventory-note"><span className="studio-kicker">CONNECTED SOURCE</span><h3>Google Sheets</h3><p>Authorize the account, select a Sheet and range, then verify the current records.</p><Button variant="primary" onClick={() => setupGoogle("sheet")}>Set up Google Sheets <ArrowRight size={15} /></Button></div>
          <div className="company-system-inventory-note"><span className="studio-kicker">FILE IMPORT</span><h3>CSV export</h3><p>Import a validated proposal export. An upload is a saved snapshot; it does not establish ongoing account access.</p><Button onClick={() => { setProposalChoice(false); const url = new URL(window.location.href); url.searchParams.set("import", "csv"); window.history.replaceState({}, "", url.pathname + url.search); navigate("opportunities"); }}>Import proposal CSV <ArrowRight size={15} /></Button></div>
        </div>
      </Drawer>

      <Drawer open={!!connection} onClose={() => setSelected(null)} title={connection?.identity ?? "Connection"} description="A successful sign-in does not automatically grant Gmail, Sheets or Calendar integration permissions.">
        {connection && <div className="stack connections-inspector">
          <div className="connections-inspector-status"><span className="studio-kicker">CURRENT ACCESS</span><Badge status={isStale(connection, state.asOf) ? "stale" : connection.health} /></div>
          <dl className="connections-facts"><dt>Provider</dt><dd>{connection.provider}</dd><dt>Resource</dt><dd>{connection.resource}</dd><dt>Source owner</dt><dd>{connection.owner}</dd><dt>Last verified</dt><dd>{dateTime(connection.verifiedAt)}</dd><dt>Last sync</dt><dd>{dateTime(connection.lastSyncAt)}</dd></dl>
          <div><h3>Permitted operations</h3><div className="connections-operation-list">{connection.operations.map((operation) => <span key={operation}>{operation}</span>)}</div></div>
          <div><h3>Granted scopes</h3><div className="connections-granted-scopes">{connection.scopes.length ? connection.scopes.map((scope) => <p key={scope}>{scope}</p>) : "No verified provider scopes."}</div></div>
          <div className="notice notice-warning"><AlertCircle size={18} /><p>{fixture ? "This is a synthetic connection. To enable real Google access, an authorized operator must configure the OAuth client, consent audience, resource bindings and Vault token lifecycle in a hosted nonproduction project." : "Connection setup requires an authorized operator to verify the OAuth client, consent audience, selected resources and required scopes. Revoked or expired access blocks affected actions until reauthorized."}</p></div>
          {!fixture && connection.provider === "google" && <div className="stack-small"><p className="small muted">Reauthorization requests: {scopes.map((scope) => capabilities.find((item) => item.id === scope)?.label).join(", ") || "Choose at least one capability on the connections page"}.</p><Button disabled={!canConfigure || connecting || !scopes.length} onClick={() => void connect()}>Reauthorize selected capabilities</Button><Button variant="danger" disabled={!canConfigure || connecting || connection.health === "revoked"} onClick={() => void disconnect()}>Disconnect this account</Button></div>}
          {connectionMessage && <p className="notice" role="status">{connectionMessage}</p>}
          <details className="connections-setup-details"><summary>Exact setup needed</summary><ol><li>Confirm the Google organization, approved sender, Sheet file/tab/range and calendar with their source owners.</li><li>Configure the dedicated integration OAuth client and approved callback, with Gmail send/read and precise Sheet/Calendar scopes.</li><li>Store connection credentials through the server-side Vault lifecycle and bind only the selected resources.</li><li>Verify fresh reads, reply synchronization and checked test actions with authorized recipients and calendar.</li><li>Record the live cohort, exception operator, working hours and release review.</li></ol></details>
          <Button onClick={() => { setSelected(null); openSetup(); }}>Open company profile <ArrowRight size={14} /></Button>
        </div>}
      </Drawer>
    </div>
  );
}
