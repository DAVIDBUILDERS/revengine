"use client";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Circle,
  Clock3,
  FileText,
  X,
} from "lucide-react";
import type { EvidenceRef } from "@david/contracts";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { words } from "@david/ui";

export const FeedbackContext = createContext<{
  text: string;
  error: boolean;
} | null>(null);

export const EvidenceAccessContext = createContext<{
  workspaceId: string;
  mode: string;
} | null>(null);

/** Hosted walkthrough: hide chrome that announces a demo or synthetic session. */
export const QuietWalkthroughContext = createContext(false);

export function DavidSilhouette({ className = "" }: { className?: string }) {
  return <span className={`david-silhouette ${className}`.trim()} aria-hidden="true" />;
}

export function Button({
  children,
  variant = "",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "danger" | "";
  children: ReactNode;
}) {
  return (
    <button
      className={`btn ${variant ? `btn-${variant}` : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone,
  status,
}: {
  children?: ReactNode;
  tone?: string;
  status?: string;
}) {
  const value = status ?? "";
  const good = [
    "healthy",
    "verified",
    "approved",
    "confirmed",
    "supported",
    "reviewed",
    "completed",
  ];
  const bad = ["failed", "blocked", "rejected", "revoked", "unsupported"];
  const warn = [
    "unverified",
    "unconfigured",
    "uncertain",
    "expired",
    "awaiting_approval",
    "waiting_for_input",
    "missing",
    "engineering_required",
    "stale",
    "unknown",
  ];
  const color =
    tone ??
    (good.includes(value)
      ? "positive"
      : bad.includes(value)
        ? "danger"
        : warn.includes(value)
          ? "warning"
          : "info");
  const Icon = good.includes(value)
    ? Check
    : bad.includes(value)
      ? AlertCircle
      : warn.includes(value)
        ? Clock3
        : Circle;
  return (
    <span className={`badge badge-${color}`}>
      <Icon size={10} />
      {children ?? words(value)}
    </span>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <FileText size={25} strokeWidth={1.5} />
      <h3>{title}</h3>
      <p className="small">{children}</p>
      {action}
    </div>
  );
}
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const notice = useContext(FeedbackContext);
  const [feedback, setFeedback] = useState<typeof notice>(null);
  useEffect(() => {
    if (open) setFeedback(notice);
  }, [notice]);
  useEffect(() => {
    setFeedback(null);
  }, [open]);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog"
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <Dialog.Close
            className="icon-button dialog-close"
            aria-label="Close details"
          >
            <X size={18} />
          </Dialog.Close>
          <div className="eyebrow">DAVID / Details & evidence</div>
          <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          <Dialog.Description className="dialog-description">
            {description}
          </Dialog.Description>
          <div className="dialog-content">
            {feedback && (
              <div
                className={`notice ${feedback.error ? "notice-danger" : ""}`}
                role={feedback.error ? "alert" : "status"}
                style={{ marginBottom: 20 }}
              >
                <AlertCircle size={18} />
                <p>{feedback.text}</p>
              </div>
            )}
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Evidence({ items }: { items: EvidenceRef[] }) {
  const quiet = useContext(QuietWalkthroughContext);
  if (!items.length)
    return (
      <div className="notice notice-warning">
        <AlertCircle size={18} />
        <span>
          No source evidence is available. Ask the source owner to provide a
          current reference before treating this as verified.
        </span>
      </div>
    );
  return (
    <div>
      {items.map((e) => (
        <div key={e.id} className="evidence">
          <div className="between">
            <strong>{e.label}</strong>
            <Badge status={quiet && e.quality === "fixture" ? "verified" : e.quality} />
          </div>
          <div className="muted">{quiet ? e.source.replace(/^fixture /i, "") : e.source}</div>
          <div className="tiny muted">Captured {dateTime(e.capturedAt)}</div>
          {e.url && /^https?:\/\//.test(e.url) && (
            <a
              href={e.url}
              target="_blank"
              rel="noreferrer"
              className="flex small"
            >
              Open source <ArrowUpRight size={13} />
            </a>
          )}
          {!e.url && <ProtectedEvidenceFile id={e.id} />}
        </div>
      ))}
    </div>
  );
}

function ProtectedEvidenceFile({ id }: { id: string }) {
  const access = useContext(EvidenceAccessContext);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    url: string | null;
    expiresAt: number;
    message: string;
    error: boolean;
  } | null>(null);
  if (!access || access.mode === "fixture") return null;
  const retrieve = async () => {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch(
        `/api/evidence/${encodeURIComponent(id)}?${new URLSearchParams({ workspace: access.workspaceId })}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.message ??
            data.error ??
            "Private evidence could not be authorized.",
        );
      if (data.url && new URL(data.url).protocol !== "https:")
        throw new Error(
          "The evidence service returned an unsupported download destination.",
        );
      setResult({
        url: data.url ?? null,
        expiresAt: Date.now() + Number(data.expiresInSeconds ?? 60) * 1000,
        message: data.url
          ? "Private download authorized for a short time."
          : "Source metadata verified. No private attachment is retained for this record.",
        error: false,
      });
    } catch (error) {
      setResult({
        url: null,
        expiresAt: 0,
        message:
          error instanceof Error
            ? error.message
            : "Evidence lookup failed. Retry or ask the source owner.",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: 10 }}>
      {result?.url && result.expiresAt > Date.now() ? (
        <a
          href={result.url}
          target="_blank"
          rel="noreferrer"
          className="flex small"
        >
          Open authorized private attachment
          <ArrowUpRight size={13} />
        </a>
      ) : (
        <button
          className="link-button"
          disabled={busy}
          onClick={() => void retrieve()}
        >
          {busy ? "Authorizing evidence…" : "Retrieve private attachment"}
          <ArrowUpRight size={13} />
        </button>
      )}
      {result && (
        <p
          className={`help ${result.error ? "notice notice-danger" : ""}`}
          role={result.error ? "alert" : "status"}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
export function dateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(value))
    : "Not yet verified";
}
export function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
