"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, FileSpreadsheet, LockKeyhole, Mail, Minus, RotateCcw, ShieldCheck } from "lucide-react";
import type { ConnectionCapability } from "@david/contracts";
import { Button, dateTime } from "./ui";
import "./google-connection-experience.css";

export type GoogleCapability = "sheets" | "mail" | "calendar";
export type GoogleConnectionPhase = "preparing" | "redirecting" | "leaving" | "error" | "review" | "cancelled" | "expired" | "failed";
export type GoogleConnectionExperienceProps = {
  phase: GoogleConnectionPhase;
  capabilities: GoogleCapability[];
  connection?: ConnectionCapability;
  message?: string;
  onClose: () => void;
  onRetry: (capability?: GoogleCapability) => void;
  onContinue?: () => void;
  onChooseResource: (type: "sheet" | "mailbox" | "calendar") => void;
  busy?: boolean;
  canConfigure?: boolean;
};

type Permission = { label: string; description: string; granted: boolean };
const scopeRoot = "https://www.googleapis.com/auth/";
const capabilityOrder: GoogleCapability[] = ["sheets", "mail", "calendar"];
const capabilityDetails = {
  sheets: { name: "Google Sheets", Icon: FileSpreadsheet, resource: "sheet", operations: ["sheets.read"], action: "Choose a Sheet", purpose: "Select the file and rows that inform your team." },
  mail: { name: "Gmail", Icon: Mail, resource: "mailbox", operations: ["gmail.read", "gmail.send"], action: "Choose a sender", purpose: "Choose the sending account and enroll conversations." },
  calendar: { name: "Google Calendar", Icon: CalendarDays, resource: "calendar", operations: ["calendar.freebusy", "calendar.book"], action: "Choose a calendar", purpose: "Choose an owned calendar for availability and booking." },
} as const;

function permissionsFor(capability: GoogleCapability, scopes: Set<string>, requested: boolean): Permission[] {
  const has = (scope: string) => scopes.has(scopeRoot + scope);
  if (capability === "sheets") {
    const rows: Permission[] = [];
    if (requested || has("drive.file")) rows.push({ label: "Selected-file access", granted: has("drive.file"), description: "Google allows reading, editing and deleting files selected for this app. DAVID uses this grant to read the Sheet you choose." });
    if (has("spreadsheets.readonly")) rows.push({ label: "Spreadsheet reading", granted: true, description: "Google allows reading all spreadsheets this account can access. DAVID uses the Sheet and range you select." });
    if (has("spreadsheets")) rows.push({ label: "Spreadsheet management", granted: true, description: "Google allows viewing, editing, creating and deleting all your Google Sheets spreadsheets. DAVID uses this grant to read the Sheet and range you choose." });
    return rows.length ? rows : [{ label: "Sheet reading", granted: false, description: "A selected-file or spreadsheet-read grant is needed before choosing a Sheet." }];
  }
  if (capability === "mail") return [
    { label: "Send email", granted: has("gmail.send"), description: "Google allows sending email as this account. DAVID still requires approved senders, contact rules and action authorization." },
    { label: "Read email", granted: has("gmail.readonly"), description: "This Google permission provides mailbox-wide read access. DAVID processes enrolled conversations; the Google permission itself is broader." },
  ];
  return [
    { label: "Read availability", granted: has("calendar.freebusy") || has("calendar.events.freebusy"), description: "Google allows viewing calendar availability. Select the calendar DAVID should check." },
    { label: has("calendar.events") ? "Manage calendar events" : "Manage owned-calendar events", granted: has("calendar.events.owned") || has("calendar.events"), description: has("calendar.events") ? "Google allows reading and editing events on calendars this account can access, subject to its calendar permissions. DAVID uses the calendar you approve." : "Google allows reading, creating, changing and deleting events on calendars you own. DAVID booking still needs separate action authorization." },
  ];
}

const phaseCopy = {
  preparing: { kicker: "A SECURE HANDOFF", title: "Your systems.\nOn your terms.", description: "Preparing your secure handoff to Google. Your requested access is shown below.", status: "Preparing secure handoff", step: 0 },
  redirecting: { kicker: "NEXT / GOOGLE", title: "You choose\nthe access.", description: "Your connection request is ready. Continue to Google to choose an account and review its permissions.", status: "Ready to continue to Google", step: 1 },
  leaving: { kicker: "NEXT / GOOGLE", title: "You choose\nthe access.", description: "Opening Google’s account and permission screen. You’ll return here to review the access recorded for your workspace.", status: "Leaving DAVID for Google", step: 1 },
  review: { kicker: "BACK IN YOUR WORKSPACE", title: "Your account.\nYour control.", description: "Review the access recorded for this account, then choose the sources your team may use.", status: "Review recorded account access", step: 2 },
  cancelled: { kicker: "YOU’RE IN CONTROL", title: "Take it at\nyour pace.", description: "Google authorization was cancelled. You can return to your connections or start a new permission review when you’re ready.", status: "Authorization cancelled", step: 1 },
  expired: { kicker: "LET’S RECONNECT", title: "A fresh connection\nstarts here.", description: "This connection attempt could not be verified. Start again to review your Google account and permissions.", status: "Connection attempt unverified", step: 1 },
  error: { kicker: "CONNECTION NEEDS ATTENTION", title: "Let’s get you\nconnected.", description: "The secure handoff could not be prepared. Review the detail below, then try again.", status: "Handoff unavailable", step: 0 },
  failed: { kicker: "CONNECTION NEEDS ATTENTION", title: "Let’s get you\nconnected.", description: "We couldn’t complete this connection. Your account access needs to be checked before choosing sources.", status: "Connection could not be confirmed", step: 2 },
} as const;

export function GoogleConnectionExperience({ phase, capabilities, connection, message, onClose, onRetry, onContinue, onChooseResource, busy = false, canConfigure = false }: GoogleConnectionExperienceProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [phase]);
  const returning = phase === "review";
  const handoff = phase === "preparing" || phase === "redirecting" || phase === "leaving";
  const recorded = connection?.provider === "google" ? connection : undefined;
  const scopes = new Set(recorded?.scopes ?? []);
  // Newly authorized accounts are intentionally unconfigured until a source is selected and checked.
  const usable = !!recorded && (recorded.health === "healthy" || recorded.health === "unconfigured");
  const copy = phaseCopy[phase];
  const reviewUnavailable = returning && !usable;
  const visibleCapabilities = capabilityOrder.filter((capability) => capabilities.includes(capability) || (returning && permissionsFor(capability, scopes, false).some((permission) => permission.granted)));
  const healthLabel = !recorded ? "No Google account confirmed" : recorded.health === "healthy" ? "Connection healthy" : recorded.health === "unconfigured" ? "Source verification pending" : recorded.health === "revoked" ? "Access revoked" : recorded.health === "expired" ? "Account access expired" : recorded.health === "failed" ? "Connection check failed" : "No operational Google connection";
  const accountStatus = reviewUnavailable ? healthLabel : copy.status;
  const title = reviewUnavailable ? "Your connection\nneeds attention." : copy.title;
  const description = reviewUnavailable ? "We don’t have a usable Google connection for this return. Start a new permission review before choosing sources." : copy.description;

  return (
    <section className={`google-experience ${handoff ? "is-handoff" : "is-return"} ${reviewUnavailable || !handoff && !returning ? "needs-attention" : ""}`} aria-label="Google account connection">
      <header className="google-experience-header">
        <span className="google-experience-kicker">DAVID / CONNECTIONS</span>
        <Button onClick={onClose}><ArrowLeft size={14} /> Return to connections</Button>
      </header>

      <section className="google-experience-stage" aria-labelledby="google-experience-heading">
        <div className="google-experience-intro">
          <span className="google-experience-kicker">{reviewUnavailable ? "REVIEW YOUR CONNECTION" : copy.kicker}</span>
          <h1 id="google-experience-heading" ref={heading} tabIndex={-1}>{title.split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h1>
          <p>{description}</p>
          <div className="google-experience-status" role="status" aria-live="polite"><LockKeyhole size={14} /><span>{accountStatus}</span></div>
        </div>
        <div className={`google-experience-bridge ${phase === "preparing" ? "is-preparing" : ""}`} aria-label="DAVID connects to your Google account after you review permissions">
          <div className="google-experience-endpoint"><span className="google-experience-monogram" aria-hidden="true">D</span><strong>DAVID</strong><small>Your workspace</small></div>
          <div className="google-experience-link" aria-hidden="true"><span /><LockKeyhole size={18} /><span /></div>
          <div className="google-experience-endpoint"><span className="google-experience-google" aria-hidden="true">G</span><strong>Google</strong><small>Your account</small></div>
          <p><ShieldCheck size={14} /> Permission stays with you.</p>
        </div>
        <ol className="google-experience-steps" aria-label="Connection steps">
          {["Secure handoff", "Google permissions", "Review account access"].map((label, index) => <li key={label} aria-current={copy.step === index ? "step" : undefined}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong>{copy.step === index && <small>Current step</small>}</li>)}
        </ol>
      </section>

      {message && <div className="google-experience-message" role={phase === "error" || phase === "failed" || phase === "expired" ? "alert" : "status"}><span className="google-experience-kicker">CONNECTION UPDATE</span><p>{message}</p></div>}

      {returning && <section className="google-experience-account" aria-label="Recorded Google account">
        <div className="google-experience-account-title"><span className="google-experience-account-icon"><Mail size={21} /></span><div><span className="google-experience-kicker">ACCOUNT RECORDED BY DAVID</span><h2>{recorded?.identity || "No account confirmed"}</h2><p>{healthLabel}</p></div></div>
        <dl><div><dt>Source owner</dt><dd>{recorded?.owner || "Not assigned"}</dd></div><div><dt>Last verified</dt><dd>{recorded?.verifiedAt ? dateTime(recorded.verifiedAt) : "Not verified yet"}</dd></div></dl>
        <p className="google-experience-account-note">{usable ? "Choosing a source is the next step. This account connection does not authorize sending, booking or running an agent." : "Recorded permissions do not provide usable access while this account is unavailable."}</p>
        {recorded && <details className="google-experience-raw-scopes"><summary>Inspect the exact recorded Google permissions</summary>{recorded.scopes.length ? <ul>{recorded.scopes.map((scope) => <li key={scope}>{scope}</li>)}</ul> : <p>No scopes recorded for this account.</p>}</details>}
      </section>}

      <section className="google-experience-access" aria-labelledby="google-access-heading">
        <div className="google-experience-access-heading"><div><span className="google-experience-kicker">{returning ? "THE ACCESS LEDGER" : "YOUR REQUEST"}</span><h2 id="google-access-heading">{returning ? "What this account allows." : "The permissions you’ll review."}</h2></div><p>{returning ? "Each grant below comes from the saved Google connection." : "Google presents the final consent screen. You decide which permissions to grant."}</p></div>
        <div className="google-experience-permissions">
          {visibleCapabilities.map((capability) => {
            const detail = capabilityDetails[capability];
            const permissions = permissionsFor(capability, scopes, !returning);
            const grantedCount = permissions.filter((permission) => permission.granted).length;
            const complete = grantedCount === permissions.length;
            const supported = !!recorded && detail.operations.every((operation) => recorded.operations.includes(operation));
            const chooseEnabled = returning && usable && complete && supported && canConfigure && !busy;
            const stateLabel = !returning ? "Requested" : !usable ? "Unavailable" : complete ? "Granted" : grantedCount ? "Partial access" : "Not granted";
            return <article className="google-experience-permission" key={capability} data-access={returning && usable && complete ? "granted" : "pending"}>
              <header><span className="google-experience-permission-icon"><detail.Icon size={21} strokeWidth={1.5} /></span><span className="google-experience-permission-state">{stateLabel}</span></header>
              <h3>{detail.name}</h3><p className="google-experience-purpose">{detail.purpose}</p>
              <div className="google-experience-grants">{permissions.map((permission) => <div className="google-experience-grant" key={permission.label}><div><strong>{permission.label}</strong>{returning ? <span className={permission.granted && usable ? "has-grant" : "missing-grant"}>{permission.granted ? usable ? <Check size={13} /> : <Minus size={13} /> : <Minus size={13} />}{permission.granted ? usable ? "Granted" : "Recorded, unavailable" : "Not granted"}</span> : <span>Requested</span>}</div><p>{permission.description}</p></div>)}</div>
              {returning && <div className="google-experience-permission-action"><Button disabled={!chooseEnabled} onClick={() => { if (chooseEnabled) onChooseResource(detail.resource); }}>{detail.action}<ArrowRight size={14} /></Button>{!usable ? <p>Reconnect this account before choosing a source.</p> : !complete ? <><p>{capability === "mail" ? "Send and read access are both required for the approved send-and-reply workflow." : capability === "calendar" ? "Availability and owned-event access are both required for calendar setup." : "Grant Sheet access to choose a source."}</p><button className="google-experience-text-action" disabled={!canConfigure || busy} onClick={() => onRetry(capability)}>Review permissions in Google <ArrowUpRight size={13} /></button></> : !supported ? <p>DAVID source support needs review for this account.</p> : !canConfigure ? <p>A workspace owner or assigned DAVID operator can choose the source.</p> : <p>Source selection and verification come next.</p>}</div>}
            </article>;
          })}
        </div>
        {!visibleCapabilities.length && <p className="google-experience-no-permissions">{returning ? "No supported Sheets, Gmail or Calendar permissions are recorded. Review permissions in Google to add the access you need." : "No capabilities selected. Return to connections to choose the access to request."}</p>}
      </section>

      <footer className="google-experience-footer">
        <p><ShieldCheck size={16} /><span>{handoff ? "Your Google password stays with Google. DAVID receives only the permissions you grant." : "Permissions stay separate from instructions. No sending, booking or agent work is authorized by this screen."}</span></p>
        <div>{!handoff && (!returning || !usable || !visibleCapabilities.length) && <Button variant="primary" disabled={!canConfigure || busy} onClick={() => onRetry()}><RotateCcw size={14} />{phase === "cancelled" ? "Try again with Google" : "Reconnect with Google"}</Button>}{(phase === "redirecting" || phase === "leaving") && onContinue && <Button variant="primary" disabled={busy || !canConfigure} onClick={onContinue}>Continue to Google <ArrowUpRight size={14} /></Button>}{returning && usable && <Button onClick={onClose}>Done reviewing access <ArrowRight size={14} /></Button>}</div>
      </footer>
    </section>
  );
}
