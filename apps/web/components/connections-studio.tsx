"use client";

import { useState } from "react";
import {
  AlertCircle, ArrowRight, ArrowUpRight, Calendar, Check, CheckCircle2,
  FileSpreadsheet, FileText, Globe, LockKeyhole, Mail, Plus, ShieldCheck,
} from "lucide-react";
import type { ConnectionCapability } from "@david/contracts";
import { words } from "@david/ui";
import type { ScreenProps } from "./app-shell";
import { Badge, Button, dateTime, Drawer } from "./ui";
import { SourceSetup } from "./source-setup";
import "./connections-studio.css";

const capabilities = [
  { id: "sheets", label: "Selected Sheets", description: "The source records your team works from.", Icon: FileSpreadsheet },
  { id: "mail", label: "Gmail send & replies", description: "Approved senders and enrolled conversations.", Icon: Mail },
  { id: "calendar", label: "Owned calendars", description: "Availability and approved booking calendars.", Icon: Calendar },
] as const;

function connectionIcon(connection: ConnectionCapability) {
  if (connection.provider === "website") return Globe;
  if (connection.operations.some((operation) => /calendar|book/.test(operation))) return Calendar;
  if (connection.operations.some((operation) => /gmail|send|reply/.test(operation))) return Mail;
  return FileText;
}

function isStale(connection: ConnectionCapability, asOf: string) {
  return (connection.health === "healthy" || connection.health === "fixture") && !!connection.lastSyncAt && Date.parse(asOf) - Date.parse(connection.lastSyncAt) > connection.freshnessSeconds * 1000;
}

export function ConnectionsStudio({ state, navigate }: ScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [scopes, setScopes] = useState<Array<"sheets" | "mail" | "calendar">>(["sheets"]);
  const connection = state.connections.find((item) => item.id === selected);
  const fixture = state.workspace.mode === "fixture";
  const canConfigure = !fixture && ["workspace_owner", "david_operator"].includes(state.context.role);
  const healthy = state.connections.filter((item) => item.health === "healthy" && !isStale(item, state.asOf)).length;
  const sourceOwners = new Set(state.connections.map((item) => item.owner).filter(Boolean)).size;
  const readiness = [
    { label: "Integration readiness", short: "Access", value: state.readiness.integration, description: "Accounts, scopes and selected resources." },
    { label: "Action readiness", short: "Authority", value: state.readiness.action, description: "Current rules, facts and operating permission." },
    { label: "Measurement readiness", short: "Evidence", value: state.readiness.measurement, description: "Sources that verify the outcome." },
  ];

  function openSetup() {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "profile");
    url.searchParams.set("setup", "2");
    window.history.replaceState({}, "", url.pathname + url.search);
    navigate("activation");
  }

  async function connect() {
    if (!canConfigure || connecting || !scopes.length) return;
    setConnecting(true);
    setConnectionMessage("");
    try {
      const response = await fetch("/api/google/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: state.workspace.id, capabilities: scopes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? result.error ?? "Google authorization could not start.");
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "accounts.google.com") {
        throw new Error("An unexpected authorization destination was rejected.");
      }
      window.location.assign(url.toString());
    } catch (error) {
      setConnectionMessage(error instanceof Error ? error.message : "Connection failed.");
    } finally {
      setConnecting(false);
    }
  }

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
        <Button onClick={openSetup}>Review source requirements <ArrowUpRight size={15} /></Button>
      </header>

      <section className="connections-network" aria-label="Workspace connection overview">
        <div className="connections-network-copy">
          <span className="studio-kicker">YOUR WORKSPACE, CONNECTED</span>
          <h2>Good work starts<br />at the source.</h2>
          <p>Choose the accounts. Define the access.<br />Keep every permission in view.</p>
          {fixture && <span className="connections-demo-label">Synthetic workspace · example connections</span>}
        </div>
        <div className="connections-map" aria-label={`${state.connections.length} bound sources, ${healthy} healthy sources, ${sourceOwners} source owners`}>
          <div className="connections-map-core"><span aria-hidden="true">D</span><strong>Your team</strong><small>Approved access only</small></div>
          <div className="connections-map-nodes">
            <div><span><FileText size={16} /> Bound sources</span><strong>{state.connections.length.toString().padStart(2, "0")}</strong></div>
            <div><span><ShieldCheck size={16} /> Healthy sources</span><strong>{healthy.toString().padStart(2, "0")}</strong></div>
            <div><span><LockKeyhole size={16} /> Source owners</span><strong>{sourceOwners.toString().padStart(2, "0")}</strong></div>
          </div>
        </div>
      </section>

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
        </div> : <div className="connections-empty"><span className="connections-empty-icon"><Plus size={26} /></span><div><h3>No bound connections yet</h3><p>Start with the system your first specialist needs. Connect an account below, then choose its approved resources.</p></div></div>}
      </section>

      <section className="connections-compose" aria-labelledby="connect-google-title">
        <div className="connections-compose-intro"><span className="studio-kicker">ADD A CONNECTION</span><h2 id="connect-google-title">Google Workspace</h2><p>Choose only the capabilities your team needs. Signing in to DAVID is separate from authorizing access to these systems.</p><span className="connections-provider-label"><ShieldCheck size={15} /> Permission reviewed with Google</span></div>
        <div className="connections-compose-controls">
          <fieldset className="connections-capabilities"><legend>Choose capabilities</legend>
            {capabilities.map(({ id, label, description, Icon }) => <label className={`connections-capability ${scopes.includes(id) ? "is-selected" : ""}`} key={id}>
              <input type="checkbox" checked={scopes.includes(id)} disabled={!canConfigure || connecting} onChange={(event) => setScopes((current) => event.target.checked ? [...current, id] : current.filter((item) => item !== id))} />
              <span className="connections-capability-check" aria-hidden="true">{scopes.includes(id) ? <Check size={12} /> : <Plus size={12} />}</span><Icon size={22} /><strong>{label}</strong><span>{description}</span>
            </label>)}
          </fieldset>
          <p className="connections-consent-note"><LockKeyhole size={15} /><span>{fixture ? "Google authorization is disabled in fixture mode. Configure a hosted nonproduction project and authenticated operator before connecting a real account." : !canConfigure ? "A workspace owner or assigned DAVID operator must authorize connections. You can still inspect the access granted to this workspace." : "Sheets uses drive.file for selected files; Calendar supports owned calendars. Gmail reply reading requests mailbox-wide restricted access, even though DAVID processes only enrolled conversations. Review the actual Google consent grant."}</span></p>
          <Button variant="primary" disabled={!canConfigure || connecting || !scopes.length} onClick={() => void connect()}>{connecting ? "Starting authorization…" : "Review Google authorization"}<ArrowRight size={15} /></Button>
          {connectionMessage && !connection && <p className="notice" role="status">{connectionMessage}</p>}
        </div>
      </section>

      <div className="connections-source-setup"><SourceSetup state={state} /></div>

      <section className="connections-next" aria-labelledby="connection-next-title">
        <div className="connections-section-heading"><div><span className="studio-kicker">THE NEXT CONNECTION</span><h2 id="connection-next-title">What needs attention</h2></div><span>{state.readiness.blockers.length} open requirement{state.readiness.blockers.length === 1 ? "" : "s"}</span></div>
        {state.readiness.blockers.length ? <div className="connections-blockers">{state.readiness.blockers.map((blocker, index) => <details key={`${blocker.code}:${index}`} className="connections-blocker"><summary><span className="connections-step">{(index + 1).toString().padStart(2, "0")}</span><strong>{blocker.message}</strong><span>{words(blocker.dimension)}</span><Plus size={15} /></summary><div><p>{blocker.nextStep}</p><span>Accountable owner: {blocker.owner}</span></div></details>)}</div> : <div className="connections-clear"><CheckCircle2 size={20} /><p>No current blockers. Each action checks its own readiness again immediately before dispatch.</p></div>}
      </section>

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
          <Button onClick={() => { setSelected(null); openSetup(); }}>Open activation prerequisites <ArrowRight size={14} /></Button>
        </div>}
      </Drawer>
    </div>
  );
}
