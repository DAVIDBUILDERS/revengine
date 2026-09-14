"use client";

import { useEffect, useRef, useState } from "react";
import type { AppSnapshot, ConnectionCapability, EvidenceRef } from "@david/contracts";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Calendar,
  FileSpreadsheet,
  Mail,
  FileText,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Drawer, Evidence, dateTime } from "./ui";
import "./source-setup.css";

type Capture = {
  id: string;
  sourceHash: string;
  limitations?: string[];
  context: {
    pages: {
      url: string;
      title: string;
      description: string;
      text: string;
      capturedAt: string;
    }[];
    evidence: EvidenceRef[];
  };
};
const sourceColumns = [
  "proposal_id",
  "opportunity_id",
  "contact_id",
  "contact_name",
  "email",
  "account",
  "status",
  "owner",
  "version",
  "reference",
  "issued_at",
  "valid_until",
  "amount_minor",
  "currency",
  "value_kind",
  "scope_summary",
  "source_verified_at",
];
const lines = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

type ResourceType = "sheet" | "calendar" | "mailbox";
export type SourceSetupLaunch = { requestId: number; connectionId: string; resourceType: ResourceType };
const resourceOptions = [
  { type: "sheet", label: "Google Sheet", detail: "Proposal source records", Icon: FileSpreadsheet },
  { type: "calendar", label: "Calendar", detail: "Owned booking calendar", Icon: Calendar },
  { type: "mailbox", label: "Gmail", detail: "Sender and reply mailbox", Icon: Mail },
] as const;
const defaultMapping = () => JSON.stringify({ columns: Object.fromEntries(sourceColumns.map(column => [column, column])) }, null, 2);
function supportsResource(connection: ConnectionCapability | undefined, type: ResourceType) {
  if (!connection) return false;
  const hasScope = (...scopes: string[]) => scopes.some(scope => connection.scopes.includes(`https://www.googleapis.com/auth/${scope}`));
  if (type === "sheet") return connection.operations.includes("sheets.read") && hasScope("drive.file", "spreadsheets.readonly", "spreadsheets");
  if (type === "calendar") return connection.operations.includes("calendar.freebusy") && connection.operations.includes("calendar.book") && hasScope("calendar.freebusy", "calendar.events.freebusy") && hasScope("calendar.events.owned", "calendar.events");
  return connection.operations.includes("gmail.read") && connection.operations.includes("gmail.send") && hasScope("gmail.readonly") && hasScope("gmail.send");
}
function usableGoogle(connection: ConnectionCapability, workspaceId: string) {
  return connection.workspaceId === workspaceId && connection.provider === "google" && (connection.health === "healthy" || connection.health === "unconfigured");
}

export function SourceSetup({ state, launch }: { state: AppSnapshot; launch?: SourceSetupLaunch }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"website" | "google">("website");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [url, setUrl] = useState(state.onboarding?.answers.company.website ?? "");
  const [capture, setCapture] = useState<Capture | null>(null);
  const [name, setName] = useState(state.onboarding?.answers.company.name ?? "");
  const [offers, setOffers] = useState(state.onboarding?.answers.company.offers.join("\n") ?? "");
  const [customers, setCustomers] = useState(state.onboarding?.answers.company.customers.join("\n") ?? "");
  const [locations, setLocations] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [connectionId, setConnectionId] = useState(
    state.connections.find(
      (item) => usableGoogle(item, state.workspace.id),
    )?.id ?? "",
  );
  const [resourceType, setResourceType] = useState<
    "sheet" | "calendar" | "mailbox"
  >("sheet");
  const [resourceId, setResourceId] = useState("");
  const [range, setRange] = useState("");
  const [owner, setOwner] = useState("");
  const [mapping, setMapping] = useState(defaultMapping);
  const handledLaunch = useRef<number | null>(null);
  const sessionKey = `${state.workspace.id}:${state.context.actorId}`;
  const activeSession = useRef(sessionKey);
  const requestVersion = useRef(0);
  const fixture = state.workspace.mode === "fixture";
  const authorized =
    !fixture &&
    ["workspace_owner", "david_operator"].includes(state.context.role) && state.context.workspaceId === state.workspace.id;
  const unavailable = fixture
    ? "Real source setup is unavailable in fixture mode. Bounded preparation uses the approved synthetic source already supplied. No website is fetched and no Google resource is bound."
    : !authorized
      ? "A workspace owner or assigned DAVID operator must approve sources and confirm company facts."
      : "";
  const googleAccounts = state.connections.filter(item => item.provider === "google" && item.workspaceId === state.workspace.id);
  const selectedAccount = googleAccounts.find(item => item.id === connectionId);
  const accountUsable = !!selectedAccount && usableGoogle(selectedAccount, state.workspace.id);
  const grantSupported = accountUsable && supportsResource(selectedAccount, resourceType);
  const bindingAllowed = authorized && grantSupported;
  const bindingMessage = !connectionId
    ? "Choose an authorized Google account to select a resource."
    : !selectedAccount
      ? "This Google account is not available in the current workspace. Choose an account from this workspace."
      : !accountUsable
        ? `This connection is ${selectedAccount.health}. Reconnect the account before saving a source.`
        : !grantSupported
          ? `Google access for this resource was not granted. Reconnect this account with ${resourceType === "sheet" ? "Sheets access" : resourceType === "calendar" ? "calendar availability and owned events access" : "Gmail send and reply access"}, or choose a resource covered by its current permissions.`
          : "";
  function clearResource() {
    requestVersion.current += 1;
    setBusy(false);
    setResourceId(""); setRange(""); setOwner(""); setMapping(defaultMapping()); setFeedback(null);
  }
  function chooseAccount(id: string) {
    clearResource();
    setConnectionId(id);
  }
  function chooseResource(type: ResourceType) {
    clearResource();
    setResourceType(type);
  }
  useEffect(() => {
    if (activeSession.current === sessionKey) return;
    activeSession.current = sessionKey;
    handledLaunch.current = launch?.requestId ?? null;
    requestVersion.current += 1;
    setBusy(false); setOpen(false); setView("website"); setFeedback(null);
    setConnectionId(""); setResourceId(""); setRange(""); setOwner(""); setMapping(defaultMapping());
    setCapture(null); setReviewed(false); setConfirmed(false); setLocations("");
    setUrl(state.onboarding?.answers.company.website ?? "");
    setName(state.onboarding?.answers.company.name ?? "");
    setOffers(state.onboarding?.answers.company.offers.join("\n") ?? "");
    setCustomers(state.onboarding?.answers.company.customers.join("\n") ?? "");
  }, [sessionKey, launch?.requestId, state.onboarding]);
  useEffect(() => {
    if (!launch || handledLaunch.current === launch.requestId) return;
    handledLaunch.current = launch.requestId;
    requestVersion.current += 1;
    setBusy(false); setFeedback(null); setResourceId(""); setRange(""); setOwner(""); setMapping(defaultMapping());
    const account = state.connections.find(item => item.id === launch.connectionId && usableGoogle(item, state.workspace.id));
    if (!authorized || !account) {
      setConnectionId("");
      setFeedback({ text: !authorized ? unavailable : "The requested Google account is unavailable or needs to be reconnected. Choose a current account from this workspace.", error: true });
      return;
    }
    setConnectionId(account.id); setResourceType(launch.resourceType); setView("google"); setOpen(true);
  }, [launch, authorized, unavailable, state.connections, state.workspace.id]);
  useEffect(() => {
    if (authorized && grantSupported) return;
    requestVersion.current += 1;
    setBusy(false); setResourceId(""); setRange(""); setOwner(""); setFeedback(current => current?.error ? current : null);
  }, [authorized, grantSupported]);
  async function post(path: string, body: Record<string, unknown>) {
    if (!authorized) return null;
    const version = ++requestVersion.current;
    const workspaceSession = activeSession.current;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: state.workspace.id, ...body }),
      });
      const result = await response.json();
      if (version !== requestVersion.current || workspaceSession !== activeSession.current) return null;
      if (!response.ok)
        throw new Error(
          result.message ?? result.error ?? "Source setup could not be saved.",
        );
      setFeedback({
        text:
          result.message ??
          "Source setup saved. Review current readiness before execution.",
        error: false,
      });
      return result;
    } catch (error) {
      if (version !== requestVersion.current || workspaceSession !== activeSession.current) return null;
      setFeedback({
        text:
          error instanceof Error
            ? error.message
            : "Source setup failed. Review access and retry.",
        error: true,
      });
      return null;
    } finally {
      if (version === requestVersion.current && workspaceSession === activeSession.current) setBusy(false);
    }
  }
  async function captureWebsite(event: React.FormEvent) {
    event.preventDefault();
    const result = await post("/api/context/capture", { url });
    if (result?.capture) {
      setCapture(result.capture);
      setReviewed(false);
      setConfirmed(false);
    }
  }
  async function confirmFacts(event: React.FormEvent) {
    event.preventDefault();
    if (!capture || !reviewed) return;
    const result = await post("/api/context/confirm", {
      contextId: capture.id,
      sourceHash: capture.sourceHash,
      companyName: name.trim(),
      offers: lines(offers),
      customerTypes: lines(customers),
      locations: lines(locations),
    });
    if (result) setConfirmed(true);
  }
  async function bindResource(event: React.FormEvent) {
    event.preventDefault();
    if (!bindingAllowed || busy) { setFeedback({ text: unavailable || bindingMessage || "Review this account’s permissions before saving a resource.", error: true }); return; }
    let parsed: Record<string, unknown> = {};
    if (resourceType === "sheet") {
      try {
        const candidate = JSON.parse(mapping);
        if (
          !candidate ||
          typeof candidate !== "object" ||
          Array.isArray(candidate)
        )
          throw new Error();
        parsed = candidate;
      } catch {
        setFeedback({
          text: "Column mapping must be a JSON object. Review the normalized field names and matching source headers.",
          error: true,
        });
        return;
      }
    }
    await post("/api/google/bind", {
      connectionId,
      resourceType,
      resourceId: resourceId.trim(),
      range: resourceType === "sheet" ? range.trim() || null : null,
      owner: owner.trim(),
      mapping: parsed,
    });
  }
  return (
    <section className="card card-body">
      <div className="between">
        <div>
          <h2 style={{ fontSize: 17 }}>Set up approved sources</h2>
          <p className="small muted" style={{ marginTop: 8 }}>
            Capture a public website and confirm company facts, or bind an
            authorized Sheet, calendar or mailbox to its source owner.
          </p>
        </div>
        <Button
          onClick={() => {
            setOpen(true);
            setFeedback(null);
          }}
        >
          <FileText size={14} />
          Open source setup
          <ArrowRight size={13} />
        </Button>
      </div>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Approved source setup"
        description="Source content supplies evidence, never instructions or permission. A saved binding queues verification; it cannot enable a sender or grant Google access."
      >
        <div className="stack source-setup-workspace">
          <div className="pill-tabs" aria-label="Source setup type">
            <button
              aria-pressed={view === "website"}
              onClick={() => {
                setView("website");
                setFeedback(null);
              }}
            >
              Website & company facts
            </button>
            <button
              aria-pressed={view === "google"}
              onClick={() => {
                setView("google");
                setFeedback(null);
              }}
            >
              Google resources
            </button>
          </div>
          {unavailable && (
            <div className="notice notice-warning">
              <ShieldCheck size={18} />
              <p>{unavailable}</p>
            </div>
          )}
          {feedback && (
            <div
              className={`notice ${feedback.error ? "notice-danger" : ""}`}
              role={feedback.error ? "alert" : "status"}
            >
              <AlertCircle size={18} />
              <p>{feedback.text}</p>
            </div>
          )}
          {view === "website" ? (
            <>
              <form className="stack-small" onSubmit={captureWebsite}>
                <div className="flex">
                  <Globe size={18} />
                  <h3 style={{ fontSize: 16 }}>
                    Capture an approved public page
                  </h3>
                </div>
                <label className="field">
                  Approved website URL
                  <input
                    className="input"
                    type="url"
                    required
                    value={url}
                    disabled={!authorized || busy}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://your-company.example/"
                  />
                </label>
                <p className="help">
                  Only bounded public-web retrieval is allowed. Private
                  addresses, unsafe redirects and oversized sources are
                  rejected; workspace and application quotas apply. Captured
                  pages remain untrusted until facts are reviewed.
                </p>
                <Button
                  type="submit"
                  disabled={!authorized || busy || !url.trim()}
                >
                  {busy ? "Capturing source…" : "Capture approved website"}
                  <ArrowRight size={13} />
                </Button>
              </form>
              {capture && (
                <section className="stack-small">
                  <div className="between">
                    <h3 style={{ fontSize: 16 }}>Review captured source</h3>
                    <Badge tone="warning">Untrusted source content</Badge>
                  </div>
                  {capture.context.pages.map((page, index) => (
                    <details
                      className="card card-body"
                      key={`${page.url}:${index}`}
                    >
                      <summary
                        style={{
                          cursor: "pointer",
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        {page.title || page.url}
                      </summary>
                      <p className="help" style={{ marginTop: 10 }}>
                        {page.url}
                        <br />
                        Captured {dateTime(page.capturedAt)}
                      </p>
                      <p className="prose" style={{ marginTop: 12 }}>
                        {page.text.slice(0, 4000)}
                      </p>
                      {page.text.length > 4000 && (
                        <p className="help">
                          Preview limited to the first 4,000 characters.
                        </p>
                      )}
                    </details>
                  ))}
                  {capture.limitations?.map((item) => (
                    <p className="notice notice-warning" key={item}>
                      {item}
                    </p>
                  ))}
                  <Evidence items={capture.context.evidence} />
                </section>
              )}
              <form className="stack-small" onSubmit={confirmFacts}>
                <h3 style={{ fontSize: 16 }}>
                  Confirm the factual company context
                </h3>
                <p className="help">
                  Supply reviewed facts from the captured source. Offers and
                  customer types use one entry per line; locations are optional.
                  This confirmation does not authorize external actions.
                </p>
                <label className="field">
                  Confirmed company name
                  <input
                    className="input"
                    required
                    maxLength={200}
                    value={name}
                    disabled={!authorized || !capture || busy}
                    onChange={(event) => {
                      setName(event.target.value);
                      setConfirmed(false);
                    }}
                  />
                </label>
                <label className="field">
                  Approved offers · one per line
                  <textarea
                    className="input"
                    required
                    value={offers}
                    disabled={!authorized || !capture || busy}
                    onChange={(event) => {
                      setOffers(event.target.value);
                      setConfirmed(false);
                    }}
                  />
                </label>
                <label className="field">
                  Customer types · one per line
                  <textarea
                    className="input"
                    required
                    value={customers}
                    disabled={!authorized || !capture || busy}
                    onChange={(event) => {
                      setCustomers(event.target.value);
                      setConfirmed(false);
                    }}
                  />
                </label>
                <label className="field">
                  Verified locations · one per line, optional
                  <textarea
                    className="input"
                    value={locations}
                    disabled={!authorized || !capture || busy}
                    onChange={(event) => {
                      setLocations(event.target.value);
                      setConfirmed(false);
                    }}
                  />
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    disabled={!authorized || !capture || busy}
                    onChange={(event) => setReviewed(event.target.checked)}
                  />
                  I reviewed the captured source and confirm these factual
                  inputs for this workspace.
                </label>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={
                    !authorized ||
                    busy ||
                    !capture ||
                    !reviewed ||
                    confirmed ||
                    !name.trim() ||
                    !lines(offers).length ||
                    !lines(customers).length
                  }
                >
                  <Check size={14} />
                  {confirmed
                    ? "Company facts confirmed"
                    : "Confirm source-grounded facts"}
                </Button>
              </form>
            </>
          ) : (
            <form className="stack-small google-resource-setup" onSubmit={bindResource}>
              <header className="source-resource-hero"><span className="source-resource-kicker">GOOGLE / APPROVED SOURCES</span><h3>Bind one authorized resource</h3><p>Select the exact source your team will use. Saving requests an access check.</p><div><ShieldCheck size={15}/><span>{selectedAccount ? selectedAccount.identity : "Choose your Google account"}</span>{selectedAccount && <Badge status={selectedAccount.health}/>}</div></header>
              <div className="source-resource-section"><span className="source-resource-kicker">01 / ACCOUNT & ACCESS</span>
              <label className="field">
                Connected Google account
                <select
                  className="input"
                  required
                  disabled={!authorized || busy}
                  value={connectionId}
                  onChange={(event) => chooseAccount(event.target.value)}
                >
                  <option value="">Choose a connected account</option>
                  {googleAccounts.map((item) => (
                      <option key={item.id} value={item.id} disabled={!usableGoogle(item, state.workspace.id)}>
                        {item.identity} · {item.health}
                      </option>
                    ))}
                </select>
              </label>
              <div className="source-resource-types" aria-label="Granted resource access">{resourceOptions.map(({type,label,detail,Icon}) => {
                const supported = accountUsable && supportsResource(selectedAccount, type);
                return <button type="button" key={type} aria-pressed={resourceType === type} disabled={!authorized || busy || !supported} onClick={() => chooseResource(type)}><Icon size={19}/><strong>{label}</strong><span>{detail}</span><small>{supported ? "Access granted" : "Not granted"}</small></button>;
              })}</div>
              <label className="field source-resource-select">
                Resource type
                <select
                  className="input"
                  disabled={!authorized || busy}
                  value={resourceType}
                  onChange={(event) => chooseResource(event.target.value as ResourceType)}
                >
                  <option value="sheet" disabled={!accountUsable || !supportsResource(selectedAccount, "sheet")}>Proposal source · Google Sheet</option>
                  <option value="calendar" disabled={!accountUsable || !supportsResource(selectedAccount, "calendar")}>Approved booking calendar</option>
                  <option value="mailbox" disabled={!accountUsable || !supportsResource(selectedAccount, "mailbox")}>
                    Approved sender / reply mailbox
                  </option>
                </select>
              </label>
              {bindingMessage && <p className="notice notice-warning source-resource-message" role="status">{bindingMessage}</p>}
              </div><div className="source-resource-section"><span className="source-resource-kicker">02 / EXACT RESOURCE</span>
              <p className="help">{resourceType === "sheet" ? "Paste the spreadsheet ID from its URL and choose an exact tab or cell range. DAVID has not selected a file for you." : resourceType === "calendar" ? "Use the calendar ID from Google Calendar settings. The connected account must own or have the required access to it." : "Enter the mailbox identity covered by this Google account. A typed address does not authorize another sender."}</p>
              <label className="field">
                {resourceType === "sheet"
                  ? "Selected spreadsheet file ID"
                  : resourceType === "calendar"
                    ? "Authorized calendar ID"
                    : "Approved mailbox identity"}
                <input
                  className="input"
                  required
                  maxLength={512}
                  disabled={!bindingAllowed || busy}
                  value={resourceId}
                  onChange={(event) => setResourceId(event.target.value)}
                  placeholder={
                    resourceType === "sheet"
                      ? "File ID selected or shared with this app"
                      : resourceType === "calendar"
                        ? "Calendar ID from the approved account"
                        : "approved-sender@company.example"
                  }
                />
              </label>
              {resourceType === "sheet" && (
                <>
                  <label className="field">
                    Exact tab / A1 range
                    <input
                      className="input"
                      required
                      maxLength={200}
                      disabled={!bindingAllowed || busy}
                      value={range}
                      onChange={(event) => setRange(event.target.value)}
                      placeholder="Proposals!A1:Q1000"
                    />
                  </label>
                  <details className="card card-body">
                    <summary
                      style={{
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Review proposal field mapping
                    </summary>
                    <p className="help" style={{ margin: "12px 0" }}>
                      Map each normalized proposal field to the exact source
                      header. Stable identity, current status, owner, email,
                      source verification time and approved scope are required.
                      Customer-owned columns remain intact. Add optional
                      gmail_thread_id for an enrolled Gmail conversation and
                      account_id when the source has an authoritative stable
                      account ID.
                    </p>
                    <label className="field">
                      Source column mapping (JSON)
                      <textarea
                        className="input"
                        style={{
                          minHeight: 260,
                          fontFamily: "monospace",
                          fontSize: 12,
                        }}
                        disabled={!bindingAllowed || busy}
                        value={mapping}
                        onChange={(event) => setMapping(event.target.value)}
                      />
                    </label>
                  </details>
                </>
              )}
              <label className="field">
                Responsible source owner
                <input
                  className="input"
                  required
                  maxLength={200}
                  disabled={!bindingAllowed || busy}
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                  placeholder="Person accountable for current source facts"
                />
              </label>
              </div><div className="source-resource-next"><ShieldCheck size={20}/><div><h4>What happens next</h4><p>Saving queues source verification. It does not activate agents, approve contact, or send an email.</p></div></div>
              <div className="notice notice-warning">
                <ShieldCheck size={18} />
                <p>
                  A file ID, address or calendar name cannot grant access.
                  Saving queues a read-only capability check; a verified
                  connection, current operating policy and explicit cohort
                  approval are still required before any external action.
                </p>
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={
                  !bindingAllowed ||
                  busy ||
                  !connectionId ||
                  !resourceId.trim() ||
                  !owner.trim() ||
                  (resourceType === "sheet" && !range.trim())
                }
              >
                {busy
                  ? "Saving resource…"
                  : "Save binding & queue verification"}
                <ArrowRight size={13} />
              </Button>
            </form>
          )}
        </div>
      </Drawer>
    </section>
  );
}
