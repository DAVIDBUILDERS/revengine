"use client";
import { AgentRoster, AgentWorkspace } from "./agent-workspace";
import { SourceSetup } from "./source-setup";
import { activeApprovals } from "./approval-state";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  FlaskConical,
  Mail,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ListChecks,
  Target,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type {
  AgentDefinition,
  CommandResult,
  ForecastScenario,
  UsageRecord,
} from "@david/contracts";
import { onboardingFor } from '@david/domain/onboarding';
import { forecastCases, deliveryEconomics } from "@david/domain/scenarios";
import { money, words } from "@david/ui";
import { PageHeading, type ScreenProps } from "./app-shell";
import {
  Badge,
  Button,
  dateTime,
  Drawer,
  Empty,
  Evidence,
  shortDate,
} from "./ui";

export function Team(props: ScreenProps) {
  const { state, act, busy, navigate } = props;
  const [goal, setGoal] = useState(state.recommendation.goal);
  const [model, setModel] = useState(state.workspace.businessModel);
  const setup = onboardingFor(state);
  const savedTeam = setup.revision ? setup.answers.team : state.activation.selectedTeam;
  const [selected, setSelected] = useState(savedTeam);
  const [teamMessage, setTeamMessage] = useState("");
  async function openSetup(section: number) {
    if (busy) return;
    if (selectedKey !== selected.join(",")) {
      const result = await act({type:"save_onboarding", expectedRevision:setup.revision, answers:{...setup.answers,team:selected}});
      if (!result) { setTeamMessage("Save failed. Your selections are still here; retry before opening settings."); return; }
    }
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "profile");
    url.searchParams.set("setup", String(section));
    window.history.replaceState({}, "", url.pathname + url.search);
    navigate("activation");
  }
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All specialists");
  const [agent, setAgent] = useState<AgentDefinition | null>(null);
  const selectedKey = savedTeam.join(",");
  useEffect(() => setSelected(savedTeam), [selectedKey]);
  const categories = [
    "All specialists",
    ...new Set(state.catalog.map((item) => item.category)),
  ];
  const filtered = state.catalog.filter(
    (item) =>
      (category === "All specialists" || item.category === category) &&
      `${item.name} ${item.responsibility}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < (state.workspace.entitlement ?? 5)
          ? [...current, id]
          : current,
    );
  return (
    <div className="stack">
      <PageHeading
        eyebrow="People set direction. Agents do bounded work."
        title="Your team"
        description="Inspect each agent’s work, sources and permissions. Choose responsibilities within your workspace allowance."
        action={
          <Button variant="primary" onClick={() => openSetup(5)}>
            Review team readiness
            <ArrowRight size={14} />
          </Button>
        }
      />
      <section aria-label="Installed agents">
        <div className="section-heading">
          <h2>Installed agents</h2>
          <span>Open a workspace to inspect or request work</span>
        </div>
        <AgentRoster state={state} onOpen={setAgent} />
      </section>
      <section className="card card-body stack">
        <div className="between">
          <div>
            <h2 style={{ fontSize: 17 }}>Start with the outcome you want</h2>
            <p className="small muted" style={{ marginTop: 8 }}>
              Recommendations account for applicability, source dependencies and
              the capabilities implemented today.
            </p>
          </div>
          <ListChecks size={23} color="var(--accent)" />
        </div>
        <div className="grid-two">
          <label className="field">
            Business goal
            <select
              className="input"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            >
              <option value={state.recommendation.goal}>
                {state.recommendation.goal}
              </option>
              {[
                "Recover open proposals",
                "Create qualified demand",
                "Improve conversion",
                "Retain and expand customers",
              ]
                .filter((item) => item !== state.recommendation.goal)
                .map((item) => (
                  <option key={item}>{item}</option>
                ))}
            </select>
          </label>
          <label className="field">
            Business model
            <select
              className="input"
              value={model}
              onChange={(e) => setModel(e.target.value as typeof model)}
            >
              <option value="b2b_services">B2B services</option>
              <option value="home_services">Home services</option>
              <option value="commerce">Commerce · catalog and scenarios</option>
            </select>
          </label>
        </div>
        <div className="between">
          <span className="help">
            Recommendations do not grant connection access or authorize
            execution.
          </span>
          <div className="flex wrap">
            <Button
              onClick={async () => {
                setTeamMessage("");
                const result = await act({ type: "recommend_team", goal, businessModel: model });
                if (result) {
                  setSelected(result.snapshot.recommendation.specialistIds.slice(0, state.workspace.entitlement ?? 5));
                  setTeamMessage("Recommended team selected below. Review it, then save your team.");
                } else setTeamMessage("We couldn’t recommend a team. Review the error above and try again.");
              }}
              disabled={busy}
            >
              <ListChecks size={14} />
              Recommend my five
            </Button>
            <Button
              disabled={busy || !state.recommendation.specialistIds.length}
              onClick={() =>
                setSelected([...state.recommendation.specialistIds])
              }
            >
              Use recommended five
              <ArrowRight size={13} />
            </Button>
          </div>
        </div>
      </section>
      {teamMessage && <p role="status" className="notice">{teamMessage}</p>}
      <section>
        <div className="section-heading">
          <h2>Your selected team</h2>
          <span>
            {selected.length} / {state.workspace.entitlement ?? 5} specialist slots ·{" "}
            {money(state.workspace.subscriptionMinor)} / month
          </span>
        </div>
        <div className="card card-body">
          <div className="flex wrap">
            {selected.map((id) => (
              <span
                key={id}
                className="badge badge-info"
                style={{ padding: "9px 11px", fontSize: 12 }}
              >
                {state.catalog.find((item) => item.id === id)?.name ?? id}
                <button
                  style={{
                    border: 0,
                    background: "transparent",
                    display: "flex",
                  }}
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${state.catalog.find((item) => item.id === id)?.name ?? id}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {!selected.length && (
              <p className="small muted">
                Select specialists within your workspace allowance.
              </p>
            )}
          </div>
          <div className="between" style={{ marginTop: 20 }}>
            <p className="help">
              Shared foundations consume no specialist slots. Changing the team
              pauses execution. Save your team, then configure its sources and permissions below.
            </p>
            <Button
              variant="primary"
              disabled={busy || selectedKey === selected.join(",")}
              onClick={async () => {
                const result = await act({ type: "save_onboarding", expectedRevision: setup.revision, answers: {...setup.answers, team: selected} });
                setTeamMessage(result ? "Team saved. Configure sources and permissions, then review readiness." : "Your team could not be saved. Review the error above and retry.");
              }}
            >
              Save team
            </Button>
          </div>
        </div>
      </section>
      <section className="card card-body stack" aria-label="Build this workspace together">
        <h2>Build this workspace together</h2>
        <p>Work through these settings with your customer in any order. Saved answers are shared across the team; agents remain blocked until their required checks pass.</p>
        <div className="flex wrap">
          <Button onClick={() => openSetup(0)}>Company & objectives</Button>
          <Button onClick={() => openSetup(2)}>Sources & connections</Button>
          <Button onClick={() => openSetup(3)}>Permissions & budgets</Button>
          <Button onClick={() => openSetup(4)}>People & measurement</Button>
          <Button onClick={() => openSetup(5)}>Review readiness</Button>
        </div>
      </section>
      {state.recommendation.limitations.length > 0 && (
        <div className="notice notice-warning">
          <AlertCircle size={18} />
          <div>
            {state.recommendation.limitations.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
      )}
      <section className="stack">
        <div className="between">
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="catalog-search">Search the catalog</label>
            <div className="flex">
              <Search size={17} color="var(--muted)" />
              <input
                id="catalog-search"
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or responsibility"
              />
            </div>
          </div>
          <label className="field">
            Responsibility group
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="catalog-grid">
          {filtered.map((item) => {
            const installed = state.installations.find(
              (value) => value.agentId === item.id,
            );
            const applicable = item.supportedArchetypes.includes(model);
            const picked = selected.includes(item.id);
            const recommended = state.recommendation.specialistIds.includes(
              item.id,
            );
            return (
              <article
                className={`card agent-card ${picked ? "selected" : ""}`}
                key={item.id}
              >
                <div className="between">
                  <div className="agent-symbol">
                    <ListChecks size={18} />
                  </div>
                  {recommended ? (
                    <Badge tone="info">Recommended</Badge>
                  ) : (
                    <span className="eyebrow">{item.category}</span>
                  )}
                </div>
                <h3>{item.name}</h3>
                <p>{item.responsibility}</p>
                <div className="flex wrap" style={{ gap: 5 }}>
                  <Badge status={installed?.status ?? item.releaseStatus} />
                  {item.modes.map((mode) => (
                    <Badge
                      key={mode}
                      tone={mode === "preparation" ? "info" : "warning"}
                    >
                      {words(mode)}
                    </Badge>
                  ))}
                  {!applicable && (
                    <Badge tone="warning">Outside this business model</Badge>
                  )}
                </div>
                <div className="agent-card-foot">
                  <button
                    className="link-button"
                    onClick={() => setAgent(item)}
                  >
                    Role & readiness
                    <ChevronRight size={12} />
                  </button>
                  <Button
                    className="btn-small"
                    disabled={!picked && (selected.length >= (state.workspace.entitlement ?? 5) || !applicable)}
                    onClick={() => toggle(item.id)}
                  >
                    {picked ? <Check size={13} /> : <Plus size={13} />}{" "}
                    {picked ? "Selected" : "Select"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
        {!filtered.length && (
          <Empty title="No matching specialists">
            Try a different search or responsibility group.
          </Empty>
        )}
      </section>
      <AgentWorkspace {...props} agent={agent} onClose={() => setAgent(null)} />
    </div>
  );
}

export function Opportunities(props: ScreenProps) {
  const { state, act, busy, navigate, inspect } = props;
  const [tab, setTab] = useState<"sales" | "findings">("sales");
  const [proposalId, setProposalId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("proposal"),
  );
  const [importOpen, setImportOpen] = useState(false);
  const proposal = state.proposals.find((item) => item.id === proposalId);
  return (
    <div className="stack">
      <PageHeading
        eyebrow="Focus on the next useful action"
        title="Opportunities"
        description="Sales records track customer opportunities. The work inbox holds evidence-backed findings your team can investigate; it never adds to pipeline totals."
        action={
          <Button onClick={() => setImportOpen(true)}>
            <Upload size={14} />
            Import proposal CSV
          </Button>
        }
      />
      <div className="pill-tabs" aria-label="Opportunity views">
        <button aria-pressed={tab === "sales"} onClick={() => setTab("sales")}>
          Sales records · {state.proposals.length}
        </button>
        <button
          aria-pressed={tab === "findings"}
          onClick={() => setTab("findings")}
        >
          Work inbox · {state.findings.length}
        </button>
      </div>
      {tab === "sales" && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Proposal follow-up</h2>
              <p className="help" style={{ marginTop: 6 }}>
                Current source status and contact permissions are checked before
                dispatch.
              </p>
            </div>
            <Badge tone="info">Deal Follow-up playbook</Badge>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company / contact</th>
                  <th>Proposal</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Next step</th>
                  <th>
                    <span className="sr-only">Open record</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.proposals.map((item) => {
                  const contact = state.contacts.find(
                    (c) => c.id === item.contactId,
                  );
                  const action = state.actions
                    .filter((a) => a.proposalId === item.id)
                    .at(-1);
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{contact?.account ?? "Unknown account"}</strong>
                        <div className="help">
                          {contact?.name ?? "Unknown contact"}
                        </div>
                      </td>
                      <td>
                        {item.reference}
                        <div className="help">Version {item.version}</div>
                      </td>
                      <td className="numeric">
                        {money(item.amountMinor, item.currency)}
                        <div className="help">{words(item.valueKind)}</div>
                      </td>
                      <td>
                        <Badge
                          status={
                            contact?.suppressed
                              ? "blocked"
                              : contact?.humanTakeover
                                ? "paused"
                                : item.status
                          }
                        />
                      </td>
                      <td>
                        {action ? (
                          <Badge status={action.status} />
                        ) : (
                          <span className="help">
                            {item.status === "open"
                              ? "Evaluate eligibility"
                              : "No outreach permitted"}
                          </span>
                        )}
                      </td>
                      <td>
                        <Button
                          className="btn-small"
                          onClick={() => setProposalId(item.id)}
                        >
                          Open
                          <ChevronRight size={12} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!state.proposals.length && (
            <Empty
              title="No proposal records yet"
              action={
                <Button onClick={() => setImportOpen(true)}>
                  Preview a CSV import
                </Button>
              }
            >
              Start with a source export containing stable IDs, current status,
              contact channel and factual scope.
            </Empty>
          )}
        </section>
      )}
      {tab === "findings" && (
        <div className="grid-two">
          {state.findings.map((f) => (
            <article className="card card-body" key={f.id}>
              <div className="between">
                <Badge status={f.status} />
                <Target size={19} color="var(--accent)" />
              </div>
              <h3 style={{ fontSize: 18, margin: "16px 0 10px" }}>{f.title}</h3>
              <p className="small muted">{f.observedCondition}</p>
              <p className="small" style={{ marginTop: 14 }}>
                {f.hypothesis}
              </p>
              <div className="help" style={{ margin: "14px 0" }}>
                Specialist:{" "}
                {state.catalog.find((a) => a.id === f.agentId)?.name}
                <br />
                Owner: {f.owner} · {f.effortMinutes} minutes ·{" "}
                {money(f.costMinor)}
                <br />
                Success rule: {f.evaluationRule}
              </div>
              <div className="flex wrap">
                <button
                  className="link-button"
                  onClick={() =>
                    inspect(f.title, f.observedCondition, f.evidence)
                  }
                >
                  Inspect evidence
                  <ArrowUpRight size={12} />
                </button>
                <Button
                  className="btn-small"
                  onClick={() => navigate("decisions")}
                >
                  Review decision
                  <ArrowRight size={12} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Drawer
        open={!!proposal}
        onClose={() => setProposalId(null)}
        title={
          proposal
            ? `${proposal.reference} · ${state.contacts.find((c) => c.id === proposal.contactId)?.account ?? "Proposal"}`
            : ""
        }
        description="One customer journey, one shared owner. Actions keep their exact approval, current-state checks and source evidence."
      >
        {proposal && <ProposalDetail {...props} proposalId={proposal.id} />}
      </Drawer>
      <Drawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import current proposal records"
        description="Preview field mappings and row-level validation before saving. Stable IDs make repeat imports safe; omitted rows never become wins or deletions."
      >
        <CsvImport state={state} act={act} busy={busy} />
      </Drawer>
    </div>
  );
}

function ProposalDetail({
  state,
  act,
  busy,
  proposalId,
}: ScreenProps & { proposalId: string }) {
  const proposal = state.proposals.find((item) => item.id === proposalId)!;
  const contact = state.contacts.find((item) => item.id === proposal.contactId);
  const actions = state.actions.filter(
    (item) => item.proposalId === proposalId,
  );
  const [reply, setReply] = useState(
    "Thanks for following up. Let's schedule a conversation about the proposal.",
  );
  const [startAt, setStartAt] = useState("");
  const [timeZone, setTimeZone] = useState(state.workspace.timeZone);
  return (
    <div className="stack">
      <div className="between">
        <Badge status={proposal.status} />
        <span className="small numeric">
          {money(proposal.amountMinor, proposal.currency)} ·{" "}
          {words(proposal.valueKind)}
        </span>
      </div>
      <div className="small">
        <strong>
          {contact?.name} · {contact?.email}
        </strong>
        <p className="muted" style={{ marginTop: 8 }}>
          {proposal.scopeSummary}
        </p>
        <p className="help" style={{ marginTop: 12 }}>
          Source owner: {proposal.owner}
          <br />
          Business fact verified: {dateTime(proposal.sourceVerifiedAt)}
          <br />
          Last synchronized: {dateTime(proposal.syncedAt)}
          <br />
          Valid until:{" "}
          {proposal.validUntil
            ? dateTime(proposal.validUntil)
            : "No validity supplied"}
          <br />
          Contact enrolled: {contact?.enrolled ? "Yes" : "No"} · Suppression:{" "}
          {contact?.suppressed ? "Active" : "None recorded"}
        </p>
      </div>
      <div className="flex wrap">
        <Button
          variant="primary"
          disabled={busy || state.workspace.paused}
          onClick={() => void act({ type: "draft", proposalId })}
        >
          <FileText size={14} />
          Prepare follow-up
        </Button>
        {contact && (
          <Button
            variant={contact.humanTakeover ? "primary" : "danger"}
            disabled={busy}
            onClick={() =>
              void act({
                type: "takeover",
                contactId: contact.id,
                enabled: !contact.humanTakeover,
              })
            }
          >
            <UserRound size={14} />
            {contact.humanTakeover
              ? "Release human takeover"
              : "Take over conversation"}
          </Button>
        )}
      </div>
      <Evidence items={proposal.evidence} />
      <div>
        <h3 style={{ fontSize: 17, marginBottom: 16 }}>
          Prepared actions & receipts
        </h3>
        {!actions.length && (
          <p className="small muted">
            Prepare the follow-up to evaluate eligibility. An ineligible source
            record produces a clear block.
          </p>
        )}
        {actions.map((action) => {
          const approval = state.approvals.find(
            (item) => item.actionId === action.id,
          );
          const receipts = state.receipts.filter(
            (item) => item.actionId === action.id,
          );
          return (
            <div
              className="card card-body stack-small"
              style={{ marginBottom: 16 }}
              key={action.id}
            >
              <div className="between">
                <strong className="small">{words(action.type)}</strong>
                <Badge status={action.status} />
              </div>
              <p className="small">
                <strong>To:</strong> {action.payload.recipient}
                <br />
                <strong>Subject:</strong> {action.payload.subject}
              </p>
              <div
                className="prose"
                style={{ padding: 16, background: "#f8f9fb", borderRadius: 8 }}
              >
                {action.payload.body}
              </div>
              {action.type === "book_appointment" && (
                <div className="notice">
                  <Calendar size={17} />
                  <p>
                    Calendar: {action.payload.calendarId}
                    <br />
                    Start: {action.payload.startAt}
                    <br />
                    End: {action.payload.endAt}
                    <br />
                    Time zone: {action.payload.timeZone}
                  </p>
                </div>
              )}
              <p className="help">
                Exact-content approval:{" "}
                <strong>
                  {approval ? words(approval.status) : "Not registered"}
                </strong>
                <br />
                Approval expires: {dateTime(approval?.expiresAt ?? null)}
                <br />
                Payload fingerprint:{" "}
                <code style={{ overflowWrap: "anywhere" }}>
                  {action.payloadHash}
                </code>
              </p>
              <div className="flex wrap">
                {approval &&
                  activeApprovals(state).some(
                    (item) => item.id === approval.id,
                  ) && (
                    <>
                      <Button
                        variant="primary"
                        disabled={busy}
                        onClick={() =>
                          void act({ type: "approve", actionId: action.id })
                        }
                      >
                        <Check size={13} />
                        Approve exact action
                      </Button>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void act({ type: "reject", actionId: action.id })
                        }
                      >
                        Reject
                      </Button>
                    </>
                  )}
                {approval?.status === "approved" &&
                  action.status === "not_attempted" && (
                    <Button
                      variant="primary"
                      disabled={busy || state.workspace.paused}
                      onClick={() =>
                        void act({ type: "dispatch", actionId: action.id })
                      }
                    >
                      <Send size={13} />
                      {state.workspace.mode === "fixture"
                        ? "Run checked fixture action"
                        : "Dispatch approved action"}
                    </Button>
                  )}
                {action.status === "uncertain" && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void act({ type: "reconcile", actionId: action.id })
                    }
                  >
                    <Search size={13} />
                    Reconcile provider evidence
                  </Button>
                )}
              </div>
              {receipts.map((receipt) => (
                <div className="notice" key={receipt.id}>
                  <ShieldCheck size={17} />
                  <div>
                    <strong>
                      {words(receipt.status)} · {receipt.provider}
                    </strong>
                    <p>{receipt.message}</p>
                    <p className="tiny">
                      Provider reference: {receipt.providerId ?? "No reference"}{" "}
                      · Reconciliation: {words(receipt.reconciliation)}
                    </p>
                  </div>
                </div>
              ))}
              {action.type === "send_follow_up" && (
                <p className="help">
                  Provider acceptance is not proof of recipient delivery or a
                  business outcome.
                </p>
              )}
            </div>
          );
        })}
      </div>
      {state.workspace.mode === "fixture" && (
        <div className="card card-body stack-small">
          <div className="flex">
            <FlaskConical size={17} />
            <h3 style={{ fontSize: 15 }}>Fixture reply input</h3>
          </div>
          <p className="help">
            Inject a synthetic received reply to exercise stop, classification
            and handoff. Nothing enters a real mailbox.
          </p>
          <label className="field">
            Reply text
            <textarea
              className="input"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
            />
          </label>
          <Button
            disabled={busy || !reply.trim()}
            onClick={() =>
              void act({
                type: "reply",
                proposalId,
                text: reply,
                eventId: crypto.randomUUID(),
              })
            }
          >
            Record synthetic reply
          </Button>
        </div>
      )}
      <div className="card card-body stack-small">
        <h3 style={{ fontSize: 15 }}>Appointment handoff</h3>
        <p className="help">
          Use a clearly confirmed time with an explicit UTC offset. This creates
          an appointment proposal for review; availability is checked at
          dispatch.
        </p>
        <label className="field">
          Confirmed start (ISO timestamp with offset)
          <input
            className="input"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            placeholder="2026-09-14T10:00:00-06:00"
          />
        </label>
        <label className="field">
          Calendar time zone
          <input
            className="input"
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
            placeholder="America/Denver"
          />
        </label>
        <Button
          disabled={
            busy ||
            !Number.isFinite(Date.parse(startAt)) ||
            !/(Z|[+-]\d\d:\d\d)$/.test(startAt)
          }
          onClick={() =>
            void act({
              type: "book",
              proposalId,
              startAt: new Date(startAt).toISOString(),
              timeZone,
            })
          }
        >
          <Calendar size={14} />
          Prepare appointment for approval
        </Button>
        <p className="help">
          Booking does not prove attendance, proposal acceptance or payment.
        </p>
      </div>
    </div>
  );
}

function CsvImport({
  state,
  act,
  busy,
}: Pick<ScreenProps, "state" | "act" | "busy">) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<CommandResult["preview"]>();
  const [fileError, setFileError] = useState("");
  return (
    <div className="stack">
      <div className="notice">
        <Upload size={18} />
        <p>
          Required fields are validated by the import service. Use stable source
          IDs, an explicit current status, owner, contact email, proposal
          version/reference and approved factual scope. This import cannot
          enroll a real contact.
        </p>
      </div>
      <label className="field">
        Choose a CSV file
        <input
          className="input"
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
          style={{ minHeight: 200, fontFamily: "monospace", fontSize: 11 }}
          value={csv}
          onChange={(event) => {
            setCsv(event.target.value);
            setPreview(undefined);
          }}
          placeholder="Paste the header and source records here"
        />
      </label>
      <Button
        disabled={busy || !csv.trim()}
        onClick={async () => {
          const result = await act({ type: "import_csv", csv, preview: true });
          setPreview(result?.preview);
        }}
      >
        <Search size={14} />
        Validate & preview mapping
      </Button>
      {preview && (
        <div className="stack-small">
          <div className="between">
            <h3 style={{ fontSize: 16 }}>Import preview</h3>
            <Badge tone={preview.errors.length ? "warning" : "positive"}>
              {preview.valid} valid rows · {preview.errors.length} errors
            </Badge>
          </div>
          {preview.errors.map((error, index) => (
            <p className="notice notice-danger" key={index}>
              Row {error.row}: {error.message}
            </p>
          ))}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {Object.keys(preview.rows[0] ?? {}).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 5).map((row, index) => (
                  <tr key={index}>
                    {Object.values(row).map((value, i) => (
                      <td key={i}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="help">
            Preview shows up to five records. Target: {state.workspace.name}.
            Partial exports do not remove existing records.
          </p>
          <Button
            variant="primary"
            disabled={busy || preview.errors.length > 0 || !preview.valid}
            onClick={async () => {
              const result = await act({
                type: "import_csv",
                csv,
                preview: false,
              });
              if (result) setPreview(undefined);
            }}
          >
            Save validated records
          </Button>
        </div>
      )}
    </div>
  );
}

export function Decisions({
  state,
  act,
  busy,
  inspect,
  navigate,
}: ScreenProps) {
  const pending = activeApprovals(state);
  return (
    <div className="stack">
      <PageHeading
        eyebrow="Decide, then follow through"
        title="Turn a good decision into tracked work."
        description="Recommendations make the evidence, alternatives and resource commitment explicit. Approved initiatives retain their baseline, owner and review date."
      />
      {pending.length > 0 && (
        <section className="card card-body">
          <div className="between">
            <div>
              <h2 style={{ fontSize: 16 }}>
                {pending.length} exact-action{" "}
                {pending.length === 1 ? "approval" : "approvals"} waiting
              </h2>
              <p className="small muted" style={{ marginTop: 8 }}>
                Review the recipient, content and source version before granting
                permission.
              </p>
            </div>
            <Button variant="primary" onClick={() => navigate("opportunities")}>
              Review prepared actions
              <ArrowRight size={14} />
            </Button>
          </div>
        </section>
      )}
      <section>
        <div className="section-heading">
          <h2>Recommendations</h2>
          <span>Evidence → hypothesis → decision</span>
        </div>
        <div className="grid-two">
          {state.findings.map((f) => (
            <article className="card card-body stack-small" key={f.id}>
              <div className="between">
                <Badge status={f.status} />
                <span className="eyebrow">Review {shortDate(f.reviewAt)}</span>
              </div>
              <h3 style={{ fontSize: 18, lineHeight: 1.4 }}>{f.title}</h3>
              <p className="small muted">{f.observedCondition}</p>
              <div
                style={{ background: "#f8f9fb", padding: 16, borderRadius: 8 }}
              >
                <span className="eyebrow">Working hypothesis</span>
                <p className="small" style={{ marginTop: 8 }}>
                  {f.hypothesis}
                </p>
              </div>
              <dl
                className="small"
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 1fr",
                  gap: "8px 14px",
                  margin: "4px 0",
                }}
              >
                <dt className="muted">Baseline</dt>
                <dd style={{ margin: 0 }}>{f.baseline}</dd>
                <dt className="muted">Target</dt>
                <dd style={{ margin: 0 }}>{f.target}</dd>
                <dt className="muted">Commitment</dt>
                <dd style={{ margin: 0 }}>
                  {f.effortMinutes} min · {money(f.costMinor)}
                </dd>
                <dt className="muted">Owner</dt>
                <dd style={{ margin: 0 }}>{f.owner}</dd>
                <dt className="muted">Success rule</dt>
                <dd style={{ margin: 0 }}>{f.evaluationRule}</dd>
              </dl>
              <details className="small muted">
                <summary style={{ cursor: "pointer" }}>
                  Alternatives considered
                </summary>
                <ul>
                  {f.alternatives.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
              <div className="between" style={{ marginTop: 10 }}>
                <button
                  className="link-button"
                  onClick={() =>
                    inspect(f.title, f.observedCondition, f.evidence)
                  }
                >
                  View evidence
                  <ArrowUpRight size={13} />
                </button>
                <Button
                  variant="primary"
                  className="btn-small"
                  disabled={busy || f.status !== "proposed"}
                  onClick={() =>
                    void act({ type: "approve_finding", findingId: f.id })
                  }
                >
                  {f.status === "proposed"
                    ? "Approve initiative"
                    : "Decision saved"}
                  <Check size={13} />
                </Button>
              </div>
            </article>
          ))}
        </div>
        {!state.findings.length && (
          <div className="card">
            <Empty title="No recommendations yet">
              Import current records and resolve source gaps to make useful
              observations.
            </Empty>
          </div>
        )}
      </section>
      <section className="card">
        <div className="card-head">
          <h2>Tracked initiatives</h2>
          <Badge tone="info">{state.initiatives.length} initiatives</Badge>
        </div>
        {state.initiatives.map((initiative) => (
          <div
            className="card-body"
            key={initiative.id}
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="between">
              <h3 style={{ fontSize: 17 }}>{initiative.title}</h3>
              <Badge status={initiative.status} />
            </div>
            <div className="grid-two" style={{ marginTop: 16 }}>
              <div className="small muted">
                Owner: {initiative.owner}
                <br />
                Baseline: {initiative.baseline}
                <br />
                Target: {initiative.target}
                <br />
                Review date: {dateTime(initiative.reviewAt)}
              </div>
              <div>
                <p className="small">Assignments</p>
                <ul className="small muted">
                  {initiative.assignments.map((item) => (
                    <li key={item}>
                      {state.catalog.find((a) => a.id === item)?.name ?? item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <InitiativeReview id={initiative.id} act={act} busy={busy} />
          </div>
        ))}
        {!state.initiatives.length && (
          <Empty title="Your next initiative starts with a decision">
            Approve a recommendation to create assignments and an accountable
            review.
          </Empty>
        )}
      </section>
    </div>
  );
}
function InitiativeReview({
  id,
  act,
  busy,
}: {
  id: string;
  act: ScreenProps["act"];
  busy: boolean;
}) {
  const [result, setResult] = useState<
    "supported" | "unsupported" | "inconclusive"
  >("inconclusive");
  return (
    <div className="flex wrap" style={{ marginTop: 16 }}>
      <label className="field" style={{ flex: 1 }}>
        Review against the original hypothesis
        <select
          className="input"
          value={result}
          onChange={(event) => setResult(event.target.value as typeof result)}
        >
          <option value="inconclusive">
            Inconclusive — insufficient evidence
          </option>
          <option value="supported">Supported by observed evidence</option>
          <option value="unsupported">
            Not supported by observed evidence
          </option>
        </select>
      </label>
      <Button
        style={{ marginTop: 24 }}
        disabled={busy}
        onClick={() =>
          void act({ type: "review_initiative", initiativeId: id, result })
        }
      >
        Record review
      </Button>
    </div>
  );
}

export function CustomerJourney({ state, act, busy, inspect }: ScreenProps) {
  const [selected, setSelected] = useState(state.proposals[0]?.id ?? "");
  const proposal = state.proposals.find((item) => item.id === selected);
  const contact = state.contacts.find(
    (item) => item.id === proposal?.contactId,
  );
  const events = state.timeline
    .filter((item) => item.opportunityId === proposal?.opportunityId)
    .sort((a, b) => a.at.localeCompare(b.at));
  const outcomes = state.outcomes.filter(
    (item) => item.opportunityId === proposal?.opportunityId,
  );
  return (
    <div className="stack">
      <PageHeading
        eyebrow="One relationship. A shared history."
        title="The whole customer journey."
        description="Source facts, DAVID actions, human decisions and outcome evidence live together. A booking stays a booking until separate attendance or financial evidence arrives."
      />
      <label className="field" style={{ maxWidth: 500 }}>
        Customer / proposal
        <select
          className="input"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {state.proposals.map((item) => (
            <option key={item.id} value={item.id}>
              {state.contacts.find((c) => c.id === item.contactId)?.account} ·{" "}
              {item.reference}
            </option>
          ))}
        </select>
      </label>
      {proposal ? (
        <>
          <div className="card card-body">
            <div className="between">
              <div className="flex">
                <div className="agent-symbol red">
                  <Users size={21} />
                </div>
                <div>
                  <h2 style={{ fontSize: 20 }}>{contact?.account}</h2>
                  <p className="small muted" style={{ marginTop: 4 }}>
                    {contact?.name} · {contact?.email}
                  </p>
                </div>
              </div>
              <Badge status={proposal.status} />
            </div>
            <div className="grid-two" style={{ marginTop: 24 }}>
              <div className="small muted">
                Proposal {proposal.reference}, version {proposal.version}
                <br />
                {money(proposal.amountMinor, proposal.currency)} ·{" "}
                {words(proposal.valueKind)}
                <br />
                Source owner: {proposal.owner}
              </div>
              <div className="small muted">
                Conversation owner: {contact?.owner ?? "Unassigned"}
                <br />
                Human takeover:{" "}
                {contact?.humanTakeover
                  ? "Active — automatic dispatch blocked"
                  : "Not active"}
                <br />
                Scope: {proposal.scopeSummary}
              </div>
            </div>
            {contact && (
              <Button
                className="btn-small"
                style={{ marginTop: 20 }}
                disabled={busy}
                onClick={() =>
                  void act({
                    type: "takeover",
                    contactId: contact.id,
                    enabled: !contact.humanTakeover,
                  })
                }
              >
                <UserRound size={13} />
                {contact.humanTakeover
                  ? "Release human takeover"
                  : "Take over conversation"}
              </Button>
            )}
          </div>
          <div className="grid-two">
            <section className="card card-body">
              <h2 style={{ fontSize: 16, marginBottom: 26 }}>
                Shared timeline
              </h2>
              <div className="timeline">
                {events.map((event) => (
                  <article className="timeline-item" key={event.id}>
                    <div className="flex wrap">
                      <span className="tiny muted">{dateTime(event.at)}</span>
                      <Badge
                        tone={
                          event.actor === "david"
                            ? "info"
                            : event.actor === "human"
                              ? "positive"
                              : "warning"
                        }
                      >
                        {event.actor === "david"
                          ? "DAVID"
                          : event.actor === "human"
                            ? "Human action"
                            : "Source record"}
                      </Badge>
                    </div>
                    <h3>{event.title}</h3>
                    <p>{event.detail}</p>
                    <button
                      className="link-button"
                      style={{ marginTop: 10 }}
                      onClick={() =>
                        inspect(event.title, event.detail, event.evidence)
                      }
                    >
                      View source evidence
                      <ArrowUpRight size={12} />
                    </button>
                  </article>
                ))}
              </div>
              {!events.length && (
                <Empty title="No interactions recorded">
                  The source record is available. Future events appear here with
                  their actor and evidence.
                </Empty>
              )}
            </section>
            <section className="stack">
              <div className="card card-body">
                <h2 style={{ fontSize: 16, marginBottom: 18 }}>
                  Outcome evidence
                </h2>
                {[
                  "reply",
                  "booked",
                  "attended",
                  "signed",
                  "completed",
                  "invoiced",
                  "paid",
                ].map((stage) => {
                  const records = outcomes.filter(
                    (item) => item.stage === stage,
                  );
                  return (
                    <div
                      className="between"
                      key={stage}
                      style={{
                        padding: "13px 0",
                        borderBottom: "1px solid #eef0f3",
                      }}
                    >
                      <span
                        className="small"
                        style={{ textTransform: "capitalize" }}
                      >
                        {stage}
                      </span>
                      {records.length ? (
                        <button
                          className="link-button"
                          onClick={() =>
                            inspect(
                              `${words(stage)} evidence`,
                              "Only evidence for this opportunity and this specific outcome stage.",
                              records.flatMap((item) => item.evidence),
                            )
                          }
                        >
                          {records.length}{" "}
                          {state.workspace.mode === "fixture"
                            ? "fixture"
                            : "recorded"}{" "}
                          observation{records.length === 1 ? "" : "s"}
                          <ArrowUpRight size={12} />
                        </button>
                      ) : (
                        <Badge tone="warning">No evidence</Badge>
                      )}
                    </div>
                  );
                })}
                <p className="help" style={{ marginTop: 16 }}>
                  Unknown outcomes remain unknown. Proposal value is counted
                  once regardless of the number of contributing specialists.
                </p>
              </div>
              <div className="card card-body">
                <h2 style={{ fontSize: 16 }}>Source record</h2>
                <Evidence items={proposal.evidence} />
              </div>
              {["workspace_owner", "david_operator"].includes(
                state.context.role,
              ) && (
                <OutcomeConfirmation
                  state={state}
                  act={act}
                  busy={busy}
                  proposalId={proposal.id}
                />
              )}
            </section>
          </div>
        </>
      ) : (
        <div className="card">
          <Empty title="No customer records yet">
            Import a proposal to create a source-linked journey.
          </Empty>
        </div>
      )}
    </div>
  );
}

function OutcomeConfirmation({
  state,
  act,
  busy,
  proposalId,
}: Pick<ScreenProps, "state" | "act" | "busy"> & { proposalId: string }) {
  const [stage, setStage] = useState<
    "attended" | "signed" | "completed" | "invoiced" | "paid"
  >("attended");
  const [reference, setReference] = useState("");
  const [value, setValue] = useState("1");
  const [at, setAt] = useState(state.asOf);
  const financial = !["attended", "completed"].includes(stage);
  return (
    <form
      className="card card-body stack-small"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await act({
          type: "record_outcome",
          proposalId,
          stage,
          value:
            value === ""
              ? null
              : financial
                ? Math.round(Number(value) * 100)
                : Number(value),
          currency: financial ? state.workspace.currency : null,
          reference,
          observedAt: new Date(at).toISOString(),
        });
        if (result) setReference("");
      }}
    >
      <h2 style={{ fontSize: 16 }}>Record a responsible-person confirmation</h2>
      <p className="help">
        Use a source reference and the actual observation time. This is labeled{" "}
        {state.workspace.mode === "fixture"
          ? "fixture evidence"
          : "manually reported"}{" "}
        until independently reconciled. It does not become provider-verified
        evidence.
      </p>
      <label className="field">
        Outcome stage
        <select
          className="input"
          value={stage}
          onChange={(e) => {
            setStage(e.target.value as typeof stage);
            setValue(
              ["attended", "completed"].includes(e.target.value) ? "1" : "",
            );
          }}
        >
          <option value="attended">Meeting attended</option>
          <option value="signed">Proposal signed</option>
          <option value="completed">Work completed</option>
          <option value="invoiced">Amount invoiced</option>
          <option value="paid">Payment collected</option>
        </select>
      </label>
      <label className="field">
        {financial
          ? `Amount (${state.workspace.currency}; blank means unknown)`
          : "Confirmed count (0 or 1)"}
        <input
          className="input"
          type="number"
          min="0"
          max={financial ? undefined : 1}
          step={financial ? ".01" : "1"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Unknown"
        />
      </label>
      <label className="field">
        Source reference and confirmation details
        <textarea
          className="input"
          minLength={3}
          maxLength={500}
          required
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Reference the attendance confirmation, signed proposal, job record or payment receipt."
        />
      </label>
      <label className="field">
        Observed at (ISO timestamp with UTC offset)
        <input
          className="input"
          required
          value={at}
          onChange={(e) => setAt(e.target.value)}
        />
      </label>
      <Button
        type="submit"
        disabled={
          busy ||
          reference.trim().length < 3 ||
          !Number.isFinite(Date.parse(at)) ||
          !/(Z|[+-]\d\d:\d\d)$/.test(at)
        }
      >
        Save labeled confirmation
        <Check size={14} />
      </Button>
    </form>
  );
}

export function Scenarios({ state, act, busy }: ScreenProps) {
  const makeScenario = (): ForecastScenario => ({
    id: crypto.randomUUID(),
    workspaceId: state.workspace.id,
    version: 1,
    name: "Proposal recovery · planning scenario",
    businessModel: state.workspace.businessModel,
    currency: state.workspace.currency,
    horizonDays: 90,
    volume: 100,
    cohort: "recovery",
    overlapResolved: true,
    conversions: [
      { label: "Qualified conversations", low: 0.1, base: 0.2, high: 0.3 },
      { label: "Bookings", low: 0.4, base: 0.5, high: 0.6 },
      { label: "Held meetings", low: 0.7, base: 0.8, high: 0.9 },
      { label: "Wins", low: 0.2, base: 0.3, high: 0.4 },
    ],
    capacity: 12,
    valueMinor: 500000,
    spendMinor: null,
    baselineWins: null,
    counterfactual: null,
    assumptions: [
      "Illustrative input assumptions; replace with source-backed baseline.",
    ],
    createdAt: state.asOf,
  });
  const [scenario, setScenario] = useState<ForecastScenario>(
    () => state.scenarios[0] ?? makeScenario(),
  );
  const [validation, setValidation] = useState("");
  let cases: ReturnType<typeof forecastCases> = [];
  let scenarioError = "";
  try {
    cases = forecastCases(scenario);
  } catch (error) {
    scenarioError =
      error instanceof Error ? error.message : "Review invalid assumptions.";
  }
  const base = cases.find((item) => item.case === "base");
  const set = <K extends keyof ForecastScenario>(
    key: K,
    value: ForecastScenario[K],
  ) => {
    setScenario((current) => ({ ...current, [key]: value }));
    setValidation("");
  };
  const save = async () => {
    if (scenarioError) {
      setValidation(
        "Review conversion ranges, unit value and cohort overlap before saving.",
      );
      return;
    }
    const previous = state.scenarios.find((item) => item.id === scenario.id);
    const result = await act({
      type: "save_scenario",
      scenario: { ...scenario, version: previous ? previous.version + 1 : 1 },
    });
    if (result) {
      const saved = result.snapshot.scenarios.find(
        (item) => item.id === scenario.id,
      );
      if (saved) setScenario(saved);
    }
  };
  return (
    <div className="stack">
      <PageHeading
        eyebrow="Planning, with the assumptions in view"
        title="One funnel. Three possible cases."
        description="Explore low, base and high cases with a shared cohort and a real capacity constraint. These are planning scenarios, separate from recorded business outcomes."
        action={
          <Button
            variant="primary"
            disabled={busy || !!scenarioError}
            onClick={() => void save()}
          >
            <Check size={14} />
            Save scenario
          </Button>
        }
      />
      <div className="notice notice-warning">
        <FlaskConical size={18} />
        <div>
          <strong>Illustrative projections, not observed results.</strong> A
          website profile does not establish conversion rates. Incremental ROI
          requires an explicit baseline, counterfactual and complete cost basis.
        </div>
      </div>
      <div className="between">
        <label className="field" style={{ flex: 1, maxWidth: 500 }}>
          Saved scenarios
          <select
            className="input"
            value={
              state.scenarios.some((item) => item.id === scenario.id)
                ? scenario.id
                : ""
            }
            onChange={(event) => {
              const saved = state.scenarios.find(
                (item) => item.id === event.target.value,
              );
              if (saved) setScenario(saved);
            }}
          >
            <option value="" disabled>
              Unsaved scenario
            </option>
            {state.scenarios.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · v{item.version}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={() =>
            setScenario({
              ...scenario,
              id: crypto.randomUUID(),
              version: 1,
              name: `${scenario.name} · copy`,
              createdAt: state.asOf,
            })
          }
        >
          <Plus size={14} />
          Duplicate scenario
        </Button>
      </div>
      <div className="card card-body stack">
        <h2 style={{ fontSize: 17 }}>Shared assumptions</h2>
        <div className="grid-two">
          <label className="field">
            Scenario name
            <input
              className="input"
              value={scenario.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label className="field">
            Cohort
            <select
              className="input"
              value={scenario.cohort}
              onChange={(e) =>
                set("cohort", e.target.value as ForecastScenario["cohort"])
              }
            >
              <option value="recovery">
                Existing opportunities · recovery
              </option>
              <option value="new_demand">
                New demand · reachable inquiries
              </option>
            </select>
          </label>
        </div>
        <div className="grid-two">
          <div className="grid-two" style={{ gap: 16 }}>
            <label className="field">
              Starting volume
              <input
                className="input"
                type="number"
                min="0"
                max="1000000"
                value={scenario.volume}
                onChange={(e) => set("volume", Number(e.target.value))}
              />
            </label>
            <label className="field">
              Time horizon (days)
              <input
                className="input"
                type="number"
                min="1"
                max="730"
                value={scenario.horizonDays}
                onChange={(e) => set("horizonDays", Number(e.target.value))}
              />
            </label>
          </div>
          <div className="grid-two" style={{ gap: 16 }}>
            <label className="field">
              Fulfillment capacity (wins)
              <input
                className="input"
                type="number"
                min="0"
                value={scenario.capacity}
                onChange={(e) => set("capacity", Number(e.target.value))}
              />
            </label>
            <label className="field">
              Currency
              <input
                className="input"
                maxLength={3}
                value={scenario.currency}
                onChange={(e) => set("currency", e.target.value.toUpperCase())}
              />
            </label>
          </div>
        </div>
        <div className="grid-two">
          <label className="field">
            Value per win ({scenario.currency}, currency units)
            <input
              className="input"
              type="number"
              min="0"
              step=".01"
              value={
                scenario.valueMinor === null ? "" : scenario.valueMinor / 100
              }
              placeholder="Unknown"
              onChange={(e) =>
                set(
                  "valueMinor",
                  e.target.value === ""
                    ? null
                    : Math.round(Number(e.target.value) * 100),
                )
              }
            />
          </label>
          <label className="field">
            Total planning spend ({scenario.currency}, optional)
            <input
              className="input"
              type="number"
              min="0"
              step=".01"
              value={
                scenario.spendMinor === null ? "" : scenario.spendMinor / 100
              }
              placeholder="Unknown — ROI unavailable"
              onChange={(e) =>
                set(
                  "spendMinor",
                  e.target.value === ""
                    ? null
                    : Math.round(Number(e.target.value) * 100),
                )
              }
            />
          </label>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={scenario.overlapResolved}
            onChange={(e) => set("overlapResolved", e.target.checked)}
          />
          This is one distinct cohort; overlapping new-demand and recovery
          records have been resolved.
        </label>
      </div>
      <div className="grid-two">
        <section className="card card-body stack-small">
          <h2 style={{ fontSize: 17, marginBottom: 10 }}>Stage conversions</h2>
          <div className="conversion-grid">
            <span className="eyebrow">Shared funnel</span>
            <span className="eyebrow">Low %</span>
            <span className="eyebrow">Base %</span>
            <span className="eyebrow">High %</span>
            {scenario.conversions.map((conversion, index) => (
              <div key={index} style={{ display: "contents" }}>
                <label className="small" htmlFor={`stage-${index}-base`}>
                  {conversion.label}
                </label>
                {(["low", "base", "high"] as const).map((key) => (
                  <input
                    className="input numeric"
                    id={`stage-${index}-${key}`}
                    key={key}
                    aria-label={`${conversion.label} ${key} conversion percent`}
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(conversion[key] * 10000) / 100}
                    onChange={(e) =>
                      set(
                        "conversions",
                        scenario.conversions.map((item, i) =>
                          i === index
                            ? { ...item, [key]: Number(e.target.value) / 100 }
                            : item,
                        ),
                      )
                    }
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="help">
            Each stage converts from the preceding stage. Low ≤ base ≤ high.
            Final wins cannot exceed available business capacity.
          </p>
        </section>
        <section className="card card-body">
          <h2 style={{ fontSize: 17, marginBottom: 18 }}>Base case flow</h2>
          {base?.stages.map((stage, index) => (
            <div className="funnel-row" key={index}>
              <span>{stage.label}</span>
              <div className="funnel-track">
                <div
                  className="funnel-bar"
                  style={{
                    width: `${scenario.volume ? Math.max(0, (stage.volume / scenario.volume) * 100) : 0}%`,
                    opacity: 1 - index * 0.12,
                  }}
                />
              </div>
              <span className="numeric">{stage.volume.toFixed(1)}</span>
            </div>
          ))}
          {base && (
            <p className="help" style={{ marginTop: 20 }}>
              Capacity-adjusted final outcome: {base.wins.toFixed(1)} wins /{" "}
              {scenario.horizonDays} days.
              {base.capacityLimited
                ? " Capacity constrains the final stage."
                : ""}
            </p>
          )}
          {scenarioError && (
            <div className="notice notice-danger" role="alert">
              <AlertCircle size={18} />
              <p>
                Review conversion ranges, explicit unit value, capacity and
                cohort overlap.{" "}
                {scenarioError.length < 200 ? scenarioError : ""}
              </p>
            </div>
          )}
        </section>
      </div>
      <div className="readiness-grid">
        {cases.map((item) => (
          <section
            className={`scenario-case ${item.case === "base" ? "featured" : ""}`}
            key={item.case}
          >
            <div className="between">
              <span className="eyebrow">{item.case} case</span>
              <Badge tone="warning">Scenario</Badge>
            </div>
            <div className="scenario-number numeric">
              {item.wins.toFixed(1)} <span className="small muted">wins</span>
            </div>
            <p className="small">
              {money(item.revenueMinor, scenario.currency)} projected value
            </p>
            <p className="help" style={{ marginTop: 10 }}>
              {item.capacityLimited
                ? "Capacity limit applied"
                : "Within stated capacity"}
              <br />
              Incremental ROI:{" "}
              {item.incrementalRoi === null
                ? "Unavailable"
                : `${(item.incrementalRoi * 100).toFixed(1)}%`}
            </p>
          </section>
        ))}
      </div>
      <div className="card card-body stack">
        <h2 style={{ fontSize: 17 }}>Baseline & comparison</h2>
        <div className="grid-two">
          <label className="field">
            Baseline wins in the same time horizon
            <input
              className="input"
              type="number"
              min="0"
              step=".1"
              value={scenario.baselineWins ?? ""}
              placeholder="Unknown"
              onChange={(e) =>
                set(
                  "baselineWins",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label className="field">
            Counterfactual / what would happen otherwise
            <input
              className="input"
              value={scenario.counterfactual ?? ""}
              placeholder="Explain the baseline and evidence"
              onChange={(e) => set("counterfactual", e.target.value || null)}
            />
          </label>
        </div>
        <label className="field">
          Assumptions and source limitations
          <textarea
            className="input"
            value={scenario.assumptions.join("\n")}
            onChange={(e) => set("assumptions", e.target.value.split("\n"))}
          />
        </label>
        <div className="notice">
          <BookOpen size={18} />
          <p>
            Observed comparison is unavailable until a matching cohort, period
            and verified win outcome are available. Current replies and bookings
            are different stages; they cannot be substituted for wins.
          </p>
        </div>
        {validation && (
          <p className="notice notice-danger" role="alert">
            {validation}
          </p>
        )}
        <div className="between">
          <span className="help">
            Version {scenario.version} · {scenario.horizonDays} days ·{" "}
            {scenario.currency}
          </span>
          <Button
            variant="primary"
            disabled={busy || !!scenarioError}
            onClick={() => void save()}
          >
            Save assumptions
            <Check size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Connections({ state, navigate }: ScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const connection = state.connections.find((item) => item.id === selected);
  const [connecting, setConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [scopes, setScopes] = useState<Array<"sheets" | "mail" | "calendar">>([
    "sheets",
  ]);
  const connect = async () => {
    setConnecting(true);
    setConnectionMessage("");
    try {
      const response = await fetch("/api/google/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: state.workspace.id,
          capabilities: scopes,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ??
            result.error ??
            "Google authorization could not start.",
        );
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "accounts.google.com")
        throw new Error(
          "An unexpected authorization destination was rejected.",
        );
      window.location.assign(url.toString());
    } catch (error) {
      setConnectionMessage(
        error instanceof Error ? error.message : "Connection failed.",
      );
    } finally {
      setConnecting(false);
    }
  };
  const disconnect = async () => {
    if (!connection) return;
    setConnecting(true);
    try {
      const response = await fetch("/api/google/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: state.workspace.id,
          connectionId: connection.id,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ??
            result.error ??
            "Connection could not be disconnected.",
        );
      setConnectionMessage(
        result.message ??
          "Connection disconnected. Further access is stopped. The workspace refreshes automatically.",
      );
    } catch (error) {
      setConnectionMessage(
        error instanceof Error ? error.message : "Disconnect failed.",
      );
    } finally {
      setConnecting(false);
    }
  };
  return (
    <div className="stack">
      <PageHeading
        eyebrow="Permission is a specific capability"
        title="Know what your team can access."
        description="Each connection binds an account, a resource and a permitted operation. Integration, action and measurement readiness are independent checks."
        action={
          <Button onClick={() => navigate("activation")}>
            Review activation
            <ArrowRight size={14} />
          </Button>
        }
      />
      <div className="readiness-grid">
        {[
          {
            label: "Integration readiness",
            value: state.readiness.integration,
            description: "Required accounts, scopes and bound resources.",
          },
          {
            label: "Action readiness",
            value: state.readiness.action,
            description:
              "Current policy, fresh facts, ownership and authority.",
          },
          {
            label: "Measurement readiness",
            value: state.readiness.measurement,
            description: "Evidence sources for the outcome being claimed.",
          },
        ].map((item) => (
          <div className="card readiness-card" key={item.label}>
            <div className="between">
              <h2 style={{ fontSize: 14 }}>{item.label}</h2>
              {item.value ? (
                <ShieldCheck size={19} color="var(--positive)" />
              ) : (
                <AlertCircle size={19} color="var(--warning)" />
              )}
            </div>
            <p className="help" style={{ margin: "12px 0" }}>
              {item.description}
            </p>
            <Badge status={item.value ? "verified" : "blocked"} />
          </div>
        ))}
      </div>
      <section className="card card-body stack-small">
        <h2 style={{ fontSize: 17 }}>Connect a Google Workspace account</h2>
        <p className="small muted">
          Select the specific capability you need. Google sign-in for DAVID and
          authorization to access customer systems are separate.
        </p>
        <div className="flex wrap">
          {(["sheets", "mail", "calendar"] as const).map((capability) => (
            <label key={capability} className="check-row">
              <input
                type="checkbox"
                checked={scopes.includes(capability)}
                disabled={state.workspace.mode === "fixture"}
                onChange={(e) =>
                  setScopes((current) =>
                    e.target.checked
                      ? [...current, capability]
                      : current.filter((item) => item !== capability),
                  )
                }
              />
              {capability === "sheets"
                ? "Selected Sheets"
                : capability === "mail"
                  ? "Gmail send & replies"
                  : "Owned calendars"}
            </label>
          ))}
        </div>
        <div className="notice notice-warning">
          <ShieldCheck size={18} />
          <p>
            {state.workspace.mode === "fixture"
              ? "Google authorization is disabled in fixture mode. Configure a hosted nonproduction project and authenticated operator before connecting a real account."
              : "Sheets uses drive.file for selected files; the initial Calendar grant supports owned calendars. Gmail reply reading requests mailbox-wide restricted access even though DAVID processes only enrolled conversations. Review the actual consent grant before continuing."}
          </p>
        </div>
        <div>
          <Button
            disabled={
              state.workspace.mode === "fixture" || connecting || !scopes.length
            }
            onClick={() => void connect()}
          >
            <ShieldCheck size={14} />
            {connecting
              ? "Starting authorization…"
              : "Review Google authorization"}
          </Button>
        </div>
        {connectionMessage && (
          <p className="notice" role="status">
            {connectionMessage}
          </p>
        )}
      </section>
      <SourceSetup state={state} />
      <section className="card">
        <div className="card-head">
          <h2>Bound accounts & sources</h2>
          <span className="tiny muted">
            Last checked {dateTime(state.readiness.evaluatedAt)}
          </span>
        </div>
        {state.connections.map((item) => {
          const stale =
            !!item.lastSyncAt &&
            Date.parse(state.asOf) - Date.parse(item.lastSyncAt) >
              item.freshnessSeconds * 1000;
          return (
            <article className="work-row" key={item.id}>
              <div
                className={`agent-symbol ${item.provider === "google" ? "blue" : ""}`}
              >
                {item.operations.some((op) => /calendar|book/.test(op)) ? (
                  <Calendar size={19} />
                ) : item.operations.some((op) =>
                    /gmail|send|reply/.test(op),
                  ) ? (
                  <Mail size={19} />
                ) : (
                  <FileText size={19} />
                )}
              </div>
              <div className="work-copy">
                <div className="between">
                  <h3>{item.identity}</h3>
                  <Badge status={stale ? "stale" : item.health} />
                </div>
                <p>{item.resource}</p>
                <p>
                  Owner: {item.owner} · {words(item.provider)} provider
                </p>
                <div className="flex wrap" style={{ gap: 6, marginTop: 10 }}>
                  {item.operations.map((operation) => (
                    <Badge key={operation} tone="info">
                      {operation}
                    </Badge>
                  ))}
                </div>
                <p style={{ marginTop: 12 }}>
                  Last sync: {dateTime(item.lastSyncAt)} · Freshness limit:{" "}
                  {Math.round(item.freshnessSeconds / 60)} min
                </p>
              </div>
              <Button
                className="btn-small"
                onClick={() => setSelected(item.id)}
              >
                Inspect
                <ArrowUpRight size={12} />
              </Button>
            </article>
          );
        })}
        {!state.connections.length && (
          <Empty title="No bound connections">
            Continue activation to identify the precise accounts, permissions
            and source owners needed.
          </Empty>
        )}
      </section>
      <section className="card card-body">
        <h2 style={{ fontSize: 17, marginBottom: 8 }}>
          Readiness blockers & accountable next steps
        </h2>
        {state.readiness.blockers.map((blocker) => (
          <article className="prerequisite" key={blocker.code}>
            <div className="between">
              <h3 style={{ fontSize: 14 }}>{blocker.message}</h3>
              <Badge tone="warning">{blocker.dimension}</Badge>
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>
              Owner: {blocker.owner}
            </p>
            <p className="small" style={{ marginTop: 8 }}>
              {blocker.nextStep}
            </p>
          </article>
        ))}
        {!state.readiness.blockers.length && (
          <div className="notice">
            <CheckCircle2 size={18} />
            <p>
              No current blockers. Each action rechecks its own readiness
              immediately before dispatch.
            </p>
          </div>
        )}
      </section>
      <Drawer
        open={!!connection}
        onClose={() => setSelected(null)}
        title={connection?.identity ?? "Connection"}
        description="A successful sign-in does not automatically grant Gmail, Sheets or Calendar integration permissions."
      >
        {connection && (
          <div className="stack">
            <Badge status={connection.health} />
            <dl
              className="small"
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1fr",
                gap: "12px 16px",
                margin: 0,
              }}
            >
              <dt className="muted">Provider</dt>
              <dd style={{ margin: 0 }}>{connection.provider}</dd>
              <dt className="muted">Resource</dt>
              <dd style={{ margin: 0, overflowWrap: "anywhere" }}>
                {connection.resource}
              </dd>
              <dt className="muted">Source owner</dt>
              <dd style={{ margin: 0 }}>{connection.owner}</dd>
              <dt className="muted">Last verified</dt>
              <dd style={{ margin: 0 }}>{dateTime(connection.verifiedAt)}</dd>
              <dt className="muted">Last sync</dt>
              <dd style={{ margin: 0 }}>{dateTime(connection.lastSyncAt)}</dd>
            </dl>
            <div>
              <h3 style={{ fontSize: 15 }}>Granted scopes</h3>
              <div
                className="small muted"
                style={{ marginTop: 10, overflowWrap: "anywhere" }}
              >
                {connection.scopes.length
                  ? connection.scopes.map((scope) => <p key={scope}>{scope}</p>)
                  : "No verified provider scopes."}
              </div>
            </div>
            <div className="notice notice-warning">
              <AlertCircle size={18} />
              <div>
                {state.workspace.mode === "fixture"
                  ? "This is a synthetic connection. To enable real Google access, an authorized operator must configure the OAuth client, consent audience, resource bindings and Vault token lifecycle in a hosted nonproduction project."
                  : "Connection setup requires an authorized operator to verify the OAuth client, consent audience, selected resources and required scopes. Revoked or expired access blocks affected actions until reauthorized."}
              </div>
            </div>
            {state.workspace.mode !== "fixture" &&
              connection.provider === "google" && (
                <div className="flex wrap">
                  <Button disabled={connecting} onClick={() => void connect()}>
                    Reauthorize selected capabilities
                  </Button>
                  <Button
                    variant="danger"
                    disabled={connecting || connection.health === "revoked"}
                    onClick={() => void disconnect()}
                  >
                    Disconnect this account
                  </Button>
                </div>
              )}
            <h3 style={{ fontSize: 15 }}>Exact setup needed</h3>
            <ol
              className="small muted"
              style={{ paddingLeft: 20, lineHeight: 1.9 }}
            >
              <li>
                Confirm the Google organization, approved sender, Sheet
                file/tab/range and calendar with their source owners.
              </li>
              <li>
                Configure the dedicated integration OAuth client and approved
                callback, with Gmail send/read and precise Sheet/Calendar
                scopes.
              </li>
              <li>
                Store connection credentials through the server-side Vault
                lifecycle and bind only the selected resources.
              </li>
              <li>
                Verify fresh reads, reply synchronization and checked test
                actions with authorized recipients and calendar.
              </li>
              <li>
                Record the live cohort, exception operator, working hours and
                release review.
              </li>
            </ol>
            <Button
              onClick={() => {
                setSelected(null);
                navigate("activation");
              }}
            >
              Open activation prerequisites
              <ArrowRight size={14} />
            </Button>
          </div>
        )}
      </Drawer>
    </div>
  );
}

export function Operator({ state, act, busy, inspect }: ScreenProps) {
  const [category, setCategory] =
    useState<UsageRecord["category"]>("recurring_support");
  const [minutes, setMinutes] = useState(15);
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const economics = deliveryEconomics(
    state.workspace.subscriptionMinor,
    state.usage,
  );
  const uncertain = state.actions.filter(
    (item) => item.status === "uncertain" || item.status === "submitting",
  );
  if (
    state.context.role !== "david_operator" &&
    state.workspace.mode !== "fixture"
  )
    return (
      <div className="card">
        <Empty title="Assigned operator access required">
          This console is available to an assigned DAVID operator with the
          required authentication assurance. Ask your workspace owner to contact
          the assigned operator.
        </Empty>
      </div>
    );
  return (
    <div className="stack">
      <PageHeading
        eyebrow="Assigned workspace operations"
        title="Keep the work accountable."
        description="Inspect runtime health separately from source access and successful business actions. Resolve uncertainty, record human work and understand delivery cost."
        action={
          <Button
            variant={state.workspace.paused ? "primary" : "danger"}
            disabled={busy}
            onClick={() =>
              void act({ type: "pause", paused: !state.workspace.paused })
            }
          >
            {state.workspace.paused ? <Play size={14} /> : <Pause size={14} />}{" "}
            {state.workspace.paused ? "Validate & resume" : "Pause immediately"}
          </Button>
        }
      />
      <div className="notice">
        <ShieldCheck size={18} />
        <div>
          <strong>{state.workspace.name}</strong> · Explicit operator assignment
          · {state.context.assurance.toUpperCase()}
          <br />
          Authentication, tenant authorization and action limits are enforced by
          the server. A green scheduler is not a successful customer outcome.
        </div>
      </div>
      <section className="card">
        <div className="card-head">
          <h2>Runtime & provider health</h2>
          <Badge tone="info">Component-level evidence</Badge>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Component / coverage</th>
                <th>Health</th>
                <th>Last technical success</th>
                <th>Preparation / business action</th>
                <th>Owner & next step</th>
              </tr>
            </thead>
            <tbody>
              {state.health.map((item) => (
                <tr key={item.component}>
                  <td>
                    <strong>{item.component}</strong>
                    <p className="help" style={{ maxWidth: 240 }}>
                      {item.coverage}
                    </p>
                  </td>
                  <td>
                    <Badge status={item.health} />
                  </td>
                  <td className="help">
                    {dateTime(item.lastSuccessAt)}
                    <br />
                    Observed {dateTime(item.observedAt)}
                  </td>
                  <td className="help">
                    Preparation: {dateTime(item.lastPreparationAt)}
                    <br />
                    Business: {dateTime(item.lastBusinessActionAt)}
                  </td>
                  <td className="help" style={{ maxWidth: 230 }}>
                    <strong>{item.owner}</strong>
                    <br />
                    {item.nextStep}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid-two">
        <section className="card">
          <div className="card-head">
            <h2>Uncertain & in-flight actions</h2>
            <Badge tone="warning">{uncertain.length}</Badge>
          </div>
          {uncertain.map((action) => (
            <div className="card-body" key={action.id}>
              <div className="between">
                <strong className="small">{action.payload.recipient}</strong>
                <Badge status={action.status} />
              </div>
              <p className="help" style={{ margin: "12px 0" }}>
                {action.payload.subject}
                <br />
                Reconcile accepted-provider evidence before considering another
                action.
              </p>
              <div className="flex wrap">
                <Button
                  className="btn-small"
                  disabled={busy}
                  onClick={() =>
                    void act({ type: "reconcile", actionId: action.id })
                  }
                >
                  Reconcile evidence
                </Button>
                <button
                  className="link-button"
                  onClick={() =>
                    inspect(
                      action.payload.subject,
                      "Action evidence and immutable proposal payload.",
                      action.evidence,
                    )
                  }
                >
                  Source evidence
                  <ArrowUpRight size={12} />
                </button>
              </div>
            </div>
          ))}
          {!uncertain.length && (
            <Empty title="No unresolved provider writes">
              Provider timeouts appear here for reconciliation. They are never
              treated as permission to resend.
            </Empty>
          )}
        </section>
        <section className="card card-body">
          <h2 style={{ fontSize: 16, marginBottom: 16 }}>
            Activation & intervention coverage
          </h2>
          <div className="stack-small small">
            <div className="between">
              <span className="muted">Activation milestone</span>
              <Badge status={state.activation.milestone} />
            </div>
            <div className="between">
              <span className="muted">Completed setup effort</span>
              <strong>{economics.categories.setup.minutes} min</strong>
            </div>
            <div className="between">
              <span className="muted">Recurring human support</span>
              <strong>
                {economics.categories.recurring_support.minutes} min
              </strong>
            </div>
            <div className="between">
              <span className="muted">Human takeovers</span>
              <strong>
                {state.contacts.filter((item) => item.humanTakeover).length}
              </strong>
            </div>
            <div className="between">
              <span className="muted">Suppressed contacts</span>
              <strong>
                {state.contacts.filter((item) => item.suppressed).length}
              </strong>
            </div>
            <div className="between">
              <span className="muted">Action attempts</span>
              <strong>
                {
                  state.actions.filter(
                    (item) => item.status !== "not_attempted",
                  ).length
                }
              </strong>
            </div>
            <div className="between">
              <span className="muted">Outcome observations</span>
              <strong>{state.outcomes.length}</strong>
            </div>
          </div>
          <p className="help" style={{ marginTop: 20 }}>
            Wall-clock activation duration and full intervention coverage are
            unavailable until lifecycle timestamps and operator records are
            complete. Founder time is not free.
          </p>
        </section>
      </div>
      <section className="card card-body stack">
        <div className="between">
          <h2 style={{ fontSize: 18 }}>DAVID delivery economics</h2>
          <Badge tone="warning">
            {economics.recurringMarginMinor === null
              ? "Partial coverage"
              : "Recorded cost basis"}
          </Badge>
        </div>
        <div className="readiness-grid">
          <div>
            <span className="eyebrow">Monthly subscription</span>
            <div className="scenario-number">
              {money(economics.subscriptionMinor, state.workspace.currency)}
            </div>
            <p className="help">Configured entitlement, not payment evidence</p>
          </div>
          <div>
            <span className="eyebrow">Recorded recurring costs</span>
            <div className="scenario-number">
              {money(
                economics.recurringRecordedCostMinor,
                state.workspace.currency,
              )}
            </div>
            <p className="help">Support + providers + infrastructure</p>
          </div>
          <div>
            <span className="eyebrow">Recurring delivery margin</span>
            <div
              className="scenario-number"
              style={{
                fontSize: economics.recurringMarginMinor === null ? 24 : 32,
              }}
            >
              {money(economics.recurringMarginMinor, state.workspace.currency)}
            </div>
            <p className="help">Unknown costs prevent a complete margin</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Recorded human time</th>
                <th>Recorded cost</th>
                <th>Coverage</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(economics.categories).map(([key, value]) => (
                <tr key={key}>
                  <td style={{ textTransform: "capitalize" }}>{words(key)}</td>
                  <td>{value.minutes} min</td>
                  <td>
                    {money(value.recordedCostMinor, state.workspace.currency)}
                  </td>
                  <td>
                    <Badge status={value.complete ? "verified" : "unknown"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="notice notice-warning">
          {economics.coverage} {economics.limitation}
        </p>
        <div className="small muted">
          Customer gross profit: <strong>Unavailable</strong> · Unknown
          fulfillment costs, ad spend or payment evidence cannot be filled with
          zero. Recovered staff time is capacity, not automatic payroll savings.
        </div>
      </section>
      <div className="grid-two">
        <section className="card card-body stack-small">
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>
            Record operator time or cost
          </h2>
          <label className="field">
            Work category
            <select
              className="input"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as UsageRecord["category"])
              }
            >
              <option value="recurring_support">
                Recurring customer support
              </option>
              <option value="setup">One-time setup</option>
              <option value="provider">Provider usage</option>
              <option value="infrastructure">Infrastructure allocation</option>
              <option value="research">
                Engineering research & development
              </option>
            </select>
          </label>
          <div className="grid-two" style={{ gap: 16 }}>
            <label className="field">
              Minutes
              <input
                type="number"
                className="input"
                min="0"
                max="1440"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
            <label className="field">
              Cost ({state.workspace.currency}, optional)
              <input
                type="number"
                className="input"
                min="0"
                step=".01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Unknown"
              />
            </label>
          </div>
          <label className="field">
            Intervention reason / work performed
            <textarea
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="What needed human attention, and why?"
            />
          </label>
          <Button
            variant="primary"
            disabled={busy || !note.trim()}
            onClick={async () => {
              const result = await act({
                type: "log_time",
                category,
                minutes,
                costMinor: cost === "" ? null : Math.round(Number(cost) * 100),
                note,
              });
              if (result) setNote("");
            }}
          >
            Save time & cost record
            <Check size={14} />
          </Button>
          <p className="help">
            Unknown cost remains unknown. Use a correction record identifying
            the original entry when recorded work needs clarification.
          </p>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Recent delivery records</h2>
          </div>
          {state.usage
            .slice()
            .reverse()
            .slice(0, 8)
            .map((item) => (
              <div key={item.id} className="work-row">
                <Clock3 size={17} color="var(--muted)" />
                <div className="work-copy">
                  <h3>
                    {words(item.category)} · {item.minutes} minutes
                  </h3>
                  <p>{item.note}</p>
                  <p>
                    {money(item.costMinor, state.workspace.currency)} ·{" "}
                    {dateTime(item.at)}
                  </p>
                </div>
              </div>
            ))}
          {!state.usage.length && (
            <Empty title="No effort recorded yet">
              Capture setup and support effort to establish the true delivery
              cost.
            </Empty>
          )}
        </section>
      </div>
      {state.workspace.mode === "fixture" && (
        <section className="card card-body">
          <div className="between">
            <div>
              <h2 style={{ fontSize: 16 }}>Reset local fixture workspace</h2>
              <p className="help" style={{ marginTop: 8 }}>
                Restores this local synthetic session to its seeded records.
                Fixture actions and saved scenario changes in this session are
                removed.
              </p>
            </div>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => setConfirmReset(true)}
            >
              Reset fixture session
            </Button>
          </div>
          <Drawer
            open={confirmReset}
            onClose={() => setConfirmReset(false)}
            title="Reset this fixture session?"
            description="This removes the synthetic actions, decisions and edits in this local session and restores the starting dataset. No live customer data is affected."
          >
            <div className="flex">
              <Button onClick={() => setConfirmReset(false)}>
                Keep current session
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  const result = await act({ type: "reset" });
                  if (result) setConfirmReset(false);
                }}
              >
                Reset synthetic records
              </Button>
            </div>
          </Drawer>
        </section>
      )}
    </div>
  );
}
