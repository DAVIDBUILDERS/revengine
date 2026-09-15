"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, FileText, Pause, Play, ShieldCheck } from "lucide-react";
import type { AgentDefinition, Metric } from "@david/contracts";
import { money, words } from "@david/ui";
import { specialistWorkSnapshot } from "@david/domain/delivery";
import { isIncludedAgent } from "@david/domain/team";
import { PageHeading, type ScreenProps } from "./app-shell";
import { activeApprovals } from "./approval-state";
import { AgentWorkspace } from "./agent-workspace";
import { Button, dateTime } from "./ui";
import "./today-studio.css";

export function Today(props: ScreenProps & { showBrief: () => Promise<void> }) {
  const { state, navigate, inspect, busy, act } = props;
  const [selected, setSelected] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentDefinition | null>(null);
  const pending = activeApprovals(state);
  const decisions = [
    ...pending.flatMap((approval) => {
      const action = state.actions.find(
        (item) => item.id === approval.actionId,
      );
      if (!action) return [];
      const contact = state.contacts.find(
        (item) => item.id === action.contactId,
      );
      return [
        {
          id: approval.id,
          kind: "Approval",
          title:
            action.type === "book_appointment"
              ? `Appointment with ${contact?.name ?? action.payload.recipient}`
              : `Follow-up for ${contact?.name ?? action.payload.recipient}`,
          action,
          finding: null,
        },
      ];
    }),
    ...state.findings
      .filter((item) => item.status === "proposed")
      .map((finding) => ({
        id: finding.id,
        kind: "Recommendation",
        title: finding.title,
        action: null,
        finding,
      })),
  ];
  const current =
    decisions.find((item) => item.id === selected) ?? decisions[0];
  const approvalCount = decisions.filter((item) => item.kind === "Approval").length;
  const currentAction = current?.action;
  const currentFinding = current?.finding;
  const assigned = currentAction
    ? state.installations.find(
        (item) => item.id === currentAction.installationId,
      )?.agentId
    : currentFinding?.agentId;
  const currentAgent = state.catalog.find((item) => item.id === assigned);
  const allEvidence = [
    ...state.proposals.flatMap((p) => p.evidence),
    ...state.outcomes.flatMap((o) => o.evidence),
    ...state.receipts.flatMap((r) => r.evidence),
  ];
  const inspectMetric = (metric: Metric) =>
    inspect(
      metric.label,
      `${metric.stage} · ${metric.unit} · As of ${dateTime(state.asOf)}. ${metric.limitation ?? "Based on recorded source evidence."}`,
      allEvidence.filter((e) => metric.evidenceIds.includes(e.id)),
    );
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: state.workspace.timeZone,
  }).format(new Date(state.asOf));
  return (
    <div className="today-page today-studio">
      <PageHeading
        eyebrow={date}
        title="Today"
        description={
          decisions.length
            ? `${decisions.length} ${decisions.length === 1 ? "item needs" : "items need"} your review. See the work, check the evidence, decide what happens next.`
            : "Nothing waiting for your review. Your team’s recorded work is below."
        }
        action={
          <Button onClick={() => void props.showBrief()} disabled={busy}>
            <FileText size={14} />
            Weekly brief <ArrowUpRight size={13} />
          </Button>
        }
      />

      <section className="decision-desk" aria-labelledby="attention-heading">
        <div className="today-focus-header">
          <div>
            <span className="today-kicker">YOUR ATTENTION</span>
            <h2 id="attention-heading">
              {decisions.length ? "Make the next move." : "Room for your next move."}
            </h2>
            <p>
              {decisions.length
                ? "Prepared work, ready for your judgment."
                : "Choose a specialist and give it a piece of work."}
            </p>
          </div>
          <div className="today-review-count">
            <strong>{String(decisions.length).padStart(2, "0")}</strong>
            <span>Decisions needed<small>{approvalCount} approvals · {decisions.length - approvalCount} recommendations</small></span>
          </div>
        </div>
        {current ? (
          <div className="decision-layout">
            <div className="decision-queue" aria-label="Items for review">
              <p className="today-kicker">REVIEW QUEUE</p>
              {decisions.slice(0, 3).map((item, index) => (
                <button
                  key={item.id}
                  aria-pressed={current.id === item.id}
                  onClick={() => setSelected(item.id)}
                >
                  <span className="queue-index">
                    {String(index + 1).padStart(2, "0")} / {item.kind}
                  </span>
                  <strong>{item.title}</strong>
                  <ArrowRight size={14} />
                </button>
              ))}
              {decisions.length > 3 && (
                <Button onClick={() => navigate("decisions")}>
                  View all {decisions.length} decisions <ArrowRight size={14} />
                </Button>
              )}
            </div>
            <article className="decision-preview">
              <div className="between">
                <span className="eyebrow">
                  {current.kind === "Approval"
                    ? "Prepared work · awaiting your approval"
                    : "Proposed next step"}
                </span>
                {state.workspace.mode === "fixture" && (
                  <span className="tiny muted">Synthetic record</span>
                )}
              </div>
              <h3>{current.title}</h3>
              {currentAgent && (
                <button
                  className="decision-agent"
                  onClick={() => setAgent(currentAgent)}
                >
                  {currentAgent.name}
                  <ArrowUpRight size={12} />
                </button>
              )}
              {currentAction && (
                <>
                  <div className="message-preview">
                    <dl>
                      <div>
                        <dt>To</dt>
                        <dd>{currentAction.payload.recipient}</dd>
                      </div>
                      <div>
                        <dt>Subject</dt>
                        <dd>{currentAction.payload.subject}</dd>
                      </div>
                      {currentAction.payload.startAt && (
                        <div>
                          <dt>When</dt>
                          <dd>
                            {dateTime(currentAction.payload.startAt)} ·{" "}
                            {currentAction.payload.timeZone}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <p>{currentAction.payload.body}</p>
                  </div>
                  <div className="preview-actions">
                    <Button
                      variant="primary"
                      onClick={() =>
                        navigate("opportunities", {
                          proposal: currentAction.proposalId,
                        })
                      }
                    >
                      Review exact action <ArrowRight size={14} />
                    </Button>
                    <button
                      className="link-button"
                      onClick={() =>
                        inspect(
                          current.title,
                          "Evidence attached to this exact prepared action.",
                          currentAction.evidence,
                        )
                      }
                    >
                      Source evidence <ArrowUpRight size={12} />
                    </button>
                  </div>
                  <p className="help">
                    Review the recipient, wording and current checks before
                    authorizing an action.
                  </p>
                </>
              )}
              {currentFinding && (
                <>
                  <p className="finding-observation">
                    {currentFinding.observedCondition}
                  </p>
                  <dl className="finding-brief">
                    <div>
                      <dt>Proposed approach</dt>
                      <dd>{currentFinding.hypothesis}</dd>
                    </div>
                    <div>
                      <dt>Responsible owner</dt>
                      <dd>{currentFinding.owner}</dd>
                    </div>
                    <div>
                      <dt>Estimated commitment</dt>
                      <dd>
                        {currentFinding.effortMinutes} minutes ·{" "}
                        {money(
                          currentFinding.costMinor,
                          state.workspace.currency,
                        )}
                      </dd>
                    </div>
                  </dl>
                  <div className="preview-actions">
                    <Button
                      variant="primary"
                      onClick={() => navigate("decisions")}
                    >
                      Review recommendation <ArrowRight size={14} />
                    </Button>
                    <button
                      className="link-button"
                      onClick={() =>
                        inspect(
                          currentFinding.title,
                          currentFinding.observedCondition,
                          currentFinding.evidence,
                        )
                      }
                    >
                      Source evidence <ArrowUpRight size={12} />
                    </button>
                  </div>
                  <p className="help">
                    A recommendation is a proposal for review. It does not
                    authorize sending, booking or publishing.
                  </p>
                </>
              )}
            </article>
          </div>
        ) : (
          <div className="decision-empty">
            <div className="today-empty-mark" aria-hidden="true"><ShieldCheck size={30} strokeWidth={1} /></div>
            <div>
              <h3>No decisions waiting.</h3>
              <p>
                New work will appear here with the source evidence and the
                commitment required.
              </p>
              <Button onClick={() => navigate("opportunities")}>
                View customer work <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </section>

        <section className="today-specialists" aria-labelledby="team-heading">
          <div className="section-heading">
            <h2 id="team-heading">
              Your specialists{" "}
              <span className="count-label">{state.installations.length}</span>
            </h2>
            <button className="link-button" onClick={() => navigate("team")}>
              Manage team <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="today-team-grid">
            {state.installations.map((installation) => {
              const specialist = state.catalog.find((item) => item.id === installation.agentId);
              if (!specialist) return null;
              const work = specialistWorkSnapshot(state, specialist.id);
              const max = Math.max(1, ...work.counts);
              const slot = state.installations.filter((item) => !isIncludedAgent(item.agentId)).findIndex((item) => item.id === installation.id);
              const detail = installation.blockers[0]
                ?? work.latestTitle
                ?? (work.artifacts || work.actions || work.findings
                  ? `${work.artifacts} saved outputs · ${work.actions} action records${work.findings ? ` · ${work.findings} recommendation${work.findings === 1 ? "" : "s"}` : ""}`
                  : "No saved work yet");
              return (
                <button key={installation.id} className="today-specialist" onClick={() => navigate("team", { agent: specialist.id })} aria-label={`Open ${specialist.name} work`}>
                  <span className="today-specialist-top"><span className="today-kicker">{isIncludedAgent(specialist.id) ? "Included" : `${String(slot + 1).padStart(2, "0")} / ${words(installation.mode)}`}</span><ArrowUpRight size={16} /></span>
                  <strong>{specialist.name}</strong>
                  <span className="today-specialist-status">{state.workspace.paused ? "Workspace paused" : words(installation.status)}</span>
                  <svg className="today-spark" viewBox="0 0 36 18" aria-hidden="true">
                    {work.counts.map((value, bar) => {
                      const height = Math.max(2, (value / max) * 16);
                      return <rect key={bar} x={bar * 12 + 2} y={18 - height} width="8" height={height} rx="1" />;
                    })}
                  </svg>
                  <span className="today-specialist-detail">{detail}</span>
                  <span className="today-specialist-footer">{work.delivery.cardLabel} <ArrowRight size={14} /></span>
                </button>
              );
            })}
            {!state.installations.length && <div className="today-team-empty"><p>No specialists installed yet.</p><Button onClick={() => navigate("team")}>Build your team <ArrowRight size={14} /></Button></div>}
          </div>
        </section>
      <div className="today-ledger-grid">
        <section className="outcome-ledger" aria-labelledby="results-heading">
          <div className="section-heading">
            <h2 id="results-heading">Results</h2>
          </div>
          <p className="section-caption">
            {state.workspace.mode === "fixture"
              ? "Illustrative fixture records"
              : "Source-linked records"}{" "}
            · Select to inspect
          </p>
          {state.metrics.slice(0, 4).map((metric) => (
            <button
              key={metric.key}
              className="metric-card ledger-metric"
              onClick={() => inspectMetric(metric)}
            >
              <span>
                {metric.label}
                <small>
                  {metric.value === null
                    ? "Evidence incomplete"
                    : words(metric.stage)}
                </small>
              </span>
              <strong
                className={metric.value === null ? "unavailable" : "numeric"}
              >
                {metric.value === null
                  ? "Unavailable"
                  : metric.unit.includes("minor")
                    ? money(metric.value, state.workspace.currency)
                    : new Intl.NumberFormat("en-US").format(metric.value)}
              </strong>
              <ArrowUpRight size={12} />
            </button>
          ))}
          {!state.metrics.length && <p className="small muted">No outcome measurements recorded yet.</p>}
        </section>

      <section className="readiness-summary" aria-labelledby="blockers-heading">
        <div className="section-heading">
          <h2 id="blockers-heading"><ShieldCheck size={17} /> Operating boundaries</h2>
          <button
            className="link-button"
            onClick={() => navigate("connections")}
          >
            Connections & owners <ArrowUpRight size={12} />
          </button>
        </div>
        {state.readiness.blockers.length ? (
          <details>
            <summary>
              <span>
                {state.readiness.blockers.length}{" "}
                {state.readiness.blockers.length === 1
                  ? "condition needs"
                  : "conditions need"}{" "}
                attention
              </span>
              <span className="tiny muted">View blockers and next steps</span>
            </summary>
            <div className="readiness-items">
              {state.readiness.blockers.map((blocker) => (
                <div className="readiness-item" key={blocker.code}>
                  <div>
                    <strong>{blocker.message}</strong>
                    <p>
                      {blocker.owner} · {blocker.nextStep}
                    </p>
                  </div>
                  <Button
                    className="btn-small"
                    onClick={() => navigate("connections")}
                  >
                    Review <ArrowRight size={12} />
                  </Button>
                </div>
              ))}
            </div>
          </details>
        ) : (
          <p className="small muted">
            No current readiness blockers. Readiness is checked again before
            every action.
          </p>
        )}
        <div className="control-line">
          <span className="small muted">
            {state.workspace.paused
              ? "New dispatch is paused."
              : `Workspace mode: ${words(state.workspace.mode)}.`}{" "}
            Actions stay within approved boundaries.
          </span>
          <Button
            variant="quiet"
            className="btn-small"
            disabled={busy}
            onClick={() =>
              void act({ type: "pause", paused: !state.workspace.paused })
            }
          >
            {state.workspace.paused ? <Play size={13} /> : <Pause size={13} />}
            {state.workspace.paused
              ? "Check readiness & resume"
              : "Pause workspace"}
          </Button>
        </div>
      </section>
      </div>

      <section className="recent-records">
        <div className="section-heading">
          <h2>Recent activity</h2>
          <button className="link-button" onClick={() => navigate("journey")}>
            Customer journeys <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="today-record-grid">{state.timeline
          .slice()
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, 4)
          .map((event) => (
            <article className="record-row" key={event.id}>
              <div className="today-record-top"><span className="record-actor">{words(event.actor)}</span><time className="tiny muted">{dateTime(event.at)}</time></div>
              <div>
                <h3>{event.title}</h3>
                <p>{event.detail}</p>
              </div>
              <button
                className="link-button tiny"
                onClick={() =>
                  inspect(event.title, event.detail, event.evidence)
                }
              >
                Evidence <ArrowUpRight size={11} />
              </button>
            </article>
          ))}</div>
        {!state.timeline.length && (
          <p className="small muted">
            No recorded activity. Import current proposal records to begin.
          </p>
        )}
      </section>
      <p className="tiny muted">
        Loaded coverage: {state.contacts.length} contacts ·{" "}
        {state.proposals.length} proposal records · Financial measurement{" "}
        {state.readiness.measurement ? "ready" : "incomplete"}. As of{" "}
        {dateTime(state.asOf)}.
      </p>
      <AgentWorkspace {...props} agent={agent} onClose={() => setAgent(null)} />
    </div>
  );
}
