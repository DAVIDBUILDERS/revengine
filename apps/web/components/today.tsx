"use client";

import { useContext, useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, FileText, Play, ShieldCheck } from "lucide-react";
import type { AgentDefinition } from "@david/contracts";
import { money, words } from "@david/ui";
import {
  activityLabel,
  agentConversationLabel,
  agentDelivery,
  agentFloorStatus,
  conversationProposalForAgent,
  defaultHumanReview,
  floorStatusLabel,
  isWalkthroughFloor,
  shortAgentLabel,
  specialistRunLog,
  specialistWorkSnapshot,
  teamActivityNarrative,
  teamActivitySeries,
  workspaceOutreach,
  type FloorStatus,
} from "@david/domain/delivery";
import { onboardingFor } from "@david/domain/onboarding";
import { workbenchAgentIds } from "@david/domain/team";
import { PageHeading, type ScreenProps } from "./app-shell";
import { activeApprovals } from "./approval-state";
import { AgentWorkspace } from "./agent-workspace";
import { ArtifactCopyOut } from "./artifact-copy-out";
import { DashboardActivityChart } from "./dashboard-activity-chart";
import { Button, dateTime, QuietWalkthroughContext } from "./ui";
import "./today-studio.css";

const RESULT_LABELS: Record<string, string> = {
  human_replies: "Replies",
  verified_bookings: "Meetings booked",
  attended_meetings: "Meetings held",
  signed_value: "Won business",
};

export function Today(props: ScreenProps & { showBrief: () => Promise<void> }) {
  const { state, navigate, busy, act } = props;
  const quiet = useContext(QuietWalkthroughContext);
  const floor = isWalkthroughFloor(state, quiet);
  const saved = onboardingFor(state);
  const teamIds = workbenchAgentIds(saved.revision ? saved.answers.team : state.activation.selectedTeam);
  const team = teamIds.map((id) => state.catalog.find((agent) => agent.id === id)).filter((agent): agent is AgentDefinition => !!agent);
  const [tab, setTab] = useState("overview");
  const [inspectAgent, setInspectAgent] = useState<AgentDefinition | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const series = teamActivitySeries(state);
  const story = teamActivityNarrative(state);
  const outreach = workspaceOutreach(state);
  const current = team.find((agent) => agent.id === tab) ?? null;
  const reviewOn = current ? defaultHumanReview(current.id) : false;
  const conversationLabel = current ? agentConversationLabel(current.id) : null;
  const outputs = current
    ? state.artifacts.filter((item) => item.agentId === current.id).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const output = outputs[0];
  const install = current ? state.installations.find((item) => item.agentId === current.id) : null;
  const delivery = current ? agentDelivery(state, current.id) : null;
  const work = current ? specialistWorkSnapshot(state, current.id) : null;
  const runs = current ? specialistRunLog(state, current.id, reviewOn) : [];
  const selectedRun = runs.find((item) => item.id === selectedRunId) ?? runs[0] ?? null;
  const floorStatus = current ? agentFloorStatus(state, current.id, reviewOn) : null;
  const pending = current
    ? activeApprovals(state).flatMap((approval) => {
        const action = state.actions.find((item) => item.id === approval.actionId && item.installationId === install?.id);
        return action ? [{ approval, action }] : [];
      })
    : [];

  function selectTab(next: string) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "today");
    if (next === "overview") url.searchParams.delete("agent");
    else url.searchParams.set("agent", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function openConversation(agentId: string) {
    const proposalId = conversationProposalForAgent(state, agentId);
    navigate("opportunities", proposalId ? { proposal: proposalId } : undefined);
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("agent");
    setTab(requested && teamIds.includes(requested) ? requested : "overview");
    const sync = () => {
      const value = new URLSearchParams(window.location.search).get("agent");
      setTab(value && teamIds.includes(value) ? value : "overview");
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [state.workspace.id, teamIds.join("|")]);

  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: state.workspace.timeZone,
  }).format(new Date(state.asOf));

  return (
    <div className="today-page today-studio dashboard-studio">
      <PageHeading
        eyebrow={date}
        title="Dashboard"
        description={
          floor
            ? "Overnight recap, then the results. Open a specialist for that recap."
            : "What the team already produced, then the results. Open a specialist for that recap."
        }
        action={
          <Button onClick={() => void props.showBrief()} disabled={busy}>
            <FileText size={14} />
            Weekly brief <ArrowUpRight size={13} />
          </Button>
        }
      />

      <div className="dashboard-tabs" role="tablist" aria-label="Dashboard views">
        <button
          type="button"
          role="tab"
          id="dashboard-tab-overview"
          aria-selected={tab === "overview"}
          aria-controls="dashboard-panel"
          onClick={() => selectTab("overview")}
        >
          Overview
        </button>
        {team.map((agent) => (
          <button
            key={agent.id}
            type="button"
            role="tab"
            id={`dashboard-tab-${agent.id}`}
            aria-selected={tab === agent.id}
            aria-controls="dashboard-panel"
            onClick={() => selectTab(agent.id)}
          >
            {shortAgentLabel(agent.name)}
          </button>
        ))}
      </div>

      <div
        className="dashboard-panel"
        id="dashboard-panel"
        role="tabpanel"
        aria-labelledby={tab === "overview" ? "dashboard-tab-overview" : `dashboard-tab-${tab}`}
      >
        {tab === "overview" || !current ? (
          <>
            <section className="dashboard-story" aria-labelledby="overview-heading">
              <div>
                <span className="today-kicker">{floor ? "THE TEAM RAN OVERNIGHT" : "WHAT THE TEAM ALREADY DID"}</span>
                <h2 id="overview-heading">{story.headline}</h2>
                <p>{story.body || "Choose specialists and prepare work to populate this overview."}</p>
              </div>
              <p className="dashboard-story-count">
                <strong>{String(outreach.meetingsBooked).padStart(2, "0")}</strong>
                <span>
                  Meetings booked
                  <small>
                    {outreach.emailIn} {outreach.emailIn === 1 ? "reply" : "replies"} · {outreach.linkedinAccepted} LinkedIn accepts
                  </small>
                </span>
              </p>
            </section>

            {floor && (
              <section className="floor-strip" aria-label="Specialist status">
                {series.map((point) => {
                  const status = agentFloorStatus(state, point.agentId, defaultHumanReview(point.agentId));
                  return (
                    <button
                      key={point.agentId}
                      type="button"
                      className="floor-chip"
                      data-status={status}
                      onClick={() => selectTab(point.agentId)}
                    >
                      <span className="floor-dot" aria-hidden="true" />
                      <strong>{point.shortLabel}</strong>
                      <span>{floorStatusLabel(status)}</span>
                    </button>
                  );
                })}
              </section>
            )}

            <section className="outcome-ledger" aria-labelledby="results-heading">
              <div className="section-heading">
                <h2 id="results-heading">Results</h2>
              </div>
              <p className="section-caption">
                {quiet || state.workspace.mode !== "fixture" ? "Source-linked records" : "Illustrative fixture records"} · Open pipeline
              </p>
              {state.metrics.slice(0, 4).map((metric) => (
                <button key={metric.key} className="metric-card ledger-metric" onClick={() => navigate("opportunities")}>
                  <span>
                    {RESULT_LABELS[metric.key] ?? metric.label}
                    <small>{metric.value === null ? "Evidence incomplete" : words(metric.stage)}</small>
                  </span>
                  <strong className={metric.value === null ? "unavailable" : "numeric"}>
                    {metric.value === null
                      ? "Unavailable"
                      : metric.unit.includes("minor")
                        ? money(metric.value, state.workspace.currency)
                        : new Intl.NumberFormat("en-US").format(metric.value)}
                  </strong>
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </section>

            <section className="dashboard-chart-card" aria-labelledby="chart-heading">
              <div className="section-heading">
                <h2 id="chart-heading">{floor ? "Volume by specialist" : "Work by specialist"}</h2>
                <p className="section-caption">Drafts, recorded actions and recommendations on the current team.</p>
              </div>
              {series.length ? (
                <DashboardActivityChart points={series} onSelect={selectTab} />
              ) : (
                <p className="small muted">Select a team to plot its work.</p>
              )}
            </section>
          </>
        ) : (
          <section className="dashboard-agent" aria-label={`${current.name} dashboard`}>
            <aside className="dashboard-agent-brief">
              <span className="today-kicker">{floor ? floorStatusLabel(floorStatus as FloorStatus) : "WHAT THIS SPECIALIST ALREADY DID"}</span>
              <h2>{current.name}</h2>
              <p>
                {floor
                  ? "This is the recap of what this agent did overnight."
                  : work?.latestTitle
                    ? `${work.artifacts} saved output${work.artifacts === 1 ? "" : "s"}. Latest: ${work.latestTitle}.`
                    : current.responsibility}
              </p>
              <ul className="dashboard-agent-counts">
                <li><strong>{work?.artifacts ?? 0}</strong> drafts</li>
                <li><strong>{work?.actions ?? 0}</strong> actions</li>
                <li><strong>{work?.findings ?? 0}</strong> recommendations</li>
              </ul>
              {delivery && <p className="studio-destination">{delivery.headline}</p>}
              <div className="studio-actions">
                {conversationLabel ? (
                  <Button variant="primary" onClick={() => openConversation(current.id)}>
                    {conversationLabel} <ArrowUpRight size={14} />
                  </Button>
                ) : floor ? null : state.workspace.mode === "fixture" && current.releaseStatus === "planned" && output ? (
                  <Button variant="primary" onClick={() => setInspectAgent(current)}>
                    Review saved work <ArrowUpRight size={14} />
                  </Button>
                ) : current.releaseStatus === "planned" ? (
                  <p>This capability is not implemented yet.</p>
                ) : current.modes.includes("preparation") ? (
                  <Button
                    variant="primary"
                    disabled={busy || state.workspace.paused || !install}
                    onClick={() => void act({ type: "prepare", agentId: current.id })}
                  >
                    <Play size={14} />
                    {busy ? "Requesting…" : "Prepare first draft"}
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => navigate("opportunities")}>
                    Open pipeline <ArrowUpRight size={14} />
                  </Button>
                )}
                {!conversationLabel && floor && (
                  <Button variant="primary" onClick={() => navigate("opportunities")}>
                    Open pipeline <ArrowUpRight size={14} />
                  </Button>
                )}
                <button className="studio-text-action" onClick={() => navigate("connections")}>
                  {state.workspace.mode === "fixture" && current.releaseStatus === "planned"
                    ? "Company sources"
                    : delivery?.mode === "engineering_required" || current.releaseStatus === "planned"
                      ? "Record needed systems"
                      : delivery?.mode === "needs_access"
                        ? "Review source access"
                        : "Company sources"}{" "}
                  <ArrowUpRight size={14} />
                </button>
                <button className="studio-text-action" onClick={() => setInspectAgent(current)}>
                  <ShieldCheck size={15} />
                  Access, limits & history
                </button>
                <button className="studio-text-action" onClick={() => navigate("team", { agent: current.id })}>
                  Open AI agent <ArrowUpRight size={14} />
                </button>
              </div>
            </aside>
            <div className="dashboard-agent-work">
              {pending[0] && !floor && (
                <article className="decision-preview dashboard-pending">
                  <span className="eyebrow">Already prepared · awaiting a person</span>
                  <h3>
                    {pending[0].action.type === "book_appointment" ? "Appointment" : "Follow-up"} for{" "}
                    {state.contacts.find((item) => item.id === pending[0].action.contactId)?.name ??
                      pending[0].action.payload.recipient}
                  </h3>
                  <div className="message-preview">
                    <dl>
                      <div>
                        <dt>To</dt>
                        <dd>{pending[0].action.payload.recipient}</dd>
                      </div>
                      <div>
                        <dt>Subject</dt>
                        <dd>{pending[0].action.payload.subject}</dd>
                      </div>
                    </dl>
                    <p>{pending[0].action.payload.body}</p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => navigate("opportunities", { proposal: pending[0].action.proposalId })}
                  >
                    Review exact action <ArrowRight size={14} />
                  </Button>
                </article>
              )}
              {floor ? (
                runs.length ? (
                  <section className="run-log" aria-label={`${current.name} recap`}>
                    {selectedRun && (
                      <article className="studio-output run-open" data-kind={selectedRun.kind}>
                        <p className="studio-kicker">{dateTime(selectedRun.at, state.workspace.timeZone)} · {activityLabel(selectedRun.kind)}</p>
                        <h2>{selectedRun.title}</h2>
                        <div className="studio-output-content">{selectedRun.detail}</div>
                        {selectedRun.limitation && <p className="studio-footnote">{selectedRun.limitation}</p>}
                        {selectedRun.artifactId && delivery && (() => {
                          const artifact = state.artifacts.find((item) => item.id === selectedRun.artifactId);
                          return artifact ? <ArtifactCopyOut artifact={artifact} delivery={delivery} /> : null;
                        })()}
                      </article>
                    )}
                    <section className="agent-activity" aria-label={`${current.name} activity`}>
                      <div className="section-heading">
                        <h2>Activity</h2>
                        <p className="section-caption">What this agent recorded from 3:00 AM to 3:00 AM.</p>
                      </div>
                      <ol>
                        {runs.map((run) => (
                          <li key={run.id}>
                            <button type="button" aria-pressed={selectedRun?.id === run.id} onClick={() => setSelectedRunId(run.id)}>
                              <time dateTime={run.at}>{dateTime(run.at, state.workspace.timeZone)}</time>
                              <span>{activityLabel(run.kind)}</span>
                              <strong>{run.title}</strong>
                            </button>
                          </li>
                        ))}
                      </ol>
                    </section>
                  </section>
                ) : (
                  <div className="studio-empty">
                    <span className="studio-kicker">NO RUNS YET</span>
                    <h2>This specialist has not written to the log.</h2>
                  </div>
                )
              ) : output ? (
                <article className="studio-output">
                  <p className="studio-kicker">
                    {dateTime(output.createdAt, state.workspace.timeZone)} · {output.reviewState}
                  </p>
                  <h2>{output.title}</h2>
                  <div className="studio-output-content">{output.content}</div>
                  <p className="studio-footnote">{output.limitation}</p>
                  {delivery && <ArtifactCopyOut artifact={output} delivery={delivery} />}
                </article>
              ) : (
                <div className="studio-empty">
                  <span className="studio-kicker">NO SAVED OUTPUT YET</span>
                  <h2>This specialist has not left work on the record.</h2>
                  <p>Prepare a draft from approved sources, then it appears here and on Overview.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
      <AgentWorkspace {...props} agent={inspectAgent} onClose={() => setInspectAgent(null)} />
    </div>
  );
}
