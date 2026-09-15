"use client";

import { useContext, useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, FileText, Play, ShieldCheck } from "lucide-react";
import type { AgentDefinition, Metric } from "@david/contracts";
import { money, words } from "@david/ui";
import {
  activityLabel,
  agentDelivery,
  agentFloorStatus,
  defaultHumanReview,
  floorStatusLabel,
  isWalkthroughFloor,
  specialistRunLog,
  specialistWorkSnapshot,
  teamActivityFeed,
  teamActivityNarrative,
  teamActivitySeries,
  type FloorStatus,
} from "@david/domain/delivery";
import { onboardingFor } from "@david/domain/onboarding";
import { slotAgentIds } from "@david/domain/team";
import { PageHeading, type ScreenProps } from "./app-shell";
import { activeApprovals } from "./approval-state";
import { AgentWorkspace } from "./agent-workspace";
import { ArtifactCopyOut } from "./artifact-copy-out";
import { DashboardActivityChart } from "./dashboard-activity-chart";
import { Button, dateTime, QuietWalkthroughContext } from "./ui";
import "./today-studio.css";

const REVIEW_KEY = "revengine.human-review.v1";

function useHumanReview() {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(REVIEW_KEY);
      if (raw) setOverrides(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* session overlay is optional */
    }
  }, []);
  function humanReview(agentId: string) {
    return Object.hasOwn(overrides, agentId) ? overrides[agentId]! : defaultHumanReview(agentId);
  }
  function setHumanReview(agentId: string, enabled: boolean) {
    setOverrides((previous) => {
      const next = { ...previous, [agentId]: enabled };
      try {
        sessionStorage.setItem(REVIEW_KEY, JSON.stringify(next));
      } catch {
        /* keep the in-memory switch if storage is blocked */
      }
      return next;
    });
  }
  return { humanReview, setHumanReview };
}

export function Today(props: ScreenProps & { showBrief: () => Promise<void> }) {
  const { state, navigate, inspect, busy, act } = props;
  const quiet = useContext(QuietWalkthroughContext);
  const floor = isWalkthroughFloor(state, quiet);
  const saved = onboardingFor(state);
  const teamIds = slotAgentIds(saved.revision ? saved.answers.team : state.activation.selectedTeam);
  const team = teamIds.map((id) => state.catalog.find((agent) => agent.id === id)).filter((agent): agent is AgentDefinition => !!agent);
  const [tab, setTab] = useState("overview");
  const [inspectAgent, setInspectAgent] = useState<AgentDefinition | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { humanReview, setHumanReview } = useHumanReview();
  const series = teamActivitySeries(state);
  const story = teamActivityNarrative(state);
  const feed = teamActivityFeed(state, humanReview);
  const current = team.find((agent) => agent.id === tab) ?? null;
  const reviewOn = current ? humanReview(current.id) : false;
  const outputs = current
    ? state.artifacts.filter((item) => item.agentId === current.id).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const output = outputs[0];
  const install = current ? state.installations.find((item) => item.agentId === current.id) : null;
  const delivery = current ? agentDelivery(state, current.id) : null;
  const work = current ? specialistWorkSnapshot(state, current.id) : null;
  const runs = current ? specialistRunLog(state, current.id, reviewOn) : [];
  const selectedRun = runs.find((item) => item.id === selectedRunId) ?? runs[0] ?? null;
  const selectedArtifact = selectedRun?.artifactId ? state.artifacts.find((item) => item.id === selectedRun.artifactId) : undefined;
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

  function openRun(agentId: string, runId: string) {
    setSelectedRunId(runId);
    selectTab(agentId);
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

  const inspectMetric = (metric: Metric) =>
    inspect(
      metric.label,
      `${metric.stage} · ${metric.unit} · As of ${dateTime(state.asOf, state.workspace.timeZone)}. ${metric.limitation ?? "Based on recorded source evidence."}`,
      [
        ...state.proposals.flatMap((item) => item.evidence),
        ...state.outcomes.flatMap((item) => item.evidence),
        ...state.receipts.flatMap((item) => item.evidence),
      ].filter((item) => metric.evidenceIds.includes(item.id)),
    );

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
            ? "Overnight runs, one specialist still on a pass. Open a specialist to read the log."
            : "Overview of the work the active team already produced. Open a specialist to read the saved output."
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
            {agent.name}
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
                <strong>{String(series.reduce((sum, point) => sum + point.total, 0)).padStart(2, "0")}</strong>
                <span>Recorded outputs<small>{series.reduce((sum, point) => sum + point.artifacts, 0)} drafts · {series.reduce((sum, point) => sum + point.findings, 0)} recommendations</small></span>
              </p>
            </section>

            {floor && (
              <>
                <section className="floor-strip" aria-label="Specialist status">
                  {series.map((point) => {
                    const status = agentFloorStatus(state, point.agentId, humanReview(point.agentId));
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
                <section className="activity-feed" aria-label="Team activity">
                  <div className="section-heading">
                    <h2>Activity</h2>
                    <p className="section-caption">Each row is work already written to the log.</p>
                  </div>
                  {feed.length ? (
                    <ol>
                      {feed.map((event, index) => (
                        <li key={`${event.id}:${event.kind}`} style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}>
                          <button type="button" data-kind={event.kind} onClick={() => openRun(event.agentId, event.id)}>
                            <time dateTime={event.at}>{dateTime(event.at, state.workspace.timeZone)}</time>
                            <span className="activity-agent">{event.name}</span>
                            <strong>{event.verb}</strong>
                            <span className="activity-title">{event.title}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="small muted">No recorded runs yet.</p>
                  )}
                </section>
              </>
            )}

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

            <section className="outcome-ledger" aria-labelledby="results-heading">
              <div className="section-heading">
                <h2 id="results-heading">Results</h2>
              </div>
              <p className="section-caption">
                {quiet || state.workspace.mode !== "fixture" ? "Source-linked records" : "Illustrative fixture records"} · Select to inspect
              </p>
              {state.metrics.slice(0, 4).map((metric) => (
                <button key={metric.key} className="metric-card ledger-metric" onClick={() => inspectMetric(metric)}>
                  <span>
                    {metric.label}
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
          </>
        ) : (
          <section className="dashboard-agent" aria-label={`${current.name} dashboard`}>
            <aside className="dashboard-agent-brief">
              <span className="today-kicker">{floor ? floorStatusLabel(floorStatus as FloorStatus) : "WHAT THIS SPECIALIST ALREADY DID"}</span>
              <h2>{current.name}</h2>
              <p>
                {floor
                  ? reviewOn
                    ? "This specialist prepares, then waits."
                    : "This specialist writes completed work into the log. It does not wait."
                  : work?.latestTitle
                    ? `${work.artifacts} saved output${work.artifacts === 1 ? "" : "s"}. Latest: ${work.latestTitle}.`
                    : current.responsibility}
              </p>
              <ul className="dashboard-agent-counts">
                <li><strong>{work?.artifacts ?? 0}</strong> drafts</li>
                <li><strong>{work?.actions ?? 0}</strong> actions</li>
                <li><strong>{work?.findings ?? 0}</strong> recommendations</li>
              </ul>
              {floor && (
                <label className="human-review">
                  <input
                    type="checkbox"
                    checked={reviewOn}
                    onChange={(event) => setHumanReview(current.id, event.target.checked)}
                  />
                  <span>
                    <strong>Human review</strong>
                    <small>{reviewOn ? "On — the specialist waits" : "Off — the specialist writes to the log"}</small>
                  </span>
                </label>
              )}
              {delivery && <p className="studio-destination">{delivery.headline}</p>}
              <div className="studio-actions">
                {floor ? (
                  selectedRun && (
                    <Button variant="primary" onClick={() => setSelectedRunId(selectedRun.id)}>
                      Open this run <ArrowUpRight size={14} />
                    </Button>
                  )
                ) : state.workspace.mode === "fixture" && current.releaseStatus === "planned" && output ? (
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
                    Open customer work <ArrowUpRight size={14} />
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
                  Open full workbench <ArrowUpRight size={14} />
                </button>
              </div>
            </aside>
            <div className="dashboard-agent-work">
              {pending[0] && (!floor || reviewOn) && (
                <article className="decision-preview dashboard-pending">
                  <span className="eyebrow">{floor ? "Held for review" : "Already prepared · awaiting a person"}</span>
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
                  <section className="run-log" aria-label={`${current.name} run log`}>
                    {runs.map((run) => {
                      const artifact = run.artifactId ? state.artifacts.find((item) => item.id === run.artifactId) : undefined;
                      const open = selectedRun?.id === run.id;
                      return (
                        <article key={run.id} className={open ? "studio-output run-open" : "run-row"} data-kind={run.kind}>
                          <button type="button" className="run-toggle" onClick={() => setSelectedRunId(run.id)} aria-expanded={open}>
                            <time dateTime={run.at}>{dateTime(run.at, state.workspace.timeZone)}</time>
                            <span>{activityLabel(run.kind)}</span>
                            <strong>{run.title}</strong>
                          </button>
                          {open && (
                            <>
                              <h2>{run.title}</h2>
                              <div className="studio-output-content">{run.detail}</div>
                              {run.limitation && <p className="studio-footnote">{run.limitation}</p>}
                              {artifact && delivery && <ArtifactCopyOut artifact={artifact} delivery={delivery} />}
                            </>
                          )}
                        </article>
                      );
                    })}
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
