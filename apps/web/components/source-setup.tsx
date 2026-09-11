"use client";

import { useState } from "react";
import type { AppSnapshot, EvidenceRef } from "@david/contracts";
import {
  AlertCircle,
  ArrowRight,
  Check,
  FileText,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Drawer, Evidence, dateTime } from "./ui";

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

export function SourceSetup({ state }: { state: AppSnapshot }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"website" | "google">("website");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [url, setUrl] = useState("");
  const [capture, setCapture] = useState<Capture | null>(null);
  const [name, setName] = useState("");
  const [offers, setOffers] = useState("");
  const [customers, setCustomers] = useState("");
  const [locations, setLocations] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [connectionId, setConnectionId] = useState(
    state.connections.find(
      (item) => item.provider === "google" && item.health !== "revoked",
    )?.id ?? "",
  );
  const [resourceType, setResourceType] = useState<
    "sheet" | "calendar" | "mailbox"
  >("sheet");
  const [resourceId, setResourceId] = useState("");
  const [range, setRange] = useState("");
  const [owner, setOwner] = useState("");
  const [mapping, setMapping] = useState(
    JSON.stringify(
      {
        columns: Object.fromEntries(
          sourceColumns.map((column) => [column, column]),
        ),
      },
      null,
      2,
    ),
  );
  const fixture = state.workspace.mode === "fixture";
  const authorized =
    !fixture &&
    ["workspace_owner", "david_operator"].includes(state.context.role);
  const unavailable = fixture
    ? "Real source setup is unavailable in fixture mode. Bounded preparation uses the approved synthetic source already supplied. No website is fetched and no Google resource is bound."
    : !authorized
      ? "A workspace owner or assigned DAVID operator must approve sources and confirm company facts."
      : "";
  async function post(path: string, body: Record<string, unknown>) {
    if (!authorized) return null;
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
      setFeedback({
        text:
          error instanceof Error
            ? error.message
            : "Source setup failed. Review access and retry.",
        error: true,
      });
      return null;
    } finally {
      setBusy(false);
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
        <div className="stack">
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
            <form className="stack-small" onSubmit={bindResource}>
              <h3 style={{ fontSize: 16 }}>Bind one authorized resource</h3>
              <label className="field">
                Connected Google account
                <select
                  className="input"
                  required
                  disabled={!authorized || busy}
                  value={connectionId}
                  onChange={(event) => setConnectionId(event.target.value)}
                >
                  <option value="">Choose a connected account</option>
                  {state.connections
                    .filter(
                      (item) =>
                        item.provider === "google" && item.health !== "revoked",
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.identity} · {item.resource}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                Resource type
                <select
                  className="input"
                  disabled={!authorized || busy}
                  value={resourceType}
                  onChange={(event) =>
                    setResourceType(event.target.value as typeof resourceType)
                  }
                >
                  <option value="sheet">Proposal source · Google Sheet</option>
                  <option value="calendar">Approved booking calendar</option>
                  <option value="mailbox">
                    Approved sender / reply mailbox
                  </option>
                </select>
              </label>
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
                  disabled={!authorized || busy}
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
                      disabled={!authorized || busy}
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
                        disabled={!authorized || busy}
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
                  disabled={!authorized || busy}
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                  placeholder="Person accountable for current source facts"
                />
              </label>
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
                  !authorized ||
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
