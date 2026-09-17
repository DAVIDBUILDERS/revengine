"use client";

import { useContext, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, FileText } from "lucide-react";
import type { AgentDefinition } from "@david/contracts";
import { money } from "@david/ui";
import {
  agentFloorStatus,
  agentOvernightRecap,
  conversationProposalForAgent,
  customerResults,
  defaultHumanReview,
  floorStatusLabel,
  isWalkthroughFloor,
  specialistRunLog,
  teamActivityNarrative,
  teamActivitySeries,
  teamNeedsSetup,
  type FloorStatus,
} from "@david/domain/delivery";
import { onboardingFor } from "@david/domain/onboarding";
import { firstSetupAgentId, workbenchAgentIds } from "@david/domain/team";
import { PageHeading, type ScreenProps } from "./app-shell";
import { DashboardActivityChart } from "./dashboard-activity-chart";
import { Button, dateTime, QuietWalkthroughContext } from "./ui";
import "./today-studio.css";

export function Today(props: ScreenProps & { showBrief: () => Promise<void> }) {
  const { state, navigate } = props;
  const quiet = useContext(QuietWalkthroughContext);
  const floor = isWalkthroughFloor(state, quiet);
  const saved = onboardingFor(state);
  const teamIds = workbenchAgentIds(saved.revision ? saved.answers.team : state.activation.selectedTeam);
  const team = teamIds.map((id) => state.catalog.find((agent) => agent.id === id)).filter((agent): agent is AgentDefinition => !!agent);
  const [agentId, setAgentId] = useState<string | null>(null);
  const series = teamActivitySeries(state);
  const story = teamActivityNarrative(state);
  const results = customerResults(state);
  const current = team.find((agent) => agent.id === agentId) ?? null;
  const needsSetup = teamNeedsSetup(state);
  const setupAgentId = firstSetupAgentId(saved.revision ? saved.answers.team : state.activation.selectedTeam);
  const setupAgent = team.find((agent) => agent.id === setupAgentId) ?? team.find((agent) => agent.id !== "website-sales-concierge") ?? team[0];

  function selectAgent(next: string | null) {
    setAgentId(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "today");
    if (next) url.searchParams.set("agent", next);
    else url.searchParams.delete("agent");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function openConversation(id: string) {
    const proposalId = conversationProposalForAgent(state, id);
    navigate("opportunities", proposalId ? { proposal: proposalId } : undefined);
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("agent");
    setAgentId(requested && teamIds.includes(requested) ? requested : null);
    const sync = () => {
      const value = new URLSearchParams(window.location.search).get("agent");
      setAgentId(value && teamIds.includes(value) ? value : null);
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

  if (current) {
    const recap = agentOvernightRecap(state, current.id);
    const runs = specialistRunLog(state, current.id, defaultHumanReview(current.id));
    const status = agentFloorStatus(state, current.id, defaultHumanReview(current.id));
    return (
      <div className="today-page today-studio dashboard-studio">
        <PageHeading
          eyebrow={date}
          title={current.name}
          description="What this agent did from 3:00 AM to 3:00 AM."
          action={
            <Button onClick={() => selectAgent(null)}>
              <ArrowLeft size={14} />
              All specialists
            </Button>
          }
        />
        <section className="dashboard-recap" aria-label={`${current.name} recap`}>
          <span className="today-kicker">{floor ? floorStatusLabel(status as FloorStatus) : "3:00 AM TO 3:00 AM"}</span>
          <h2>{recap.headline}</h2>
          <p>{recap.body}</p>
          {recap.facts.length > 0 && (
            <ul className="dashboard-recap-facts">
              {recap.facts.map((fact) => (
                <li key={fact.label}>
                  <strong>{fact.value}</strong>
                  <span>{fact.label}</span>
                </li>
              ))}
            </ul>
          )}
          {recap.primary.kind === "conversation" ? (
            <Button variant="primary" onClick={() => openConversation(current.id)}>
              {recap.primary.label} <ArrowUpRight size={14} />
            </Button>
          ) : recap.primary.kind === "pipeline" ? (
            <Button variant="primary" onClick={() => navigate("opportunities")}>
              {recap.primary.label} <ArrowUpRight size={14} />
            </Button>
          ) : null}
        </section>
        {runs.length > 0 && (
          <section className="quiet-overnight" aria-label={`${current.name} overnight from 3:00 AM to 3:00 AM`}>
            <p className="section-caption">3:00 AM to 3:00 AM</p>
            <ol>
              {runs.map((run) => (
                <li key={run.id}>
                  <time dateTime={run.at}>{dateTime(run.at, state.workspace.timeZone)}</time>
                  <span>{run.title}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="today-page today-studio dashboard-studio">
      <PageHeading
        eyebrow={date}
        title="Dashboard"
        description={
          floor
            ? "Overnight recap, then the leads, then volume. Open a specialist for that recap."
            : needsSetup
              ? "Your team is saved. Set up each specialist next — this dashboard fills in after they work."
              : "What the team already did, then the leads, then volume. Open a specialist for that recap."
        }
        action={
          <Button onClick={() => void props.showBrief()} disabled={props.busy}>
            <FileText size={14} />
            Weekly brief <ArrowUpRight size={13} />
          </Button>
        }
      />

      <section className="dashboard-story" aria-labelledby="overview-heading">
        <div>
          <span className="today-kicker">{floor ? "THE TEAM RAN OVERNIGHT" : needsSetup ? "NEXT STEP" : "WHAT THE TEAM ALREADY DID"}</span>
          <h2 id="overview-heading">{needsSetup ? "Your team is saved. Set up each specialist." : story.headline}</h2>
          <p>{needsSetup ? "Open a specialist to finish its own setup. Instantly, lists, and booking live there — not on this recap." : story.body || "Choose specialists to populate this recap."}</p>
          {needsSetup && setupAgent && (
            <Button variant="primary" onClick={() => navigate("team", { agent: setupAgent.id })}>
              Set up {setupAgent.name} <ArrowUpRight size={14} />
            </Button>
          )}
        </div>
      </section>

      <section className="dashboard-specialists" aria-labelledby="specialists-heading">
        <div className="section-heading">
          <h2 id="specialists-heading">{needsSetup ? "Set up your specialists" : "Overnight recap"}</h2>
          <p className="section-caption">{needsSetup ? "Each role has its own setup. Start with the one that still needs it." : "Open a specialist for that recap."}</p>
        </div>
        <div className="today-team-grid">
          {team.map((agent) => {
            const recap = agentOvernightRecap(state, agent.id);
            const status = agentFloorStatus(state, agent.id, defaultHumanReview(agent.id));
            return (
              <button
                key={agent.id}
                type="button"
                className="today-specialist"
                onClick={() => (needsSetup ? navigate("team", { agent: agent.id }) : selectAgent(agent.id))}
                aria-label={needsSetup ? `Set up ${agent.name}` : `Open ${agent.name} recap`}
              >
                <span className="today-specialist-top">
                  <span className="today-kicker">{needsSetup ? "SET UP" : floor ? floorStatusLabel(status) : "RECAP"}</span>
                </span>
                <strong>{agent.name}</strong>
                <span className="today-specialist-detail">{needsSetup ? "Finish this specialist’s setup." : recap.headline}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="outcome-ledger" aria-labelledby="results-heading">
        <div className="section-heading">
          <h2 id="results-heading">Results</h2>
        </div>
        <p className="section-caption">Leads first. Open Pipeline for that kind of record.</p>
        {results.map((metric) => (
          <button
            key={metric.key}
            className="metric-card ledger-metric"
            onClick={() => navigate("opportunities", { lead: metric.filter })}
          >
            <span>
              {metric.label}
              <small>{metric.hint}</small>
            </span>
            <strong className="numeric">
              {metric.unit === "money" ? money(metric.value, metric.currency ?? state.workspace.currency) : new Intl.NumberFormat("en-US").format(metric.value)}
            </strong>
            <ArrowUpRight size={12} />
          </button>
        ))}
      </section>

      <section className="dashboard-chart-card" aria-labelledby="chart-heading">
        <div className="section-heading">
          <h2 id="chart-heading">Volume</h2>
          <p className="section-caption">{needsSetup ? "Volume appears after specialists start work." : "Results by specialist, last overnight."}</p>
        </div>
        {series.length ? (
          <DashboardActivityChart points={series} onSelect={selectAgent} />
        ) : (
          <p className="small muted">Select a team to plot its volume.</p>
        )}
      </section>
    </div>
  );
}
