"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppSnapshot,
  Command,
  CommandResult,
  EvidenceRef,
} from "@david/contracts";
import { money, words } from "@david/ui";
import { Today } from "./today";
import { activeApprovals } from "./approval-state";
import {
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
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
  Route,
  Settings2,
  ShieldCheck,
  Target,
  Users,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  dateTime,
  Drawer,
  Evidence,
  EvidenceAccessContext,
  FeedbackContext,
} from "./ui";
import {
  Activation,
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
  navigate: (page: PageId, focus?: { proposal?: string }) => void;
  inspect: (
    title: string,
    description: string,
    evidence: EvidenceRef[],
  ) => void;
};
const navigation = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "team", label: "Your team", icon: Users },
  { id: "activation", label: "Activation", icon: ListChecks },
  { id: "opportunities", label: "Opportunities", icon: Target },
  {
    id: "decisions",
    label: "Decisions & initiatives",
    icon: BriefcaseBusiness,
  },
  { id: "journey", label: "Customer journey", icon: Route },
  { id: "scenarios", label: "Scenarios", icon: BarChart3 },
  { id: "connections", label: "Connections", icon: Plug },
] as const;

export function AppShell() {
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
      const response = await fetch("/api/workspaces", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ?? "Assigned workspaces could not be loaded.",
        );
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
  }, []);

  const load = useCallback(async () => {
    if (mutating.current) return;
    const epoch = mutationEpoch.current;
    try {
      const requested =
        workspaceKey.current ??
        new URLSearchParams(window.location.search).get("workspace");
      const response = await fetch(
        `/api/state${requested ? `?${new URLSearchParams({ workspace: requested })}` : ""}`,
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ?? result.error ?? "Unable to load this workspace.",
        );
      if (mutating.current || epoch !== mutationEpoch.current) return;
      const snapshot: AppSnapshot = result.snapshot ?? result;
      workspaceKey.current =
        snapshot.workspace.mode === "fixture"
          ? requested
          : snapshot.workspace.id;
      setState(snapshot);
      setLoadError("");
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "The workspace could not be loaded.",
      );
    }
  }, []);
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
      if (
        [...navigation.map((item) => item.id), "operator"].includes(value ?? "")
      )
        setPage(value as PageId);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const navigate = (next: PageId, focus?: { proposal?: string }) => {
    setPage(next);
    setMenu(false);
    const query = new URLSearchParams(window.location.search);
    query.set("view", next);
    query.delete("proposal");
    if (focus?.proposal) query.set("proposal", focus.proposal);
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
    window.location.assign(`${url.pathname}${url.search}`);
  };
  const act = async (command: Command): Promise<CommandResult | undefined> => {
    if (mutating.current) return;
    mutating.current = true;
    mutationEpoch.current += 1;
    setBusy(true);
    setNotice(null);
    try {
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
      : (navigation.find((item) => item.id === page)?.label ?? "Today");
  const pending = state ? activeApprovals(state).length : 0;
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
              <a href="/login" className="btn btn-primary">
                Sign in to DAVID
              </a>
            </div>
          ) : (
            <LoaderCircle size={22} aria-hidden />
          )}
          <p className="tiny muted">
            For the local demonstrator, start the server with
            DAVID_MODE=fixture. Deployed workspaces require an invited account.
          </p>
        </div>
      </div>
    );
  const props: ScreenProps = { state, act, busy, navigate, inspect };
  return (
    <FeedbackContext.Provider value={notice}>
      <EvidenceAccessContext.Provider
        value={{ workspaceId: state.workspace.id, mode: state.workspace.mode }}
      >
        <div className="app-shell">
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
                      ? (workspaceKey.current ?? "david")
                      : state.workspace.id
                  }
                  onChange={(event) => switchWorkspace(event.target.value)}
                >
                  {!workspaces.length && (
                    <option
                      value={
                        state.workspace.mode === "fixture"
                          ? (workspaceKey.current ?? "david")
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
                      ? (workspaceKey.current ?? "david")
                      : state.workspace.id
                  }
                  onChange={(event) => switchWorkspace(event.target.value)}
                >
                  {!workspaces.length && (
                    <option
                      value={
                        state.workspace.mode === "fixture"
                          ? (workspaceKey.current ?? "david")
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
                  {item.id === "decisions" && pending > 0 && (
                    <span className="nav-count">{pending}</span>
                  )}
                </a>
              ))}
            </nav>
            <div className="sidebar-bottom">
              {isOperator && (
                <nav className="nav">
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
                <div className="flex" style={{ gap: 7 }}>
                  <ShieldCheck size={14} />
                  Work you can inspect.
                </div>
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
                  {state.workspace.mode === "fixture"
                    ? "Local operator"
                    : words(state.context.role)}
                  <small>
                    {state.workspace.mode === "fixture"
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
              {state.workspace.mode === "fixture" && (
                <div className="fixture-banner">
                  <FlaskConical size={14} />
                  <span>
                    <strong>Local demonstrator.</strong> Synthetic records and
                    outcomes. No real messages are sent or appointments booked.
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
                    A provider call already in flight may still complete; review
                    uncertain actions in the operator console.
                  </div>
                </div>
              )}
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
              {page === "activation" && <Activation {...props} />}
              {page === "opportunities" && <Opportunities {...props} />}
              {page === "decisions" && <Decisions {...props} />}
              {page === "journey" && <CustomerJourney {...props} />}
              {page === "scenarios" && <Scenarios {...props} />}
              {page === "connections" && <Connections {...props} />}
              {page === "operator" && <Operator {...props} />}
              <footer className="footer">
                <span>
                  DAVID Engine <span style={{ margin: "0 7px" }}>·</span>{" "}
                  {state.workspace.name}
                </span>
                <span>
                  {state.workspace.timeZone}{" "}
                  <span style={{ margin: "0 7px" }}>·</span>{" "}
                  {state.workspace.mode === "fixture"
                    ? "Synthetic evidence only"
                    : "Source-linked evidence"}
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
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
