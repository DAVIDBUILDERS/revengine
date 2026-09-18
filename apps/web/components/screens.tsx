"use client";
import {WorkspaceOverview} from "./workspace-overview";
import {TeamStudio} from "./team-studio";
import { AgentWorkspace } from "./agent-workspace";
import { activeApprovals } from "./approval-state";
import { useEffect, useState } from "react";
import { filterPipelineLeads, isWalkthroughFloor, pipelineLeads, type PipelineLeadFilter } from "@david/domain/delivery";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  FlaskConical,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ArrowLeftRight,
  ListChecks,
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
import { companyConnectionCoverage } from '@david/domain/company-connections';
import { ALWAYS_ON_AGENT_ID, EXTRA_AGENT_PRICE_MINOR, firstSetupAgentId, isIncludedAgent, nextThreeFor, slotAgentIds, teamSwapReadyAt } from '@david/domain/team';
import './team-source-controls.css';
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

export function Team(props: ScreenProps) { return <TeamStudio {...props} configuration={(onSaved) => <TeamConfiguration {...props} onSaved={onSaved}/>}/>; }

function TeamConfiguration(props: ScreenProps & { onSaved?: (agentId: string) => void }) {
  const { state, act, busy, navigate } = props;
  const [goal, setGoal] = useState(state.recommendation.goal);
  const model = state.workspace.businessModel;
  const setup = onboardingFor(state);
  const savedTeam = slotAgentIds(setup.revision ? setup.answers.team : state.activation.selectedTeam);
  const selectedKey = savedTeam.join(",");
  const [selected, setSelected] = useState(savedTeam);
  const [draftBaseKey, setDraftBaseKey] = useState(selectedKey);
  const [teamMessage, setTeamMessage] = useState("");
  const [swapAgentId, setSwapAgentId] = useState<string | null>(null);
  const sharedCoverage = companyConnectionCoverage(state);
  const swapAgent = state.catalog.find((item) => item.id === swapAgentId);
  const draftKey = selected.join(",");
  const teamConflict = selectedKey !== draftBaseKey && draftKey !== draftBaseKey && draftKey !== selectedKey;
  const teamLocked = busy || selectedKey !== draftBaseKey;
  async function openSetup(section: number) {
    if (teamLocked) return;
    if (selectedKey !== selected.join(",")) {
      const result = await act({type:"save_onboarding", expectedRevision:setup.revision, answers:{...setup.answers,team:selected}});
      if (!result) { setTeamMessage("Save failed. Your selections are still here; retry before opening settings."); return; }
    }
    const url = new URL(window.location.href);
    if (section === 2) {
      for (const parameter of ["mode", "setup", "step"]) url.searchParams.delete(parameter);
      window.history.replaceState({}, "", url.pathname + url.search);
      navigate("connections");
      return;
    }
    url.searchParams.set("mode", "profile");
    url.searchParams.set("setup", String(section));
    window.history.replaceState({}, "", url.pathname + url.search);
    navigate("activation");
  }
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All specialists");
  const [agent, setAgent] = useState<AgentDefinition | null>(null);
  useEffect(() => {
    if (selectedKey === draftBaseKey || teamConflict) return;
    // Pristine drafts follow the server. Our own successful save matches the local draft.
    setSelected(savedTeam);
    setDraftBaseKey(selectedKey);
  }, [selectedKey, draftBaseKey, teamConflict]);
  function reloadSavedTeam() {
    setSelected(savedTeam);
    setDraftBaseKey(selectedKey);
    setSwapAgentId(null);
    setTeamMessage("Loaded the latest saved team.");
  }
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
  const toggle = (id: string) => {
    if (teamLocked || isIncludedAgent(id)) return;
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < (state.workspace.entitlement ?? 5)
          ? [...current, id]
          : current,
    );
  };
  const allowance = state.workspace.entitlement ?? 5;
  const included = state.catalog.find((item) => item.id === ALWAYS_ON_AGENT_ID);
  const nextThree = nextThreeFor(state, selected);
  const swapReadyAt = teamSwapReadyAt(state);
  const extraPrice = money(EXTRA_AGENT_PRICE_MINOR, state.workspace.currency);
  function swapSpecialist(replacedId: string) {
    if (teamLocked || allowance <= 0 || !swapAgent) return;
    if (!selected.includes(replacedId) || selected.includes(swapAgent.id) || !swapAgent.supportedArchetypes.includes(model)) {
      setSwapAgentId(null);
      setTeamMessage("The lineup changed. Review the current team before choosing a replacement.");
      return;
    }
    const replaced = state.catalog.find((item) => item.id === replacedId);
    setSelected((current) => current.includes(replacedId) && !current.includes(swapAgent.id) ? current.map((id) => id === replacedId ? swapAgent.id : id) : current);
    setTeamMessage(`${swapAgent.name} replaces ${replaced?.name ?? "the selected specialist"} in your draft. Save the team to keep this change.`);
    setSwapAgentId(null);
  }
  return (
    <div className="team-builder">
      <section className="builder-objective">
        <div><span className="studio-kicker">TEAM DESIGN / {state.workspace.businessModel.replaceAll("_", " ")}</span><h2>Give ambition a team.</h2><p>Choose your objective. Find the specialists to move it forward.</p></div>
        <div className="builder-intent"><label htmlFor="team-goal">The outcome</label><select id="team-goal" value={goal} onChange={e=>setGoal(e.target.value)}>{[...new Set([state.recommendation.goal,"Recover open proposals","Create qualified demand","Improve conversion","Retain and expand customers"])].map(g=><option key={g}>{g}</option>)}</select>
        <Button disabled={teamLocked||allowance<=0} onClick={async()=>{const result=await act({type:"recommend_team",goal,businessModel:model});if(result){setSelected(result.snapshot.recommendation.specialistIds.slice(0,allowance));setTeamMessage("Recommended team selected below. Review it, then save your team.");}else setTeamMessage("We couldn’t recommend a team. Review the error above and try again.");}}><ListChecks size={16}/>{busy?"Working…":"Recommend my five"}</Button></div>
      </section>
      <section className="builder-shared-sources" aria-label="Shared company source coverage"><div><span className="studio-kicker">ONE COMPANY / SHARED SOURCES</span><h3>Your sources stay with the company.</h3><p>Every specialist reuses your company setup. Source access, permissions and verified work are checked for each role.</p></div><Button disabled={teamLocked} onClick={()=>void openSetup(2)}>Manage company sources <ArrowUpRight size={14}/></Button></section>
      <section className="builder-lineup" aria-label="Your selected team"><div className="between"><span className="studio-kicker">YOUR LINEUP</span><span>{selected.length} / {allowance} paid specialists</span></div>
      {included&&<div className="builder-included"><span className="studio-kicker">INCLUDED WITH EVERY WORKSPACE</span><strong>{included.name}</strong><small>Offer and website preparation. Does not use a team slot. Copy the work onto your site.</small></div>}
      <div className="builder-slots">
      {Array.from({length:Math.min(allowance,Math.max(5,selected.length+1))},(_,i)=>{const item=state.catalog.find(a=>a.id===selected[i]);return <div className={item?"builder-slot filled":"builder-slot"} key={i}><span className="studio-index">{String(i+1).padStart(2,"0")}</span>{item?<><strong>{item.name}</strong><button disabled={teamLocked} aria-label={`Remove ${item.name}`} onClick={()=>toggle(item.id)}><X size={14}/></button><small>{item.releaseStatus==="planned"?"Capability planned":"Readiness checked separately"}</small></>:<><Plus size={19}/><span>Open position</span></>}</div>})}
      </div></section>
      {swapReadyAt&&<p className="help">Removing a live specialist settles for 12 hours after the last applied team change. You can still turn specialists on and off in this draft. An assigned operator can apply a swap sooner.</p>}
      <section className="builder-next-three" aria-label="Next recommended specialists"><div><span className="studio-kicker">NEXT THREE / EXTRA SPECIALISTS</span><h3>Add beyond the included five.</h3><p>Each extra specialist is {extraPrice} / month. An assigned operator raises the workspace allowance; this request does not charge a card.</p></div><div className="builder-next-list">{nextThree.map(item=>item?<button key={item.id} type="button" className="builder-next-card" disabled={teamLocked||!item.supportedArchetypes.includes(model)} onClick={()=>selected.length>=allowance?setSwapAgentId(item.id):toggle(item.id)}><strong>{item.name}</strong><small>{item.releaseStatus==="planned"?"Capability planned":"Ready to review"}</small></button>:null)}</div><Button disabled={teamLocked||busy} onClick={async()=>{const result=await act({type:"onboarding_task",expectedRevision:setup.revision,taskId:"extra-agents",title:"Add extra specialists beyond the included five",owner:state.setupIdentity?.email||setup.answers.people[0]?.email||"Workspace owner",status:"open",note:`Requested: ${nextThree.map(item=>item?.name).filter(Boolean).join(", ") || "next recommended specialists"}. Each extra specialist is ${extraPrice} / month.`});setTeamMessage(result?"Extra-specialist request saved for the operator. No charge was made.":"The extra-specialist request could not be saved. Review the error and retry.");}}>Request extra specialists</Button></section>
      {teamConflict&&<div className="builder-team-conflict" role="alert"><strong>Team changed in another session.</strong><p>Your local draft is still shown. Reload the saved team before continuing; reloading replaces this draft.</p><Button onClick={reloadSavedTeam}>Reload saved team <ArrowRight size={14}/></Button></div>}
      {teamMessage&&!teamConflict&&<p role="status" className="notice">{teamMessage}</p>}
      <section className="builder-library" aria-label="Specialist library"><div className="builder-library-heading"><div><span className="studio-kicker">33 SPECIALISTS / ONE SHARED OBJECTIVE</span><h2>Find your next advantage.</h2></div><label className="builder-search"><Search size={16}/><input aria-label="Search the catalog" placeholder="Find a specialist…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
      <div className="builder-filters" aria-label="Responsibility group">{categories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
      <div className="builder-catalog">{filtered.map((item,i)=>{const picked=selected.includes(item.id);const applicable=item.supportedArchetypes.includes(model);const recommended=state.recommendation.specialistIds.includes(item.id);const sourceCoverage=sharedCoverage.agents.find(role=>role.id===item.id);const currentSources=sourceCoverage?.currentSystems??[];const roleSources=sourceCoverage?.fullRoleSystems??[];return <article key={item.id} className={`agent-card builder-agent ${picked?"selected":""}`} data-agent={item.id}>
      <div className="builder-agent-top"><span className="builder-monogram" aria-hidden="true">{item.name.split(" ").slice(0,2).map(w=>w[0]).join("")}</span><span className="studio-kicker">{isIncludedAgent(item.id)?"INCLUDED":recommended?"RECOMMENDED":item.category}</span><span className="studio-index">{String(i+1).padStart(2,"0")}</span></div>
      <h3>{item.name}</h3><p>{item.responsibility}</p><span className="builder-capability">{isIncludedAgent(item.id)?"Included with every workspace · does not use a slot":!applicable?"Outside this business model":item.releaseStatus==="planned"?"Capability planned":item.modes.includes("preparation")?"Preparation capability":"Requires action verification"}</span>
      <div className="builder-agent-sources"><span className="studio-kicker">SHARED COMPANY SOURCES</span><strong>{currentSources.length ? `${currentSources.length-(sourceCoverage?.missingCurrentSystems.length??0)} of ${currentSources.length} current inputs verified` : "Integration work is still required"}</strong><div>{(currentSources.length?currentSources:roleSources).map(kind=>{const system=sharedCoverage.systems.find(source=>source.kind===kind);const verified=currentSources.includes(kind)&&!sourceCoverage?.missingCurrentSystems.includes(kind);return <span key={kind} className={verified?"is-verified":""} title={system?.detail}>{verified?<Check size={11}/>:<Clock3 size={11}/>}{system?.label??kind}</span>})}</div>{currentSources.length>0&&roleSources.some(kind=>!currentSources.includes(kind))&&<p>Full role also needs {roleSources.filter(kind=>!currentSources.includes(kind)).map(kind=>sharedCoverage.systems.find(system=>system.kind===kind)?.label??kind).join(", ")} as those capabilities are implemented.</p>}</div>
      <div className="builder-agent-actions"><button className="studio-text-action" onClick={()=>setAgent(item)}>Role & readiness <ArrowUpRight size={14}/></button><Button disabled={teamLocked||isIncludedAgent(item.id)||(!picked&&(!applicable||allowance<=0))} onClick={()=>isIncludedAgent(item.id)?undefined:!picked&&allowance>0&&selected.length>=allowance?setSwapAgentId(item.id):toggle(item.id)} aria-pressed={picked||isIncludedAgent(item.id)}>{isIncludedAgent(item.id)?"Included":picked?<Check size={14}/>:allowance>0&&selected.length>=allowance?<ArrowLeftRight size={14}/>:<Plus size={14}/>} {isIncludedAgent(item.id)?"No slot used":picked?"Selected":allowance<=0?"No team slots":selected.length>=allowance?"Swap into team":"Select"}</Button></div>
      </article>})}</div>{!filtered.length&&<Empty title="No matching specialists">Try another name or responsibility group.</Empty>}</section>
      <footer className="builder-save"><div><strong>{selected.length} specialists in your team</strong><p>{teamConflict?"The saved lineup changed. Reload it before saving your next selection.":selectedKey===selected.join(",")?"Your lineup is saved. Open a specialist to finish its setup.":"Unsaved changes. Saving takes you to the first specialist’s setup."}</p></div><Button variant="primary" disabled={teamLocked||selectedKey===selected.join(",")} onClick={async()=>{const result=await act({type:"save_onboarding",expectedRevision:setup.revision,answers:{...setup.answers,team:selected}});if(!result){setTeamMessage("Your team could not be saved. Your selections are still here. Review the error above and retry.");return;}const next=firstSetupAgentId(selected);if(next)props.onSaved?.(next);else setTeamMessage("Team saved. Open a specialist to finish its setup.");}}>Save team <ArrowRight size={15}/></Button></footer>
      <details className="builder-settings"><summary>Sources, permissions & workspace setup</summary><p>Selection defines the team. Verified access and explicit permissions determine what it can do.</p><div className="flex wrap">{[[0,"Company & objectives"],[2,"Sources & connections"],[3,"Permissions & budgets"],[4,"People & measurement"],[5,"Review readiness"]].map(([section,label])=><Button key={section} disabled={teamLocked} onClick={()=>openSetup(Number(section))}>{label}</Button>)}</div>{state.recommendation.limitations.map(item=><p key={item} className="help">{item}</p>)}</details>
      <AgentWorkspace {...props} agent={agent} onClose={()=>setAgent(null)}/>
      <Drawer open={!!swapAgent&&!teamConflict} onClose={()=>setSwapAgentId(null)} title={swapAgent?`Swap in ${swapAgent.name}`:"Swap a specialist"} description="Choose the specialist to replace in your draft lineup. Company sources stay available; the incoming role still needs its own readiness checks.">
        {swapAgent&&<div className="builder-swap"><span className="studio-kicker">INCOMING SPECIALIST</span><h3>{swapAgent.name}</h3><p>{swapAgent.responsibility}</p><div className="builder-swap-options">{selected.map(id=>{const replaced=state.catalog.find(item=>item.id===id);return replaced?<button key={id} disabled={teamLocked} onClick={()=>swapSpecialist(id)} aria-label={`Replace ${replaced.name}`}><span><strong>{replaced.name}</strong><small>Replace in this lineup</small></span><ArrowLeftRight size={17}/></button>:null})}</div><p className="help">This changes your draft only. Save the team when you are ready.</p></div>}
      </Drawer>
    </div>
  );
}

export function Opportunities(props: ScreenProps) {
  const { state, act, busy } = props;
  const floor = isWalkthroughFloor(state);
  const leads = pipelineLeads(state);
  const [proposalId, setProposalId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("proposal"),
  );
  const [leadFilter, setLeadFilter] = useState<PipelineLeadFilter>(() => {
    if (typeof window === "undefined") return "all";
    const value = new URLSearchParams(window.location.search).get("lead");
    return value === "meetings" || value === "replies" || value === "won" || value === "leads" ? value : "all";
  });
  const visibleLeads = filterPipelineLeads(leads, leadFilter);
  const [importOpen, setImportOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("import") === "csv");
  function closeImport() {
    setImportOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.get("import") === "csv") {
      url.searchParams.delete("import");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      setProposalId(params.get("proposal"));
      const value = params.get("lead");
      setLeadFilter(value === "meetings" || value === "replies" || value === "won" || value === "leads" ? value : "all");
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const proposal = state.proposals.find((item) => item.id === proposalId);
  return (
    <div className="stack workspace-studio opportunities-studio">
      <PageHeading
        eyebrow="Leads the team already moved"
        title="Pipeline"
        description="Who, company, what the agents did, and what a sales person should do next. This is a list, not a CRM."
      />
      <section className="card lead-desk">
          <div className="card-head">
            <div>
              <h2>Leads</h2>
              <p className="help" style={{ marginTop: 6 }}>
                {visibleLeads.length} {visibleLeads.length === 1 ? "lead" : "leads"}
                {leadFilter !== "all" && leadFilter !== "leads" ? ` · ${leadFilter}` : ""}
                {floor ? " from yesterday and the day before" : ""}.
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Who</th>
                  <th>Company</th>
                  <th>What the agents did</th>
                  <th>Next for sales</th>
                  <th>
                    <span className="sr-only">Open record</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleLeads.map((item) => {
                  const record = state.proposals.find((row) => row.id === item.proposalId);
                  return (
                    <tr key={item.proposalId}>
                      <td>
                        <strong>{item.name}</strong>
                        {record ? <div className="help">{record.reference}</div> : null}
                      </td>
                      <td>{item.company}</td>
                      <td>{item.whatAgentsDid}</td>
                      <td>{item.salesNext}</td>
                      <td>
                        <Button
                          className="btn-small"
                          onClick={() => setProposalId(item.proposalId)}
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
          {!!leads.length && !visibleLeads.length && (
            <Empty title="No leads in this view">
              <button className="link-button" onClick={() => setLeadFilter("all")}>Show all leads</button>
            </Empty>
          )}
          {!leads.length && (
            <Empty title="No leads yet">The team has not moved anyone into Pipeline.</Empty>
          )}
          <p className="help" style={{ marginTop: 16 }}>
            <button className="link-button" onClick={() => setImportOpen(true)}>Import proposal CSV</button>
          </p>
        </section>
      <Drawer
        open={!!proposal}
        onClose={() => setProposalId(null)}
        title={
          proposal
            ? `${proposal.reference} · ${state.contacts.find((c) => c.id === proposal.contactId)?.account ?? "Proposal"}`
            : ""
        }
        description="One conversation. A person decides the next step."
      >
        {proposal && <ProposalDetail {...props} proposalId={proposal.id} />}
      </Drawer>
      <Drawer
        open={importOpen}
        onClose={closeImport}
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
  const [reviewScope,setReviewScope]=useState("all");
  const findings=state.findings.filter(f=>reviewScope==="all"||f.status===reviewScope);
  return (
    <div className="stack workspace-studio decisions-studio">
      <PageHeading
        eyebrow="Decide, then follow through"
        title="Turn a good decision into tracked work."
        description="Recommendations make the evidence, alternatives and resource commitment explicit. Approved initiatives retain their baseline, owner and review date."
      />
      <WorkspaceOverview eyebrow="HUMAN DIRECTION / RECORDED DECISIONS" title="Choose what deserves momentum." description="See the evidence and commitment before approving work. Every decision keeps its owner and review date.">
        <div className="studio-signal-grid"><button className="studio-signal" onClick={()=>setReviewScope('proposed')} aria-pressed={reviewScope==='proposed'}><span>Awaiting a decision</span><strong>{state.findings.filter(f=>f.status==='proposed').length}</strong><small>Review proposals <ArrowUpRight size={12}/></small></button><button className="studio-signal" onClick={()=>navigate('opportunities')}><span>Action approvals</span><strong>{pending.length}</strong><small>Inspect exact actions <ArrowUpRight size={12}/></small></button><div className="studio-signal"><span>Tracked initiatives</span><strong>{state.initiatives.length}</strong><small>Saved work plans</small></div></div>
      </WorkspaceOverview>
      <div className="studio-filter-bar" aria-label="Filter recommendations">{[['all','All recommendations'],['proposed','Needs a decision'],['approved','Approved']].map(([value,label])=><button key={value} aria-pressed={reviewScope===value} onClick={()=>setReviewScope(value)}>{label}</button>)}</div>
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
          {findings.map((f) => (
            <article className="card card-body stack-small studio-decision-card" key={f.id}>
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
        {!!state.findings.length&&!findings.length&&<Empty title="No recommendations in this view">Choose another filter to inspect the saved recommendations.</Empty>}
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
    <div className="stack workspace-studio journey-studio">
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
          <div className="card card-body journey-identity">
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
          <section className="journey-evidence-map" aria-label="Recorded customer milestones"><div className="section-heading"><h2>Evidence across the relationship</h2><span>Each stage is verified separately</span></div><div className="journey-stages">{['reply','booked','attended','signed','completed','invoiced','paid'].map((stage,index)=>{const records=outcomes.filter(o=>o.stage===stage);return <button key={stage} disabled={!records.length} className={records.length?'has-evidence':''} onClick={()=>inspect(words(stage),'Recorded evidence for this stage.',records.flatMap(r=>r.evidence))}><span className="journey-stage-dot">{String(index+1).padStart(2,'0')}</span><strong>{words(stage)}</strong><small>{records.length?records.length+' recorded':'No evidence yet'}</small></button>})}</div></section>
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
    name: "Proposal recovery · planning forecast",
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
    spendMinor: 250000,
    baselineWins: 1,
    counterfactual: "Same horizon with specialists idle: recorded wins only.",
    assumptions: [
      "Illustrative input assumptions; replace with source-backed baseline.",
    ],
    createdAt: state.asOf,
  });
  const [scenario, setScenario] = useState<ForecastScenario>(
    () => {
      const current = state.scenarios[0] ?? makeScenario();
      return {
        ...current,
        valueMinor: current.valueMinor ?? 500000,
        spendMinor: current.spendMinor ?? 250000,
        baselineWins: current.baselineWins ?? 1,
        counterfactual:
          current.counterfactual ??
          "Same horizon with specialists idle: recorded wins only.",
        assumptions: current.assumptions.length
          ? current.assumptions
          : ["Planning inputs; replace with a source-backed baseline."],
      };
    },
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
    <div className="stack workspace-studio scenarios-studio">
      <PageHeading
        eyebrow="Planning, with the assumptions in view"
        title="Forecast"
        description="Change the inputs. Low, base and high cases share a cohort and a capacity constraint. This is a planning forecast, separate from recorded results."
        action={
          <Button
            variant="primary"
            disabled={busy || !!scenarioError}
            onClick={() => void save()}
          >
            <Check size={14} />
            Save forecast
          </Button>
        }
      />
      <div className="scenario-range-board" aria-label="Live forecast comparison">
        {cases.map((item) => (
          <section
            className={`scenario-case studio-case ${item.case === "base" ? "featured" : ""}`}
            key={item.case}
          >
            <div className="between">
              <span className="eyebrow">{item.case} case</span>
              <Badge tone="warning">Forecast</Badge>
            </div>
            <div className="scenario-number numeric">
              {item.wins.toFixed(1)} <span className="small muted">wins</span>
            </div>
            <div className="studio-case-track" aria-hidden="true"><span style={{width:`${Math.max(0,item.wins/Math.max(1,...cases.map(c=>c.wins))*100)}%`}}/></div>
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
                ? "Complete baseline, spend, and counterfactual."
                : `${(item.incrementalRoi * 100).toFixed(1)}%`}
            </p>
          </section>
        ))}
      </div>
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
          Saved forecasts
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
              Unsaved forecast
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
          Duplicate forecast
        </Button>
      </div>
      <div className="card card-body stack">
        <h2 style={{ fontSize: 17 }}>Shared assumptions</h2>
        <div className="grid-two">
          <label className="field">
            Forecast name
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

export { ConnectionsStudio as Connections } from "./connections-studio";

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
    <div className="stack workspace-studio operator-studio">
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
      <WorkspaceOverview eyebrow="WORKSPACE CONTROL" title={state.workspace.paused?'Dispatch is paused.':'Keep every action accountable.'} description="Provider health, pending actions and business outcomes have separate evidence. Investigate uncertainty before retrying a write."><div className="studio-signal-grid"><div className="studio-signal"><span>Uncertain / in flight</span><strong>{uncertain.length}</strong><small>Actions to reconcile</small></div><div className="studio-signal"><span>Human takeovers</span><strong>{state.contacts.filter(c=>c.humanTakeover).length}</strong><small>People directing the work</small></div><div className="studio-signal"><span>Outcome records</span><strong>{state.outcomes.length}</strong><small>Source-linked observations</small></div></div></WorkspaceOverview>
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
        <div className="studio-health-grid">{state.health.map(item=><article className="studio-health-card" key={item.component}><div className="between"><span className="studio-kicker">COMPONENT</span><Badge status={item.health}/></div><h3>{item.component}</h3><p>{item.coverage}</p><dl><dt>Technical success</dt><dd>{dateTime(item.lastSuccessAt)}</dd><dt>Preparation</dt><dd>{dateTime(item.lastPreparationAt)}</dd><dt>Business action</dt><dd>{dateTime(item.lastBusinessActionAt)}</dd></dl><footer><strong>{item.owner}</strong><p>{item.nextStep}</p><small>Observed {dateTime(item.observedAt)}</small></footer></article>)}</div>
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
