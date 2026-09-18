"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppSnapshot,
  Command,
  CommandResult,
  EvidenceRef,
} from "@david/contracts";
import { money, words } from "@david/ui";
import { OnboardingOperator } from "./onboarding";
import { PreparedOnboarding } from "./prepared-onboarding";
import {briefingFinished} from "@david/domain/briefing";
import { DEFAULT_PREVIEW_WORKSPACE } from "@david/domain";
import {BriefingHandoff} from "./briefing/handoff";
import { Today } from "./today";
import {
  AlertCircle,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  Menu,
  Pause,
  Plug,
  RefreshCw,
  Settings2,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  dateTime,
  DavidSilhouette,
  Drawer,
  Evidence,
  EvidenceAccessContext,
  FeedbackContext,
  QuietWalkthroughContext,
} from "./ui";
import {
  Connections,
  CustomerJourney,
  Decisions,
  Operator,
  Opportunities,
  Scenarios,
  Team,
} from "./screens";

export type PageId =
  | "today"
  | "team"
  | "activation"
  | "opportunities"
  | "decisions"
  | "journey"
  | "scenarios"
  | "connections"
  | "operator";
export type ScreenProps = {
  state: AppSnapshot;
  act: (command: Command) => Promise<CommandResult | undefined>;
  busy: boolean;
  navigate: (page: PageId, focus?: { proposal?: string; agent?: string; lead?: string; setup?: boolean }) => void;
  inspect: (
    title: string,
    description: string,
    evidence: EvidenceRef[],
  ) => void;
  browserDemo?: boolean;
};
const navigation = [
  { id: "today", label: "Dashboard", icon: LayoutDashboard },
  { id: "opportunities", label: "Pipeline", icon: Target },
  { id: "scenarios", label: "Forecast", icon: BarChart3 },
  { id: "team", label: "AI Agents", icon: Sparkles },
  { id: "connections", label: "Connections", icon: Plug },
] as const;
const hiddenPages = ["decisions", "journey"] as const;

export type WorkspaceDataSource = {
  list(): Promise<{ workspaces: { id: string; name: string }[]; limited?: boolean }>;
  read(workspace: string | null): Promise<AppSnapshot>;
  execute(workspace: string | null, command: Command): Promise<CommandResult>;
};

export function AppShell({ browserDemo }: { browserDemo?: WorkspaceDataSource } = {}) {
  const [state, setState] = useState<AppSnapshot | null>(null);
  const [page, setPage] = useState<PageId>("today");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [detail, setDetail] = useState<{
    title: string;
    description: string;
    evidence: EvidenceRef[];
  } | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const mutationEpoch = useRef(0);
  const mutating = useRef(false);
  const workspaceKey = useRef<string | null>(null);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [workspaceListError, setWorkspaceListError] = useState("");
  const loadWorkspaces = useCallback(async () => {
    try {
      const result = browserDemo ? await browserDemo.list() : await (async () => {
        const response = await fetch("/api/workspaces", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.message ?? "Assigned workspaces could not be loaded.",
          );
        return result;
      })();
      if (
        !Array.isArray(result.workspaces) ||
        !result.workspaces.every(
          (item: unknown) =>
            item !== null &&
            typeof item === "object" &&
            "id" in item &&
            typeof item.id === "string" &&
            "name" in item &&
            typeof item.name === "string",
        )
      )
        throw new Error("The workspace list could not be validated.");
      setWorkspaces(result.workspaces);
      setWorkspaceListError(
        result.limited
          ? "Showing the first 100 assigned workspaces. Contact your operator for additional assignments."
          : "",
      );
    } catch (error) {
      setWorkspaces([]);
      setWorkspaceListError(
        error instanceof Error ? error.message : "Workspace list unavailable.",
      );
    }
  }, [browserDemo]);

  const load = useCallback(async () => {
    if (mutating.current) return;
    const epoch = mutationEpoch.current;
    try {
      const requested =
        workspaceKey.current ??
        new URLSearchParams(window.location.search).get("workspace");
      const snapshot: AppSnapshot | null = browserDemo ? await browserDemo.read(requested) : await (async () => {
        const response = await fetch(
          `/api/state${requested ? `?${new URLSearchParams({ workspace: requested })}` : ""}`,
          {
            cache: "no-store",
            credentials: "same-origin",
          },
        );
        const result = await response.json();
        if (!requested && response.status === 403 && result.error === "WORKSPACE_UNASSIGNED") {
          if (!mutating.current && epoch === mutationEpoch.current)
            window.location.replace(sessionStorage.getItem("david.pendingInvitation") ? "/join" : "/start");
          return null;
        }
        if (!response.ok)
          throw new Error(
            result.message ?? result.error ?? "Unable to load this workspace.",
          );
        return result.snapshot ?? result;
      })();
      if (!snapshot || mutating.current || epoch !== mutationEpoch.current) return;
      workspaceKey.current =
        snapshot.workspace.mode === "fixture"
          ? (requested ?? (browserDemo ? DEFAULT_PREVIEW_WORKSPACE : "david"))
          : snapshot.workspace.id;
      if (!browserDemo && snapshot.workspace.mode !== "fixture" && !new URLSearchParams(window.location.search).has("view") && snapshot.onboarding && !snapshot.onboarding.appliedRevision && snapshot.activation.milestone === "not_started" && !briefingFinished(snapshot.onboarding.answers) && ["workspace_owner","david_operator"].includes(snapshot.context.role)) {
        setPage(snapshot.onboarding.answers.team.length ? "team" : "connections");
      }
      setState(snapshot);
      setLoadError("");
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "The workspace could not be loaded.",
      );
    }
  }, [browserDemo]);
  useEffect(() => {
    void load();
    void loadWorkspaces();
    const interval = setInterval(() => {
      void load();
    }, 30_000);
    return () => clearInterval(interval);
  }, [load, loadWorkspaces]);
  useEffect(() => {
    const sync = () => {
      const value = new URLSearchParams(window.location.search).get("view");
      const next = browserDemo && value === "operator" ? "today" : value;
      if (
        [
          ...navigation.map((item) => item.id),
          ...hiddenPages,
          "operator",
          "activation",
        ].includes(next ?? "")
      )
        setPage(next as PageId);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [browserDemo]);
  const navigate = (next: PageId, focus?: { proposal?: string; agent?: string; lead?: string; setup?: boolean }) => {
    setPage(next);
    setMenu(false);
    const query = new URLSearchParams(window.location.search);
    query.set("view", next);
    if (next !== "connections") {
      query.delete("google");
      query.delete("connection");
    }
    if (next !== "team") query.delete("team");
    if (next === "team" || next === "today") {
      if (focus?.agent) query.set("agent", focus.agent);
      else query.delete("agent");
    } else query.delete("agent");
    if (next === "team" && focus?.setup && focus.agent) query.set("setup", "1");
    else if (next !== "activation") query.delete("setup");
    if (next !== "opportunities") query.delete("import");
    query.delete("proposal");
    if (focus?.proposal) query.set("proposal", focus.proposal);
    if (next === "opportunities" && focus?.lead) query.set("lead", focus.lead);
    else query.delete("lead");
    if (workspaceKey.current) query.set("workspace", workspaceKey.current);
    window.history.pushState({}, "", `?${query}`);
    document.getElementById("main-content")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  };
  const switchWorkspace = (id: string) => {
    if (!workspaces.some((workspace) => workspace.id === id)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", id);
    url.searchParams.set("view", page);
    url.searchParams.delete("google");
    url.searchParams.delete("connection");
    url.searchParams.delete("team");
    url.searchParams.delete("agent");
    url.searchParams.delete("import");
    url.searchParams.delete("lead");
    url.searchParams.delete("proposal");
    url.searchParams.delete("setup");
    window.location.assign(`${url.pathname}${url.search}`);
  };
  const act = async (command: Command): Promise<CommandResult | undefined> => {
    if (mutating.current) return;
    mutating.current = true;
    mutationEpoch.current += 1;
    setBusy(true);
    setNotice(null);
    try {
      const result: CommandResult = browserDemo ? await browserDemo.execute(workspaceKey.current, command) : await (async () => {
        const response = await fetch(
          `/api/command${workspaceKey.current ? `?${new URLSearchParams({ workspace: workspaceKey.current })}` : ""}`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(command),
          },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.message ??
              result.error ??
              "The action could not be completed.",
          );
        return result;
      })();
      setState(result.snapshot);
      setNotice({ text: result.message, error: false });
      return result;
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Action failed. Refresh the workspace and retry.",
        error: true,
      });
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  };
  const inspect = (
    title: string,
    description: string,
    evidence: EvidenceRef[],
  ) => setDetail({ title, description, evidence });
  const currentLabel =
    page === "operator"
      ? "Operator console"
      : page === "activation"
        ? "Company profile"
        : page === "decisions"
          ? "Decisions"
          : page === "journey"
            ? "Journey"
            : (navigation.find((item) => item.id === page)?.label ?? "Dashboard");
  const isOperator =
    state?.context.role === "david_operator" ||
    state?.workspace.mode === "fixture";

  if (!state)
    return (
      <div className="loading-screen">
        <div className="card stack">
          <div className="brand" style={{ color: "var(--text)", padding: 0 }}>
            <span
              className="brand-wordmark"
              role="img"
              aria-label="David Engine"
            />
          </div>
          <h1 style={{ fontSize: 24 }}>
            {loadError
              ? "Your workspace is unavailable"
              : "Opening your workspace"}
          </h1>
          <p className="small muted" role={loadError ? "alert" : "status"}>
            {loadError ||
              "Loading current work, decisions and source evidence."}
          </p>
          {loadError ? (
            <div className="flex wrap">
              <Button onClick={() => void load()}>
                <RefreshCw size={15} />
                Try again
              </Button>
              {!browserDemo && <a href="/login" className="btn btn-primary">
                Sign in to DAVID
              </a>}
              {!browserDemo && <a href="/start" className="btn">Set up a new company</a>}
            </div>
          ) : (
            <LoaderCircle size={22} aria-hidden />
          )}
          <p className="tiny muted">
            {browserDemo
              ? "Loading the workspace."
              : "Setting up your own company? Create a workspace. Joining an existing company? Use the invitation from its owner."}
          </p>
        </div>
      </div>
    );
  const props: ScreenProps = { state, act, busy, navigate, inspect, browserDemo: !!browserDemo };
  if(page === "activation" && !(state.onboarding?.appliedRevision&&!state.onboarding.answers.briefing) && new URLSearchParams(window.location.search).get("mode") !== "profile") return <FeedbackContext.Provider value={notice}><PreparedOnboarding key={state.workspace.id} {...props}/></FeedbackContext.Provider>;
  return (
    <FeedbackContext.Provider value={notice}>
      <QuietWalkthroughContext.Provider value={!!browserDemo}>
      <EvidenceAccessContext.Provider
        value={{ workspaceId: state.workspace.id, mode: state.workspace.mode }}
      >
        <div className="app-shell studio-app">
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          {menu && (
            <button
              className="mobile-scrim"
              aria-label="Close navigation"
              onClick={() => setMenu(false)}
            />
          )}
          <aside
            className={`sidebar ${menu ? "open" : ""}`}
            aria-label="Main navigation"
            inert={mobile && !menu}
            aria-hidden={mobile && !menu ? true : undefined}
          >
            <a
              className="brand"
              href="?view=today"
              aria-label="David Engine home"
              onClick={(event) => {
                event.preventDefault();
                navigate("today");
              }}
            >
              <span
                className="brand-wordmark"
                role="img"
                aria-label="David Engine"
              />
            </a>
            <div className="workspace-chip">
              <span className="workspace-avatar">DA</span>
              <div style={{ flex: 1 }}>
                <strong
                  className="mobile-workspace-name"
                  style={{ fontWeight: 500 }}
                >
                  {state.workspace.name}
                </strong>
                <div
                  className="tiny"
                  style={{ color: "#969ba6", marginTop: 3 }}
                >
                  Your workspace
                </div>
                <select
                  className="workspace-picker desktop-workspace-picker"
                  aria-label="Active workspace"
                  disabled={busy || !workspaces.length}
                  value={
                    state.workspace.mode === "fixture"
                      ? (workspaceKey.current ?? (browserDemo ? DEFAULT_PREVIEW_WORKSPACE : "david"))
                      : state.workspace.id
                  }
                  onChange={(event) => switchWorkspace(event.target.value)}
                >
                  {!workspaces.length && (
                    <option
                      value={
                        state.workspace.mode === "fixture"
                          ? (workspaceKey.current ?? (browserDemo ? DEFAULT_PREVIEW_WORKSPACE : "david"))
                          : state.workspace.id
                      }
                    >
                      {state.workspace.name}
                    </option>
                  )}
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Switch workspace"
                  className="mobile-workspace-picker"
                  disabled={busy || !workspaces.length}
                  value={
                    state.workspace.mode === "fixture"
                      ? (workspaceKey.current ?? (browserDemo ? DEFAULT_PREVIEW_WORKSPACE : "david"))
                      : state.workspace.id
                  }
                  onChange={(event) => switchWorkspace(event.target.value)}
                >
                  {!workspaces.length && (
                    <option
                      value={
                        state.workspace.mode === "fixture"
                          ? (workspaceKey.current ?? (browserDemo ? DEFAULT_PREVIEW_WORKSPACE : "david"))
                          : state.workspace.id
                      }
                    >
                      {state.workspace.name}
                    </option>
                  )}
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="nav-label">Workspace</div>
            <nav className="nav">
              {navigation.map((item) => (
                <a
                  href={`?${new URLSearchParams({ view: item.id, ...(workspaceKey.current ? { workspace: workspaceKey.current } : {}) })}`}
                  key={item.id}
                  aria-current={page === item.id ? "page" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(item.id);
                  }}
                >
                  <item.icon />
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="sidebar-bottom">
              {isOperator && !browserDemo && (
                <nav className="nav">
                  <a
                    href={`?${new URLSearchParams({ view: "activation", mode: "profile", ...(workspaceKey.current ? { workspace: workspaceKey.current } : {}) })}`}
                    aria-current={page === "activation" ? "page" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      const url = new URL(window.location.href);
                      url.searchParams.set("mode", "profile");
                      window.history.replaceState({}, "", url.pathname + url.search);
                      navigate("activation");
                    }}
                  >
                    <ListChecks />
                    Company profile
                  </a>
                  <a
                    href={`?${new URLSearchParams({ view: "operator", ...(workspaceKey.current ? { workspace: workspaceKey.current } : {}) })}`}
                    aria-current={page === "operator" ? "page" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate("operator");
                    }}
                  >
                    <Settings2 />
                    Operator console
                  </a>
                </nav>
              )}
              <div className="sidebar-help">
                <DavidSilhouette className="sidebar-david" />
                <div>Work you can inspect.</div>
                <span>
                  Sources, saved work and operating limits are visible for every
                  agent.
                </span>
              </div>
              <div className="profile">
                <span className="workspace-avatar">
                  {state.workspace.mode === "fixture" ? "OP" : "DA"}
                </span>
                <div>
                  {browserDemo
                    ? "Workspace owner"
                    : state.workspace.mode === "fixture"
                    ? "Local operator"
                    : words(state.context.role)}
                  <small>
                    {browserDemo
                      ? state.workspace.name
                      : state.workspace.mode === "fixture"
                      ? "Synthetic workspace"
                      : "Authenticated workspace"}
                  </small>
                </div>
                <CircleHelp
                  size={15}
                  style={{ marginLeft: "auto", color: "#8c929d" }}
                />
              </div>
            </div>
          </aside>
          <div className="workspace-main">
            <header className="topbar">
              <div className="flex">
                <button
                  className="icon-button mobile-menu"
                  onClick={() => setMenu(!menu)}
                  aria-label="Toggle navigation"
                  aria-expanded={menu}
                >
                  <Menu size={18} />
                </button>
                <span
                  className="brand-wordmark mobile-brand"
                  role="img"
                  aria-label="David Engine"
                />
                <div className="breadcrumb">
                  <span className="breadcrumb-root">Workspace</span>
                  <ChevronRight size={12} />
                  <b>{currentLabel}</b>
                </div>
              </div>
              <div className="topbar-actions">
                <span className="tiny muted asof">
                  As of {dateTime(state.asOf)}
                </span>
                {!browserDemo && (
                  <Badge
                    tone={
                      state.workspace.mode === "live" ? "positive" : "warning"
                    }
                  >
                    <span className="environment-dot" />
                    {state.workspace.mode === "fixture"
                      ? "Fixture mode"
                      : words(state.workspace.mode)}
                  </Badge>
                )}
                <button
                  className="icon-button"
                  onClick={() => void load()}
                  aria-label="Refresh workspace"
                >
                  <RefreshCw size={15} />
                </button>
              </div>
            </header>
            <main id="main-content" tabIndex={-1} className="main">
              {workspaceListError && (
                <div
                  className="notice notice-warning"
                  role="alert"
                  style={{ marginBottom: 16 }}
                >
                  <AlertCircle size={18} />
                  <div>
                    {workspaceListError}
                    <br />
                    <button
                      className="link-button"
                      onClick={() => void loadWorkspaces()}
                    >
                      Retry workspace list
                    </button>
                  </div>
                </div>
              )}
              {state.workspace.mode === "fixture" && !browserDemo && (
                <div className="fixture-banner">
                  <FlaskConical size={14} />
                  <span>
                    <strong>Local demonstrator.</strong>{" "}
                    Synthetic records and outcomes. No real messages are sent or appointments booked.
                  </span>
                </div>
              )}
              {loadError && (
                <div
                  className="notice notice-danger"
                  role="alert"
                  style={{ marginBottom: 20 }}
                >
                  <AlertCircle size={18} />
                  <div>
                    Refresh failed. The last loaded state may be stale.{" "}
                    {loadError}
                    <br />
                    <Button className="btn-small" onClick={() => void load()}>
                      Retry refresh
                    </Button>
                  </div>
                </div>
              )}
              {state.workspace.paused && (
                <div
                  className="notice notice-warning"
                  style={{ marginBottom: 24 }}
                >
                  <Pause size={18} />
                  <div>
                    <strong>Workspace paused.</strong> New dispatch is stopped.
                    A provider call already in flight may still complete
                    {browserDemo
                      ? "."
                      : "; review uncertain actions in the operator console."}
                  </div>
                </div>
              )}
              {page === "today" && <BriefingHandoff {...props}/> }
              {page === "today" && (
                <Today
                  {...props}
                  showBrief={async () => {
                    const result = await act({ type: "brief" });
                    if (result) setBriefOpen(true);
                  }}
                />
              )}
              {page === "team" && <Team {...props} />}
              {page === "activation" && <PreparedOnboarding key={state.workspace.id} {...props} />}
              {page === "opportunities" && <Opportunities {...props} />}
              {page === "decisions" && <Decisions {...props} />}
              {page === "journey" && <CustomerJourney {...props} />}
              {page === "scenarios" && <Scenarios {...props} />}
              {page === "connections" && <Connections key={state.workspace.id} {...props} />}
              {page === "operator" && !browserDemo && <div className="stack"><OnboardingOperator {...props} /><Operator {...props} /></div>}
              <footer className="footer">
                <span>
                  DAVID Engine <span style={{ margin: "0 7px" }}>·</span>{" "}
                  {state.workspace.name}
                </span>
                <span>
                  {state.workspace.timeZone}{" "}
                  <span style={{ margin: "0 7px" }}>·</span>{" "}
                  {browserDemo || state.workspace.mode !== "fixture"
                    ? "Source-linked evidence"
                    : "Synthetic evidence only"}
                </span>
              </footer>
            </main>
          </div>
          {notice && (
            <div
              className={`toast ${notice.error ? "error" : ""}`}
              role={notice.error ? "alert" : "status"}
            >
              {notice.error ? <AlertCircle size={19} /> : <Check size={19} />}
              <span>{notice.text}</span>
              <button
                onClick={() => setNotice(null)}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <Drawer
            open={!!detail}
            onClose={() => setDetail(null)}
            title={detail?.title ?? "Evidence"}
            description={detail?.description ?? ""}
          >
            <Evidence items={detail?.evidence ?? []} />
          </Drawer>
          <Drawer
            open={briefOpen}
            onClose={() => setBriefOpen(false)}
            title="Your weekly brief"
            description={
              state.brief
                ? `Frozen snapshot · ${dateTime(state.brief.asOf)} · ${state.brief.narrativeVersion}`
                : "No brief has been generated."
            }
          >
            {state.brief && (
              <div className="stack">
                <p className="prose">{state.brief.narrative}</p>
                {state.brief.metrics.map((metric) => (
                  <div className="between" key={metric.key}>
                    <span className="small">{metric.label}</span>
                    <strong>
                      {metric.value === null
                        ? "Unavailable"
                        : metric.unit.includes("minor")
                          ? money(metric.value, state.workspace.currency)
                          : metric.value}
                    </strong>
                  </div>
                ))}
                <div className="notice notice-warning">
                  <AlertCircle size={18} />
                  <div>
                    {state.brief.limitations.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </div>
                <Evidence items={state.brief.evidence} />
              </div>
            )}
          </Drawer>
        </div>
      </EvidenceAccessContext.Provider>
      </QuietWalkthroughContext.Provider>
    </FeedbackContext.Provider>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}{!/[.!?]$/.test(title)&&<span className="studio-heading-dot" aria-hidden="true">.</span>}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
