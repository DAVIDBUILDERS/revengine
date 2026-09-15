"use client";

import { useState } from "react";
import { ArrowRight, FileText, Play, ShieldCheck } from "lucide-react";
import type { AgentDefinition } from "@david/contracts";
import { words } from "@david/ui";
import { agentDelivery } from "@david/domain/delivery";
import type { ScreenProps } from "./app-shell";
import { ArtifactCopyOut } from "./artifact-copy-out";
import { Badge, Button, dateTime, Drawer, Evidence } from "./ui";

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
            {agent.releaseStatus !== "planned" &&
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
