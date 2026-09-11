"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ForecastScenario } from "@david/contracts";
import { catalog, recommendedAgentIds } from "@david/agents";
import { forecastCases } from "@david/domain/scenarios";
import { money, words } from "@david/ui";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  FlaskConical,
  Home,
  RotateCcw,
  ShieldCheck,
  ListChecks,
  Target,
  Users,
} from "lucide-react";

const SESSION_KEY = "david.public-demo.v1";
const Session = z.object({
  version: z.literal(1),
  preset: z.enum(["b2b_services", "home_services"]),
  goal: z.string().max(100),
  team: z.array(z.string()).max(5),
  scenario: ForecastScenario,
  stage: z.number().int().min(0).max(6),
  confirmed: z.boolean(),
});
type DemoSession = z.infer<typeof Session>;
type Tab = "overview" | "team" | "scenario";
const goals = [
  "Recover open proposals",
  "Create qualified demand",
  "Improve conversion",
  "Retain and expand customers",
];
function initial(preset: DemoSession["preset"] = "b2b_services"): DemoSession {
  const home = preset === "home_services";
  return {
    version: 1,
    preset,
    goal: home ? "Recover existing estimates" : "Recover open proposals",
    team: recommendedAgentIds("recovery", preset),
    stage: 0,
    confirmed: false,
    scenario: {
      id: home
        ? "00000000-0000-4000-8000-000000000102"
        : "00000000-0000-4000-8000-000000000101",
      workspaceId: "00000000-0000-4000-8000-000000000100",
      version: 1,
      name: home ? "Home-service estimate recovery" : "B2B proposal recovery",
      businessModel: preset,
      currency: "USD",
      horizonDays: 90,
      volume: home ? 80 : 100,
      cohort: "recovery",
      overlapResolved: true,
      conversions: home
        ? [
            { label: "Appointments", low: 0.2, base: 0.3, high: 0.4 },
            { label: "Accepted jobs", low: 0.3, base: 0.4, high: 0.5 },
            { label: "Completed work", low: 0.75, base: 0.85, high: 0.95 },
            { label: "Collection", low: 0.85, base: 0.9, high: 0.98 },
          ]
        : [
            { label: "Conversations", low: 0.15, base: 0.25, high: 0.35 },
            { label: "Bookings", low: 0.4, base: 0.5, high: 0.6 },
            { label: "Held meetings", low: 0.7, base: 0.8, high: 0.9 },
            { label: "Wins", low: 0.2, base: 0.3, high: 0.4 },
          ],
      capacity: home ? 12 : 8,
      valueMinor: home ? 450000 : 500000,
      spendMinor: null,
      baselineWins: null,
      counterfactual: null,
      assumptions: [
        "All conversion rates and sample records are invented for illustration.",
        "No customer system or financial source is connected.",
        "The recovery cohort is distinct from any new-demand cohort.",
      ],
      createdAt: "2026-09-10T16:00:00Z",
    },
  };
}
const b2bJourney = [
  {
    name: "An open proposal gets a clear next step",
    owner: "Deal Follow-up",
    description:
      "The current proposal, approved scope and contact ownership are reviewed before a draft is prepared.",
    evidence:
      "Synthetic source: P-1001 · Northstar Advisory · Open · Monthly value $5,000. No customer record was retrieved.",
  },
  {
    name: "The exact follow-up is reviewed",
    owner: "Deal Follow-up",
    description:
      "A factual message stays within the proposal. The recipient, content and proposal version are bound to approval.",
    evidence:
      "Illustrative draft: “Hi Jordan, following up on the proposal we shared. Would a conversation help you review the agreed scope?” No message was sent.",
  },
  {
    name: "A reply hands off the conversation",
    owner: "Appointment Coordinator",
    description:
      "An interested reply stops the follow-up and creates an explicit scheduling handoff to one owner.",
    evidence:
      "Invented reply: “Let’s find a time to discuss.” This is a sample human response, not a collected business outcome.",
  },
  {
    name: "A booking becomes its own evidence stage",
    owner: "Appointment Coordinator",
    description:
      "The approved time and calendar are checked. Attendance, signed business and payments remain separate.",
    evidence:
      "Illustrative appointment only. No real calendar event exists. Attendance, signed revenue and collected revenue remain unknown.",
  },
];
const homeJourney = [
  {
    name: "An existing estimate is reviewed",
    owner: "Estimate Recovery · later live release",
    description:
      "Current job status, estimate validity, owner and contact permission determine whether follow-up is eligible.",
    evidence:
      "Synthetic source: E-204 · Summit Home Services · Open estimate · $4,500 one-time value.",
  },
  {
    name: "A reviewed conversation becomes an appointment",
    owner: "Appointment Coordinator",
    description:
      "A clear reply stops chasing and routes the customer to a permitted appointment with one conversation owner.",
    evidence:
      "Illustrative appointment. This preset does not send communication or make an actual booking.",
  },
  {
    name: "The customer accepts the proposed work",
    owner: "Customer-owned job source",
    description:
      "An accepted job needs its own source record. A calendar event is not acceptance of an estimate.",
    evidence:
      "Invented job acceptance record. Actual estimate-to-job integration is required before live use.",
  },
  {
    name: "Completed work and collection stay separate",
    owner: "Job & payment sources",
    description:
      "Completion and payment are recorded only from their own evidence. Estimate value is not cash received.",
    evidence:
      "Illustrative completion and collection stages only. No real job, invoice, payment or customer profit was observed.",
  },
];

export default function Demo() {
  const [session, setSession] = useState<DemoSession>(() => initial());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All groups");
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = Session.safeParse(JSON.parse(saved));
        if (
          parsed.success &&
          parsed.data.team.every((id) =>
            catalog.some((agent) => agent.id === id),
          )
        )
          setSession(parsed.data);
      }
    } catch {
      setMessage(
        "Browser storage is unavailable. This demo will work until the page is refreshed.",
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch {
        /* In-memory fallback remains session-local and synthetic. */
      }
  }, [session, ready]);
  const update = (patch: Partial<DemoSession>) =>
    setSession((current) => ({ ...current, ...patch }));
  const updateScenario = <K extends keyof ForecastScenario>(
    key: K,
    value: ForecastScenario[K],
  ) =>
    setSession((current) => ({
      ...current,
      scenario: { ...current.scenario, [key]: value },
    }));
  const changePreset = (preset: DemoSession["preset"]) => {
    setSession(initial(preset));
    setMessage(
      "Loaded a labeled synthetic preset. This affects only your current browser session.",
    );
  };
  const reset = () => {
    setSession(initial());
    setTab("overview");
    setMessage(
      "Your synthetic session has been reset. Other sessions and operational workspaces are unchanged.",
    );
  };
  const home = session.preset === "home_services";
  const journey = home ? homeJourney : b2bJourney;
  let cases: ReturnType<typeof forecastCases> = [];
  let invalid = "";
  try {
    cases = forecastCases(session.scenario);
  } catch {
    invalid =
      "Check that low ≤ base ≤ high, each percentage is between 0 and 100, and cohort overlap is resolved.";
  }
  const toggle = (id: string) => {
    if (session.team.includes(id))
      update({ team: session.team.filter((item) => item !== id) });
    else if (session.team.length < 5) update({ team: [...session.team, id] });
    else
      setMessage(
        "Your package has five specialist slots. Remove one to explore a different team.",
      );
  };
  const navigate = (next: Tab) => {
    setTab(next);
    document.getElementById("demo-main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  };
  const filtered = catalog.filter(
    (agent) =>
      (category === "All groups" || agent.category === category) &&
      `${agent.name} ${agent.responsibility}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <a className="skip-link" href="#demo-main">
        Skip to demo
      </a>
      <header className="demo-header">
        <div className="demo-brand">
          <span
            className="brand-wordmark"
            role="img"
            aria-label="David Engine"
          />
        </div>
        <nav className="demo-nav" aria-label="Demo sections">
          {(
            [
              ["overview", "The experience"],
              ["team", "Your five specialists"],
              ["scenario", "Explore the numbers"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button className="btn btn-small" onClick={reset}>
          <RotateCcw size={13} />
          Reset demo
        </button>
      </header>
      <main className="demo-main" id="demo-main" tabIndex={-1}>
        <div className="demo-mode">
          <div className="flex" style={{ gap: 7 }}>
            <FlaskConical size={15} color="#8b6a2b" />
            <span>
              <strong>Illustrative demo</strong> · Synthetic people,
              interactions and results. No live systems connected.
            </span>
          </div>
          <span>Private to this browser session · No sign-in required</span>
        </div>
        {message && (
          <div className="demo-toast" role="status">
            {message}
          </div>
        )}
        {tab === "overview" && (
          <>
            <div className="demo-heading">
              <div className="demo-eyebrow">
                A focused team. A shared business goal.
              </div>
              <h1>
                See what working together
                <br />
                could look like.
              </h1>
              <p>
                Follow a sample customer journey, build your team of five and
                explore the assumptions behind the opportunity. Every step is
                yours to inspect.
              </p>
            </div>
            <div className="preset-row">
              <button
                className="preset-card"
                aria-pressed={!home}
                onClick={() => changePreset("b2b_services")}
              >
                <div className="demo-icon red">
                  <BriefcaseBusiness size={20} />
                </div>
                <div>
                  <strong>B2B services</strong>
                  <small>Open proposal → booked conversation</small>
                </div>
                {!home && (
                  <Check
                    size={17}
                    color="var(--accent)"
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </button>
              <button
                className="preset-card"
                aria-pressed={home}
                onClick={() => changePreset("home_services")}
              >
                <div className="demo-icon">
                  <Home size={20} />
                </div>
                <div>
                  <strong>Home services</strong>
                  <small>Existing estimate → completed work & collection</small>
                </div>
                {home && (
                  <Check
                    size={17}
                    color="var(--accent)"
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </button>
            </div>
            <div className="demo-layout">
              <div className="stack">
                <section className="card">
                  <div className="card-head">
                    <div>
                      <h2>
                        {home ? "Summit Home Services" : "Northstar Advisory"}
                      </h2>
                      <p className="help" style={{ marginTop: 6 }}>
                        Fictional company ·{" "}
                        {home
                          ? "Home-service recovery"
                          : "B2B proposal follow-up"}
                      </p>
                    </div>
                    <span className="badge badge-warning">
                      <FlaskConical size={11} />
                      Synthetic journey
                    </span>
                  </div>
                  <div
                    className="card-body"
                    style={{ paddingTop: 0, paddingBottom: 0 }}
                  >
                    {journey.map((stage, index) => (
                      <article className="journey-stage" key={stage.name}>
                        <span
                          className={`stage-check ${index < session.stage ? "done" : index === session.stage ? "current" : ""}`}
                        >
                          {index < session.stage ? (
                            <Check size={13} />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div className="eyebrow" style={{ fontSize: 9 }}>
                            {stage.owner}
                          </div>
                          <h3>{stage.name}</h3>
                          <p>{stage.description}</p>
                          {index < session.stage && (
                            <div className="stage-reveal">
                              <strong>Illustrative evidence</strong>
                              <br />
                              {stage.evidence}
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                  <div
                    className="card-body between"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <span className="help">
                      {session.stage >= journey.length
                        ? "Journey complete · Sample evidence only"
                        : `Step ${Math.min(session.stage + 1, journey.length)} of ${journey.length}`}
                    </span>
                    <button
                      className="btn btn-primary"
                      disabled={session.stage >= journey.length}
                      onClick={() =>
                        update({
                          stage: Math.min(session.stage + 1, journey.length),
                        })
                      }
                    >
                      {session.stage >= journey.length
                        ? "Sample journey complete"
                        : "Explore the next step"}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
                <div className="notice">
                  <ShieldCheck size={19} />
                  <p>
                    {home
                      ? "This home-service journey illustrates a later live release. Estimate, job and payment integrations still require their own implementation and verification."
                      : "The live pilot follows existing proposals. It cannot invent a contract, change price or terms, or turn a meeting into payment evidence."}
                  </p>
                </div>
              </div>
              <aside className="stack">
                <section className="demo-dark">
                  <div className="eyebrow">Your proposed team</div>
                  <h2>
                    Five responsibilities.
                    <br />
                    One connected journey.
                  </h2>
                  <p>
                    Context, strategy, reporting and coordination are shared.
                    They do not use another specialist slot.
                  </p>
                  <div style={{ marginTop: 16 }}>
                    {session.team.map((id, index) => {
                      const agent = catalog.find((a) => a.id === id)!;
                      return (
                        <div className="demo-team-row" key={id}>
                          <span className="demo-team-number">{index + 1}</span>
                          <div>
                            <h3>{agent.name}</h3>
                            <p>
                              {agent.releaseStatus === "planned"
                                ? "Catalog scope · execution unavailable"
                                : agent.modes.includes("preparation")
                                  ? "Preparation · reviewed internal artifacts"
                                  : "Monitored execution · pilot verification required"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="btn"
                    style={{ marginTop: 24, width: "100%" }}
                    onClick={() => navigate("team")}
                  >
                    Make the team your own
                    <ArrowRight size={14} />
                  </button>
                </section>
                <section className="card card-body">
                  <div className="flex">
                    <Target size={19} color="var(--accent)" />
                    <h3 style={{ fontSize: 15 }}>Explore the opportunity</h3>
                  </div>
                  <p className="small muted" style={{ margin: "14px 0 18px" }}>
                    Start with one recovery cohort. Adjust shared conversion
                    assumptions and see how real capacity limits the planning
                    cases.
                  </p>
                  <button
                    className="link-button"
                    onClick={() => navigate("scenario")}
                  >
                    Open the shared scenario
                    <ArrowRight size={13} />
                  </button>
                </section>
              </aside>
            </div>
            <section className="card card-body" style={{ marginTop: 24 }}>
              <div className="between">
                <div>
                  <h2 style={{ fontSize: 17 }}>
                    A starting profile, with clear limits.
                  </h2>
                  <p className="small muted" style={{ marginTop: 10 }}>
                    Public URL analysis is unavailable in this deployment. Use
                    one of the labeled presets above; neither preset claims to
                    have analyzed your website.
                  </p>
                </div>
                <span className="badge badge-warning">
                  <AlertCircle size={11} />
                  Retrieval unavailable
                </span>
              </div>
              <label className="check-row" style={{ marginTop: 20 }}>
                <input
                  type="checkbox"
                  checked={session.confirmed}
                  onChange={(e) => update({ confirmed: e.target.checked })}
                />
                I understand this profile is illustrative and would confirm real
                company facts before activation.
              </label>
            </section>
          </>
        )}
        {tab === "team" && (
          <div className="stack">
            <div className="demo-heading">
              <div className="demo-eyebrow">
                Choose the outcome, then the team
              </div>
              <h1>
                The right five
                <br />
                for the work ahead.
              </h1>
              <p>
                Explore all 32 specialist responsibilities. A selected card is a
                responsibility in your proposed team; its available mode and
                prerequisites stay visible.
              </p>
            </div>
            <section className="card card-body">
              <div className="grid-two">
                <label className="field">
                  Business goal
                  <select
                    className="input"
                    value={session.goal}
                    onChange={(e) => update({ goal: e.target.value })}
                  >
                    <option value={session.goal}>{session.goal}</option>
                    {goals
                      .filter((goal) => goal !== session.goal)
                      .map((goal) => (
                        <option key={goal}>{goal}</option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  Illustrative business model
                  <select
                    className="input"
                    value={session.preset}
                    onChange={(e) =>
                      changePreset(e.target.value as DemoSession["preset"])
                    }
                  >
                    <option value="b2b_services">B2B services</option>
                    <option value="home_services">Home services</option>
                  </select>
                </label>
              </div>
              <div className="between" style={{ marginTop: 20 }}>
                <p className="help">
                  Goal, applicability and implemented modes shape the
                  recommendation. You retain manual choice.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    update({
                      team: recommendedAgentIds(session.goal, session.preset),
                    });
                    setMessage(
                      "Your recommended five are saved in this illustrative session.",
                    );
                  }}
                >
                  <ListChecks size={14} />
                  Recommend my five
                </button>
              </div>
            </section>
            <div className="demo-selected">
              <Users size={21} color="var(--accent)" />
              <div style={{ flex: 1 }}>
                <div className="between">
                  <strong className="small">
                    Your team · {session.team.length} / 5
                  </strong>
                  <span className="help">$5,000 / month product package</span>
                </div>
                <div className="flex wrap" style={{ marginTop: 12, gap: 8 }}>
                  {session.team.map((id) => (
                    <span className="badge badge-info" key={id}>
                      {catalog.find((agent) => agent.id === id)?.name}
                    </span>
                  ))}
                </div>
                <p className="help" style={{ marginTop: 12 }}>
                  Preparation availability does not establish a proven
                  $1,000-per-specialist return. Shared reporting, context and
                  coordination consume no slots.
                </p>
              </div>
            </div>
            <div className="between">
              <label className="field" style={{ minWidth: 240 }}>
                Search specialists
                <input
                  className="input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or responsibility"
                />
              </label>
              <label className="field">
                Responsibility group
                <select
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {[
                    "All groups",
                    ...new Set(catalog.map((agent) => agent.category)),
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="demo-catalog">
              {filtered.map((agent) => {
                const selected = session.team.includes(agent.id);
                const applicable = agent.supportedArchetypes.includes(
                  session.preset,
                );
                return (
                  <article
                    key={agent.id}
                    className={`card demo-specialist ${selected ? "selected" : ""}`}
                  >
                    <div className="between">
                      <div className={`demo-icon ${selected ? "red" : ""}`}>
                        <ListChecks size={18} />
                      </div>
                      <span className="eyebrow" style={{ fontSize: 9 }}>
                        {agent.category}
                      </span>
                    </div>
                    <h3>{agent.name}</h3>
                    <p>{agent.responsibility}</p>
                    <div className="flex wrap" style={{ gap: 5 }}>
                      <span
                        className={`badge badge-${agent.releaseStatus === "planned" ? "warning" : "info"}`}
                      >
                        {agent.releaseStatus === "planned"
                          ? "Catalog scope"
                          : agent.releaseStatus === "pilot"
                            ? "Pilot verification needed"
                            : "Preparation implemented"}
                      </span>
                      {!applicable && (
                        <span className="badge badge-warning">
                          Outside selected business model
                        </span>
                      )}
                    </div>
                    <details className="help" style={{ marginTop: 14 }}>
                      <summary style={{ cursor: "pointer" }}>
                        Dependencies & operating limits
                      </summary>
                      <p style={{ marginTop: 8 }}>
                        {[...agent.prerequisites, ...agent.dependencies]
                          .map(words)
                          .join(" · ")}
                        . {agent.fallback}
                      </p>
                    </details>
                    <button
                      className={`btn ${selected ? "" : "btn-primary"}`}
                      disabled={
                        !selected && (!applicable || session.team.length >= 5)
                      }
                      onClick={() => toggle(agent.id)}
                    >
                      {selected ? <Check size={13} /> : <Users size={13} />}{" "}
                      {selected ? "Selected · remove" : "Add to your five"}
                    </button>
                  </article>
                );
              })}
            </div>
            {!filtered.length && (
              <div className="card card-body small muted">
                No matching specialists. Clear your search or choose another
                group.
              </div>
            )}
          </div>
        )}
        {tab === "scenario" && (
          <div className="stack">
            <div className="demo-heading">
              <div className="demo-eyebrow">
                Illustrative shared-funnel planning
              </div>
              <h1>
                Make the assumptions
                <br />
                part of the conversation.
              </h1>
              <p>
                One cohort moves through one funnel. Each specialist contributes
                to the same journey, so opportunities and value are counted
                once.
              </p>
            </div>
            <div className="notice notice-warning">
              <FlaskConical size={18} />
              <p>
                These are editable scenarios, not observed outcomes, promised
                results or statistical confidence intervals. Financial return is
                unavailable without baseline and cost evidence.
              </p>
            </div>
            <section className="card card-body stack">
              <div className="between">
                <h2 style={{ fontSize: 17 }}>{session.scenario.name}</h2>
                <span className="badge badge-info">Saved in this session</span>
              </div>
              <div className="grid-two">
                <div className="grid-two" style={{ gap: 16 }}>
                  <label className="field">
                    Existing recovery cohort
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="1000000"
                      value={session.scenario.volume}
                      onChange={(e) =>
                        updateScenario("volume", Number(e.target.value))
                      }
                    />
                  </label>
                  <label className="field">
                    Horizon (days)
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max="730"
                      value={session.scenario.horizonDays}
                      onChange={(e) =>
                        updateScenario("horizonDays", Number(e.target.value))
                      }
                    />
                  </label>
                </div>
                <div className="grid-two" style={{ gap: 16 }}>
                  <label className="field">
                    Capacity (final outcomes)
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={session.scenario.capacity}
                      onChange={(e) =>
                        updateScenario("capacity", Number(e.target.value))
                      }
                    />
                  </label>
                  <label className="field">
                    Value per final outcome ({session.scenario.currency})
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={(session.scenario.valueMinor ?? 0) / 100}
                      onChange={(e) =>
                        updateScenario(
                          "valueMinor",
                          Math.round(Number(e.target.value) * 100),
                        )
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="demo-conversions">
                <span className="eyebrow">Conversion stage</span>
                <span className="eyebrow">Low %</span>
                <span className="eyebrow">Base %</span>
                <span className="eyebrow">High %</span>
                {session.scenario.conversions.map((stage, index) => (
                  <div key={stage.label} style={{ display: "contents" }}>
                    <span className="small">{stage.label}</span>
                    {(["low", "base", "high"] as const).map((key) => (
                      <input
                        key={key}
                        className="input numeric"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        aria-label={`${stage.label} ${key} conversion percent`}
                        value={Math.round(stage[key] * 10000) / 100}
                        onChange={(e) =>
                          updateScenario(
                            "conversions",
                            session.scenario.conversions.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    [key]: Number(e.target.value) / 100,
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={session.scenario.overlapResolved}
                  onChange={(e) =>
                    updateScenario("overlapResolved", e.target.checked)
                  }
                />
                This recovery cohort is distinct from new-demand records;
                overlap is resolved.
              </label>
            </section>
            {invalid && (
              <div className="notice notice-danger" role="alert">
                <AlertCircle size={18} />
                <p>{invalid}</p>
              </div>
            )}
            <div className="demo-cases">
              {cases.map((item) => (
                <article
                  className={`demo-case ${item.case === "base" ? "base" : ""}`}
                  key={item.case}
                >
                  <div className="between">
                    <span className="eyebrow">{item.case} case</span>
                    <span className="badge badge-warning">Scenario</span>
                  </div>
                  <strong className="numeric">{item.wins.toFixed(1)}</strong>
                  <p className="small">
                    {home ? "Completed & collected jobs" : "Won proposals"} ·{" "}
                    {session.scenario.horizonDays} days
                  </p>
                  <p style={{ fontSize: 20, margin: "18px 0 10px" }}>
                    {money(item.revenueMinor, session.scenario.currency)}{" "}
                    <span className="help">illustrative value</span>
                  </p>
                  <p className="help">
                    {item.capacityLimited
                      ? "Constrained by stated capacity"
                      : "Within stated capacity"}
                    <br />
                    Incremental ROI: unavailable
                    <br />
                    Observed comparison: no connected evidence
                  </p>
                </article>
              ))}
            </div>
            <section className="card card-body">
              <h2 style={{ fontSize: 17, marginBottom: 16 }}>
                What would make this useful for your business?
              </h2>
              <div className="grid-two">
                <p className="small muted">
                  A defined source cohort, a comparable baseline, verified stage
                  definitions and a realistic capacity limit. A website alone
                  does not provide these inputs.
                </p>
                <p className="small muted">
                  For a live customer, DAVID stores scenarios separately from
                  observed outcomes. New-demand and recovery cohorts cannot be
                  added together until overlap is resolved.
                </p>
              </div>
            </section>
          </div>
        )}
        <footer className="demo-footer">
          <span>
            DAVID · Five specialists from 32, with shared context and
            coordination.
          </span>
          <span>
            No operational API access · No account credentials · Synthetic
            session only
          </span>
        </footer>
      </main>
    </>
  );
}
