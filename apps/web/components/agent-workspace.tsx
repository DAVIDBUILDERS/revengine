"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { ArrowRight, Calendar, FileText, Pause, Play, ShieldCheck, Upload } from "lucide-react";
import type { AgentDefinition, CommandResult } from "@david/contracts";
import { SERP_LOCATIONS } from "@david/contracts";
import { words } from "@david/ui";
import { agentDelivery } from "@david/domain/delivery";
import { onboardingFor, slotAgentIds, technicalSeoAnswers, technicalSeoReadyReasons } from "@david/domain";
import { bookingUrlInfo } from "@david/domain/outbound-sdr";
import type { ScreenProps } from "./app-shell";
import { ArtifactCopyOut } from "./artifact-copy-out";
import { Badge, Button, dateTime, Drawer, Evidence, QuietWalkthroughContext } from "./ui";

type AgentProps = Pick<ScreenProps, "state" | "act" | "busy" | "navigate">;

export function AgentRoster({
  state,
  onOpen,
}: Pick<ScreenProps, "state"> & {
  onOpen: (agent: AgentDefinition) => void;
}) {
  return (
    <div className="agent-roster">
      {state.installations.map((installation, index) => {
        const agent = state.catalog.find(
          (item) => item.id === installation.agentId,
        );
        if (!agent) return null;
        const artifacts = state.artifacts.filter(
          (item) => item.agentId === agent.id,
        ).length;
        const actions = state.actions.filter(
          (item) => item.installationId === installation.id,
        ).length;
        return (
          <button
            className="roster-row"
            key={installation.id}
            onClick={() => onOpen(agent)}
            aria-label={`Open ${agent.name} workspace`}
          >
            <span className="roster-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="roster-copy">
              <strong>{agent.name}</strong>
              <span>
                {installation.blockers[0] ??
                  (artifacts || actions
                    ? `${artifacts} saved outputs · ${actions} action records`
                    : "No recorded work yet")}
              </span>
            </span>
            <span className="roster-mode">{words(installation.mode)}</span>
            <Badge
              status={state.workspace.paused ? "paused" : installation.status}
            />
            <ArrowRight size={15} />
          </button>
        );
      })}
      {!state.installations.length && (
        <p className="small muted empty-roster">
          No agents installed. Select and save a team to begin.
        </p>
      )}
    </div>
  );
}

export function AgentWorkspace({
  agent,
  onClose,
  ...props
}: AgentProps & {
  agent: AgentDefinition | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={!!agent}
      onClose={onClose}
      title={agent?.name ?? "Agent workspace"}
      description={agent?.responsibility ?? ""}
    >
      {agent && (
        <AgentRecord
          key={agent.id}
          agent={agent}
          onClose={onClose}
          {...props}
        />
      )}
    </Drawer>
  );
}

function AgentRecord({
  agent,
  state,
  act,
  busy,
  navigate,
  onClose,
}: AgentProps & { agent: AgentDefinition; onClose: () => void }) {
  const [tab, setTab] = useState<"work" | "sources" | "rules">("work");
  const installation = state.installations.find(
    (item) => item.agentId === agent.id,
  );
  const installRequested = useRef(false);
  const savedTeam = slotAgentIds(onboardingFor(state).answers.team);
  useEffect(() => {
    if (installRequested.current || installation || !savedTeam.includes(agent.id)) return;
    installRequested.current = true;
    void act({ type: "select_team", agentIds: savedTeam });
  }, [act, agent.id, installation, savedTeam]);
  const artifacts = state.artifacts
    .filter((item) => item.agentId === agent.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const actions = state.actions
    .filter((item) => item.installationId === installation?.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const findings = state.findings.filter((item) => item.agentId === agent.id);
  const delivery = agentDelivery(state, agent.id);
  const sources = [
    ...artifacts.flatMap((item) => item.sourceSnapshot),
    ...actions.flatMap((item) => item.evidence),
    ...findings.flatMap((item) => item.evidence),
  ].filter(
    (item, index, all) =>
      all.findIndex((other) => other.id === item.id) === index,
  );
  const go = (
    page: Parameters<ScreenProps["navigate"]>[0],
    focus?: { proposal?: string },
  ) => {
    onClose();
    navigate(page, focus);
  };
  return (
    <div className="agent-workspace stack">
      <div className="agent-status-line">
        <Badge
          status={
            state.workspace.paused
              ? "paused"
              : (installation?.status ?? agent.releaseStatus)
          }
        />
        <span>{installation ? words(installation.mode) : "Not installed"}</span>
        <span>
          Definition {installation?.definitionVersion ?? agent.version}
        </span>
      </div>
      {state.workspace.paused && (
        <p className="help">
          Sending is paused. You can still finish this specialist’s setup.
        </p>
      )}
      {state.workspace.mode === "fixture" && (
        <p className="agent-disclosure">
          Synthetic workspace. Preparation uses fixtures; action records do not
          represent real messages or bookings.
        </p>
      )}
      <dl className="agent-facts">
        <div>
          <dt>Last preparation</dt>
          <dd>
            {installation?.lastPreparationAt
              ? dateTime(installation.lastPreparationAt)
              : "None recorded"}
          </dd>
        </div>
        <div>
          <dt>Last business action</dt>
          <dd>
            {installation?.lastBusinessActionAt
              ? dateTime(installation.lastBusinessActionAt)
              : "None verified"}
          </dd>
        </div>
        <div>
          <dt>Daily capacity</dt>
          <dd>
            {installation
              ? `${installation.dailyCapacity} ${agent.capacityUnit}`
              : "Not configured"}
          </dd>
        </div>
        <div>
          <dt>Policy version</dt>
          <dd>{installation?.policyVersion ?? "Not configured"}</dd>
        </div>
      </dl>
      {!!installation?.blockers.length && (
        <div className="notice notice-warning">
          <ShieldCheck size={17} />
          <div>
            <strong>Work is limited by</strong>
            {installation.blockers.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
      )}
      <div className="record-tabs" aria-label="Agent workspace sections">
        <button aria-pressed={tab === "work"} onClick={() => setTab("work")}>
          Work & handoffs
        </button>
        <button
          aria-pressed={tab === "sources"}
          onClick={() => setTab("sources")}
        >
          Inputs & access
        </button>
        <button aria-pressed={tab === "rules"} onClick={() => setTab("rules")}>
          Rules & limits
        </button>
      </div>
      {tab === "work" && (
        <div className="stack">
          <section className="agent-section">
            <h3>Work with this agent</h3>
            <p className="small muted">
              Use the supported controls below. Requests and saved results stay
              attached to this workspace.
            </p>
            {agent.id === "outbound-email-sdr" ? (
              <OutboundEmailSdrPanel
                state={state}
                act={act}
                busy={busy}
                installation={!!installation}
                onOpenPipeline={() => go("opportunities")}
              />
            ) : agent.id === "technical-seo-monitor" ? (
              <TechnicalSeoPanel
                state={state}
                act={act}
                busy={busy}
                installation={!!installation}
              />
            ) : agent.releaseStatus !== "planned" &&
              agent.modes.includes("preparation") ? (
              <>
                <Button
                  variant="primary"
                  onClick={() =>
                    void act({ type: "prepare", agentId: agent.id })
                  }
                  disabled={busy || state.workspace.paused || !installation}
                >
                  <Play size={14} />
                  Run bounded preparation
                </Button>
                <p className="help">
                  Uses approved company facts and source snapshots. Saves a
                  draft for review; publishing requires a separately implemented
                  capability.
                </p>
              </>
            ) : agent.releaseStatus !== "planned" ? (
              <>
                <Button onClick={() => go("opportunities")}>
                  <FileText size={14} />
                  Open customer work <ArrowRight size={14} />
                </Button>
                <p className="help">
                  Review the exact proposal, recipient and action in the
                  customer record. Human takeover is available per contact.
                </p>
              </>
            ) : (
              <p className="agent-disclosure">
                This role is planned. No executable capability is installed for
                it.
              </p>
            )}
            {!installation && (
              <p className="help">
                Select and save this specialist before preparing work.
              </p>
            )}
          </section>
          <section className="agent-section">
            <h3>
              Saved preparation artifacts{" "}
              <span className="muted">{artifacts.length}</span>
            </h3>
            {!artifacts.length && (
              <p className="small muted">
                No saved preparation yet. Missing source or model access will
                produce an explicit blocker.
              </p>
            )}
            {artifacts.map((item) => (
              <article className="agent-output" key={item.id}>
                <div className="between">
                  <Badge status={item.reviewState} />
                  <span className="tiny muted">{dateTime(item.createdAt)}</span>
                </div>
                <h4>{item.title}</h4>
                <div className="prose">{item.content}</div>
                <details>
                  <summary>Factual inputs & provenance</summary>
                  <ul className="small muted">
                    {item.factualInputs.map((fact, i) => (
                      <li key={i}>{fact}</li>
                    ))}
                  </ul>
                  <p className="tiny muted">
                    Capability {item.capabilityVersion} · Run {item.runId}
                  </p>
                  <Evidence items={item.sourceSnapshot} />
                </details>
                <p className="agent-disclosure">{item.limitation}</p>
                <ArtifactCopyOut artifact={item} delivery={delivery} />
              </article>
            ))}
          </section>
          <section className="agent-section">
            <h3>
              Action records <span className="muted">{actions.length}</span>
            </h3>
            {!actions.length && (
              <p className="small muted">
                No action records for this installation.
              </p>
            )}
            {actions.map((action) => {
              const approval = state.approvals.find(
                (item) => item.id === action.approvalId,
              );
              const receipts = state.receipts.filter(
                (item) => item.actionId === action.id,
              );
              return (
                <article className="agent-output" key={action.id}>
                  <div className="between">
                    <strong>{words(action.type)}</strong>
                    <Badge status={action.status} />
                  </div>
                  <p className="small">To: {action.payload.recipient}</p>
                  <p className="small">{action.payload.subject}</p>
                  <p className="help">
                    Approval record:{" "}
                    {approval
                      ? words(approval.status)
                      : "No per-action approval record"}
                    . Execution remains subject to current policy, authority and
                    source checks.
                  </p>
                  {receipts.map((receipt) => (
                    <div className="receipt-record" key={receipt.id}>
                      <p className="small">{receipt.message}</p>
                      <p className="help">
                        {receipt.provider} · {dateTime(receipt.observedAt)} ·
                        Reconciliation: {words(receipt.reconciliation)}
                      </p>
                      <Evidence items={receipt.evidence} />
                    </div>
                  ))}
                  <Button
                    className="btn-small"
                    onClick={() =>
                      go("opportunities", { proposal: action.proposalId })
                    }
                  >
                    Review customer record <ArrowRight size={13} />
                  </Button>
                </article>
              );
            })}
          </section>
          <section className="agent-section">
            <h3>Findings & human handoffs</h3>
            {!findings.length && (
              <p className="small muted">
                No findings assigned to this agent in the loaded records.
              </p>
            )}
            {findings.map((item) => (
              <div className="agent-output" key={item.id}>
                <Badge status={item.status} />
                <h4>{item.title}</h4>
                <p className="small muted">{item.observedCondition}</p>
                <p className="help">
                  Owner: {item.owner} · Review: {dateTime(item.reviewAt)}
                </p>
                <Evidence items={item.evidence} />
                <Button className="btn-small" onClick={() => go("decisions")}>
                  Review finding <ArrowRight size={13} />
                </Button>
              </div>
            ))}
            <p className="help">
              Records shown come from the current workspace snapshot; this is
              not a complete historical audit export.
            </p>
          </section>
        </div>
      )}
      {tab === "sources" && (
        <div className="stack">
          <section className="agent-section">
            <h3>Where this work goes</h3>
            <p className="small muted">{delivery.detail}</p>
            <p className="help">
              {delivery.destinationLabel}
              {delivery.destination ? ` · ${words(delivery.mode)}` : ""}. Copy-out
              is complete work. A connected destination does not grant permission
              to publish.
            </p>
            <Button onClick={() => go("connections")}>
              {delivery.mode === "engineering_required" ? "Record the systems this role would need" : "Review company destinations"} <ArrowRight size={14} />
            </Button>
          </section>
          <section className="agent-section">
            <h3>Required access</h3>
            <p className="small muted">
              These are capability requirements, not proof that access has been
              granted.
            </p>
            <ul className="record-list">
              {agent.requiredCapabilities.map((item) => (
                <li key={item}>{words(item)}</li>
              ))}
            </ul>
          </section>
          <section className="agent-section">
            <h3>Configured source mappings</h3>
            {installation?.sourceMappings.length ? (
              <ul className="record-list">
                {installation.sourceMappings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="small muted">
                No source mappings recorded for this installation.
              </p>
            )}
            <Button onClick={() => go("connections")}>
              Inspect connections & source owners <ArrowRight size={14} />
            </Button>
          </section>
          <section className="agent-section">
            <h3>Evidence used in recorded work</h3>
            <Evidence items={sources} />
            {!sources.length && (
              <p className="small muted">
                No evidence attached to recorded outputs, actions or findings
                yet.
              </p>
            )}
          </section>
          <section className="agent-section">
            <h3>Declared tools</h3>
            <ul className="record-list">
              {agent.toolNames.map((item) => (
                <li key={item}>{words(item)}</li>
              ))}
            </ul>
            {!agent.toolNames.length && (
              <p className="small muted">No tools implemented.</p>
            )}
            <p className="help">
              Declared tools describe the role. This view does not claim that a
              tool was called without an action or output record.
            </p>
          </section>
        </div>
      )}
      {tab === "rules" && (
        <div className="stack">
          <section className="agent-section">
            <h3>Allowed work</h3>
            <ul className="record-list">
              {agent.allowedTasks.map((item) => (
                <li key={item}>{words(item)}</li>
              ))}
            </ul>
            {!agent.allowedTasks.length && (
              <p className="small muted">No executable tasks implemented.</p>
            )}
          </section>
          <section className="agent-section">
            <h3>What starts work</h3>
            <ul className="record-list">
              {agent.triggers.map((item) => (
                <li key={item}>{words(item)}</li>
              ))}
            </ul>
            <p className="help">
              Declared triggers run only when the relevant workflow is
              configured and current readiness checks pass.
            </p>
          </section>
          <section className="agent-section">
            <h3>Stop conditions</h3>
            <ul className="record-list">
              {agent.stopConditions.map((item) => (
                <li key={item}>{words(item)}</li>
              ))}
            </ul>
          </section>
          <section className="agent-section">
            <h3>Prerequisites & dependencies</h3>
            <ul className="record-list">
              {[...agent.prerequisites, ...agent.dependencies].map((item) => (
                <li key={item}>{words(item)}</li>
              ))}
            </ul>
          </section>
          <section className="agent-section">
            <h3>Failure & fallback</h3>
            <ul className="record-list">
              {agent.failureModes.map((item) => (
                <li key={item}>{words(item)}</li>
              ))}
            </ul>
            <p className="small">{agent.fallback}</p>
          </section>
          <section className="agent-section">
            <h3>Your controls</h3>
            <p className="small muted">
              Review exact actions in customer records, take over a contact, or
              pause the whole workspace. Pausing stops new dispatch; a provider
              call already in flight may still complete.
            </p>
            <div className="flex wrap">
              <Button onClick={() => go("opportunities")}>
                Customer controls
              </Button>
              <Button
                disabled={busy || state.workspace.paused}
                onClick={() => void act({ type: "pause", paused: true })}
              >
                {state.workspace.paused
                  ? "Workspace paused"
                  : "Pause workspace"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const LEAD_FIELDS = [
  ["email", "Email"],
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["company", "Company"],
  ["title", "Title"],
  ["website", "Website"],
] as const;

function OutboundEmailSdrPanel({
  state,
  act,
  busy,
  installation,
  onOpenPipeline,
}: Pick<AgentProps, "state" | "act" | "busy"> & { installation: boolean; onOpenPipeline: () => void }) {
  const quiet = useContext(QuietWalkthroughContext);
  const sdr = state.outboundSdr;
  const [bookingUrl, setBookingUrl] = useState(sdr?.bookingUrl ?? "");
  const [instantlyWorkspaceId, setInstantlyWorkspaceId] = useState(
    sdr?.instantlyWorkspaceId && sdr.instantlyWorkspaceId !== "fixture" ? sdr.instantlyWorkspaceId : "",
  );
  const [csv, setCsv] = useState("");
  const [fileError, setFileError] = useState("");
  const [preview, setPreview] = useState<CommandResult["preview"]>();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const booking = bookingUrlInfo(bookingUrl || sdr?.bookingUrl);
  const replies = (sdr?.leads ?? []).filter(
    (lead) => lead.lastReply || lead.status === "replied" || lead.status === "booked",
  );
  const booked = (sdr?.leads ?? []).filter((lead) => lead.status === "booked").length;
  const fixture = state.workspace.mode === "fixture";
  const setupBlocked = busy || !installation;
  const sendBlocked = setupBlocked || state.workspace.paused;
  return (
    <div className="stack">
      <p className="help">
        Upload a list. DAVID writes the sequence. Instantly sends, warms inboxes, handles replies, and books. This agent does not find leads. There is no per-email approval.
      </p>
      {fixture && !quiet && (
        <p className="agent-disclosure">
          Instantly send is not live in this fixture. Ready gates still apply; start records a fixture campaign only.
        </p>
      )}
      {sdr?.lastError && (
        <p className="notice notice-warning">{sdr.lastError}</p>
      )}
      <label className="field">
        Meeting link
        <input
          className="input"
          value={bookingUrl}
          onChange={(event) => setBookingUrl(event.target.value)}
          placeholder="https://calendly.com/you/30min"
        />
      </label>
      <p className="help">{booking.message}</p>
      <Button
        disabled={setupBlocked || !bookingUrl.trim()}
        onClick={() => void act({ type: "set_booking_url", url: bookingUrl.trim() })}
      >
        <Calendar size={14} />
        Save meeting link
      </Button>
      <label className="field">
        Instantly sub-workspace
        <input
          className="input"
          value={instantlyWorkspaceId}
          onChange={(event) => setInstantlyWorkspaceId(event.target.value)}
          placeholder="Instantly workspace UUID"
        />
      </label>
      <p className="help">
        {sdr?.instantlyWorkspaceId && sdr.instantlyWorkspaceId !== "fixture"
          ? "Bound. Live Instantly calls send x-as-workspace for this DAVID workspace only."
          : "Operator binds the Instantly sub-workspace UUID. Do not use the DAVID Ops admin workspace for customer send."}
      </p>
      <Button
        disabled={setupBlocked || !instantlyWorkspaceId.trim()}
        onClick={() => void act({ type: "bind_instantly_workspace", instantlyWorkspaceId: instantlyWorkspaceId.trim() })}
      >
        Bind Instantly workspace
      </Button>
      <label className="field">
        Lead CSV
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 1000000) {
              setFileError("Choose a CSV smaller than 1 MB.");
              return;
            }
            setFileError("");
            setCsv(await file.text());
            setPreview(undefined);
          }}
        />
      </label>
      {fileError && (
        <p role="alert" className="notice notice-danger">
          {fileError}
        </p>
      )}
      <label className="field">
        CSV content
        <textarea
          className="input"
          style={{ minHeight: 120, fontFamily: "monospace", fontSize: 11 }}
          value={csv}
          onChange={(event) => {
            setCsv(event.target.value);
            setPreview(undefined);
          }}
          placeholder="email,first_name,company"
        />
      </label>
      <Button
        disabled={setupBlocked || !csv.trim()}
        onClick={async () => {
          const result = await act({
            type: "import_lead_csv",
            csv,
            preview: true,
            mapping,
          });
          setPreview(result?.preview);
          if (result?.preview?.mapping) setMapping(result.preview.mapping);
        }}
      >
        <Upload size={14} />
        Preview lead mapping
      </Button>
      {preview && (
        <div className="stack-small">
          <Badge tone={preview.errors.length ? "warning" : "positive"}>
            {preview.valid} valid rows · {preview.errors.length} errors
          </Badge>
          {LEAD_FIELDS.map(([field, label]) => (
            <label className="field" key={field}>
              {label}
              <select
                className="input"
                value={mapping[field] ?? preview.mapping?.[field] ?? ""}
                onChange={(event) =>
                  setMapping((current) => ({ ...current, [field]: event.target.value }))
                }
              >
                <option value="">{field === "email" ? "Select email column" : "Optional"}</option>
                {(preview.headers ?? Object.keys(preview.rows[0] ?? {})).map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {preview.errors.slice(0, 8).map((error, index) => (
            <p className="notice notice-danger" key={index}>
              Row {error.row}: {error.message}
            </p>
          ))}
          <Button
            variant="primary"
            disabled={setupBlocked || preview.errors.length > 0 || !preview.valid}
            onClick={async () => {
              const result = await act({
                type: "import_lead_csv",
                csv,
                preview: false,
                mapping,
              });
              if (result) setPreview(undefined);
            }}
          >
            Import leads
          </Button>
        </div>
      )}
      <p className="small muted">
        {`${sdr?.leads.length ?? 0} imported ${sdr?.leads.length === 1 ? "lead" : "leads"}. Email is the only required column.`}
      </p>
      <Button
        disabled={setupBlocked || !state.activation.confirmedFacts}
        onClick={() => void act({ type: "generate_outbound_sequence" })}
      >
        Write 3-step sequence
      </Button>
      {!!sdr?.sequence.length && (
        <ol className="record-list">
          {sdr.sequence.map((step, index) => (
            <li key={index}>
              <strong>{step.subject}</strong>
              <p className="small muted">{step.body}</p>
            </li>
          ))}
        </ol>
      )}
      <div className="flex wrap">
        <Button
          variant="primary"
          disabled={sendBlocked || (sdr?.status !== "ready" && sdr?.status !== "paused")}
          onClick={() => void act({ type: "start_outbound_sdr" })}
        >
          <Play size={14} />
          Start sending
        </Button>
        <Button
          disabled={setupBlocked || (sdr?.status !== "sending" && sdr?.status !== "paused")}
          onClick={() => void act({ type: "pause_outbound_sdr" })}
        >
          <Pause size={14} />
          Pause Instantly
        </Button>
        <Button onClick={onOpenPipeline}>
          Open replies <ArrowRight size={14} />
        </Button>
      </div>
      <p className="help">
        Status: {sdr ? words(sdr.status) : "needs setup"}
        {sdr?.warmupReady ? " · warmup healthy" : " · warmup is a send gate, not an approval queue"}
        {sdr?.campaignId?.startsWith("FIXTURE_ONLY") ? " · fixture campaign" : ""}
        . {booked} meeting{booked === 1 ? "" : "s"} booked.
      </p>
      <Button
        disabled={setupBlocked}
        onClick={() =>
          void act({
            type: "set_outbound_crm",
            provider: sdr?.crmProvider === "hubspot" ? "none" : "hubspot",
          })
        }
      >
        {sdr?.crmProvider === "hubspot" ? "Disconnect HubSpot" : "Use HubSpot as the first CRM"}
      </Button>
      {sdr?.crmProvider === "hubspot" && (
        <p className="help">
          HubSpot is recorded as {words(sdr.crmStatus)}. Authorize it so DAVID can pull contacts into Instantly. CSV upload works now. Salesforce and Pipedrive are later.
        </p>
      )}
      <h4>Replies & bookings</h4>
      {!replies.length && (
        <p className="small muted">
          Instantly Unibox stays invisible. Replies land in this workspace after webhooks.
        </p>
      )}
      {replies.slice(0, 8).map((lead) => (
        <article className="agent-output" key={lead.id}>
          <div className="between">
            <strong>{lead.email}</strong>
            <Badge status={lead.status} />
          </div>
          <p className="small">{lead.lastReply ?? words(lead.status)}</p>
        </article>
      ))}
    </div>
  );
}

function TechnicalSeoPanel({
  state,
  act,
  busy,
  installation,
}: Pick<AgentProps, "state" | "act" | "busy"> & { installation: boolean }) {
  const quiet = useContext(QuietWalkthroughContext);
  const seo = state.technicalSeo;
  const saved = technicalSeoAnswers(state);
  const record = state.agentOnboarding?.find((item) => item.agentId === "technical-seo-monitor");
  const [keywords, setKeywords] = useState(saved.keywords.join("\n"));
  const [locationName, setLocationName] = useState(saved.locationName || seo?.locationName || "United States");
  const fixture = state.workspace.mode === "fixture";
  const location = SERP_LOCATIONS.find((item) => item.name === locationName) ?? SERP_LOCATIONS[0];
  const setupBlocked = busy || !installation;
  const reasons = technicalSeoReadyReasons(state);
  return (
    <div className="stack">
      <p className="help">
        DataForSEO crawls the confirmed company origin (max 50 pages) and reads Google organic ranks plus Labs inventory. Copy titles, descriptions and fixes into the CMS. DAVID does not write the live site. Search Console stays off.
      </p>
      {fixture && !quiet && (
        <p className="agent-disclosure">
          ILLUSTRATIVE FIXTURE — DataForSEO did not crawl or read Google. Start records labeled fixture pages and ranks only.
        </p>
      )}
      {seo?.lastError && <p className="notice notice-warning">{seo.lastError}</p>}
      <label className="field">
        Keywords (one per line, max 20)
        <textarea
          className="input"
          style={{ minHeight: 120 }}
          value={keywords}
          onChange={(event) => setKeywords(event.target.value)}
          placeholder={"ai seo agency\nshopify seo"}
        />
      </label>
      <label className="field">
        SERP location
        <select className="input" value={locationName} onChange={(event) => setLocationName(event.target.value)}>
          {SERP_LOCATIONS.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <p className="help">Language {location.languageCode}. Company website comes from Connections — it is not copied into this agent.</p>
      <Button
        disabled={setupBlocked || !keywords.trim()}
        onClick={() =>
          void act({
            type: "save_technical_seo_setup",
            expectedRevision: record?.revision ?? 0,
            keywords: keywords.split(/\n|,/).map((value) => value.trim()).filter(Boolean),
            locationName,
            languageCode: location.languageCode,
          })
        }
      >
        Save keywords and location
      </Button>
      {reasons.length > 0 && (
        <p className="help">{reasons[0]}</p>
      )}
      <div className="flex wrap">
        <Button
          variant="primary"
          disabled={setupBlocked || state.workspace.paused || reasons.length > 0}
          onClick={() => void act({ type: "start_technical_seo" })}
        >
          <Play size={14} />
          {seo?.status === "paused" ? "Resume DataForSEO crawl" : "Start DataForSEO crawl"}
        </Button>
        <Button disabled={setupBlocked || seo?.status === "paused"} onClick={() => void act({ type: "pause_technical_seo" })}>
          <Pause size={14} />
          Pause Technical SEO
        </Button>
      </div>
      <p className="help">
        {seo?.status === "crawling" || seo?.status === "queued"
          ? "Crawl in progress. Rankings appear after DataForSEO finishes."
          : seo?.crawlTaskId
            ? `${seo.pages.length} pages · ${seo.rankings.length} rank rows · ${seo.fixture ? "fixture task" : "DataForSEO task"} ${seo.crawlTaskId}`
            : "No crawl recorded yet."}
      </p>
      {(seo?.pages ?? []).slice(0, 8).map((page) => (
        <article className="agent-output" key={page.url}>
          <div className="between">
            <strong>{page.title || page.url}</strong>
            <Badge tone={page.failedChecks.length ? "warning" : "positive"}>{page.statusCode || "—"}</Badge>
          </div>
          <p className="small">{page.url}</p>
          {page.failedChecks.length > 0 && <p className="small">{page.failedChecks.join(", ")}</p>}
        </article>
      ))}
      {(seo?.rankings ?? []).slice(0, 12).map((row) => (
        <article className="agent-output" key={`${row.source}:${row.keyword}`}>
          <div className="between">
            <strong>{row.keyword}</strong>
            <Badge>{row.rank ? `#${row.rank}` : "not in top 10"}</Badge>
          </div>
          <p className="small">{row.source} · {row.locationName}{row.resultUrl ? ` · ${row.resultUrl}` : ""}</p>
        </article>
      ))}
    </div>
  );
}
