"use client";

import {
  ArrowRight, ArrowUpRight, AudioLines, BarChart3, CalendarDays,
  ChevronDown, ClipboardList, CreditCard, FileSpreadsheet, Files,
  Globe, Layers3, Mail, MapPin, Megaphone, Network, Settings2,
  Share2, ShieldCheck, ShoppingBag, type LucideIcon,
} from "lucide-react";
import type { AppSnapshot } from "@david/contracts";
import {
  companyConnectionCoverage,
  type CompanySystemCoverage,
  type SystemKind,
} from "@david/domain/company-connections";
import { Button, DavidSilhouette } from "./ui";
import "./company-connection-map.css";

export type CompanyConnectionMapProps = {
  state: AppSnapshot;
  onSetup: (kind: SystemKind) => void;
  onChooseTeam: () => void;
  onManageSystem: (kind: SystemKind) => void;
};

const systemPresentation: Record<SystemKind, { Icon: LucideIcon; description: string; setupLabel?: string }> = {
  website: { Icon: Globe, description: "Capture your public pages and confirm the company facts your specialists can reuse.", setupLabel: "Set up your website" },
  proposals: { Icon: FileSpreadsheet, description: "Use Google Sheets for proposal and customer records. CSV import is available as an alternative.", setupLabel: "Set up proposal records" },
  mail: { Icon: Mail, description: "Select approved senders and enrolled conversations. Account access and permission to contact people are separate.", setupLabel: "Set up Gmail" },
  calendar: { Icon: CalendarDays, description: "Choose an owned calendar for availability and approved appointment booking.", setupLabel: "Set up a calendar" },
  drive: { Icon: Files, description: "Company documents, offer material and creative assets." },
  advertising: { Icon: Megaphone, description: "Advertising accounts, campaigns and creative performance." },
  social: { Icon: Share2, description: "Social accounts, publishing destinations and audience context." },
  analytics: { Icon: BarChart3, description: "Website, acquisition and conversion measurement." },
  calls: { Icon: AudioLines, description: "Call recordings, transcripts and phone systems." },
  payments: { Icon: CreditCard, description: "Payment records and authoritative revenue outcomes." },
  commerce: { Icon: ShoppingBag, description: "Products, orders, carts and customer purchase history." },
  local: { Icon: MapPin, description: "Business listings, reviews and local market information." },
  rfp: { Icon: ClipboardList, description: "RFP sources, procurement portals and bid requirements." },
  other: { Icon: Layers3, description: "Additional company systems and the people who own them." },
};

const statusLabels: Record<CompanySystemCoverage["status"], string> = {
  verified: "Source access verified",
  connected: "Setup in progress",
  needs_access: "Account access needed",
  needs_information: "Source details needed",
  not_available: "Not used here",
  engineering_required: "Engineering required",
  demo_only: "Synthetic example",
};

export function CompanyConnectionMap({ state, onSetup, onChooseTeam, onManageSystem }: CompanyConnectionMapProps) {
  const coverage = companyConnectionCoverage(state);
  const supported = coverage.systems.filter((system) => system.supported);
  const planned = coverage.systems.filter((system) => !system.supported);
  const allowance = state.workspace.entitlement ?? 5;
  const selectedCount = coverage.agents.filter((agent) => agent.selected).length;
  const verifiedCount = supported.filter((system) => system.status === "verified").length;
  const chooseLabel = allowance === 5 ? "Choose your five" : "Choose your team";
  const companyName = state.workspace.name;

  function renderSystem(system: CompanySystemCoverage) {
    const presentation = systemPresentation[system.kind];
    const sharedRoles = state.catalog.filter((agent) => system.agentIds.includes(agent.id));
    const selectedShared = sharedRoles.filter((agent) => system.selectedAgentIds.includes(agent.id)).length;
    return (
      <article className={`company-system ${system.supported ? "is-supported" : "is-planned"}`} data-system={system.kind} data-status={system.status} key={system.kind}>
        <header className="company-system-top">
          <span className="company-system-icon"><presentation.Icon size={23} strokeWidth={1.45} /></span>
          <span className="company-system-state">{state.workspace.mode === "fixture" && system.status === "engineering_required" ? "Illustrative account" : statusLabels[system.status]}</span>
        </header>
        <span className="company-map-kicker">{system.supported ? "AVAILABLE SOURCE SETUP" : "SYSTEM INVENTORY"}</span>
        <h3>{system.label}</h3>
        <p className="company-system-purpose">{presentation.description}</p>
        <div className="company-system-evidence">
          <span className="company-map-kicker">{system.supported ? "CURRENT COVERAGE" : "WHAT’S AVAILABLE"}</span>
          <p>{system.detail}</p>
          {system.supported && (system.connectionIds.length > 0 || system.resourceIds.length > 0) && <span className="company-system-records">{system.connectionIds.length} connection{system.connectionIds.length === 1 ? "" : "s"} · {system.resourceIds.length} source selection{system.resourceIds.length === 1 ? "" : "s"}</span>}
          {!system.supported && <span className="company-system-planned-note">{state.workspace.mode === "fixture" ? "Illustrative fixture account for this walkthrough. Not a live OAuth grant." : "Inventory can be saved now. There is no OAuth or live account connection for this system yet."}</span>}
        </div>
        {sharedRoles.length > 0 ? <details className="company-system-sharing">
          <summary><Network size={14} /><span>Shared by {sharedRoles.length} specialist{sharedRoles.length === 1 ? "" : "s"}{selectedShared > 0 && <small>{selectedShared} on your team</small>}</span><ChevronDown size={14} /></summary>
          <ul>{sharedRoles.map((agent) => {
            const requirements = coverage.agents.find((role) => role.id === agent.id);
            const currentInput = !!requirements && !requirements.engineeringRequired && requirements.currentSystems.includes(system.kind);
            return <li key={agent.id}><span>{agent.name}{requirements?.selected && <small>On your team</small>}</span><span className="company-system-role-state">{currentInput ? "Current input" : "Planned input"}</span></li>;
          })}</ul>
          <p>Source requirements describe the role. Each specialist still needs its own capabilities, permissions and verified work.</p>
        </details> : <p className="company-system-extra">Keep additional systems in your company inventory.</p>}
        <footer className="company-system-actions">
          {system.supported && <Button onClick={() => onSetup(system.kind)}>{system.status === "verified" ? "Review source setup" : presentation.setupLabel ?? "Set up source"}<ArrowUpRight size={14} /></Button>}
          <button className="company-map-text-action" onClick={() => onManageSystem(system.kind)}><Settings2 size={13} />{system.supported ? "Manage system" : "Manage system inventory"}</button>
        </footer>
      </article>
    );
  }

  return (
    <div className="company-connection-map">
      <section className="company-map-mission" aria-labelledby="company-map-heading">
        <DavidSilhouette className="company-map-david" />
        <div className="company-map-mission-copy">
          <span className="company-map-kicker">{companyName.toUpperCase()} / SHARED COMPANY SOURCES</span>
          <h2 id="company-map-heading">Connect once.<br />{allowance === 5 ? "Choose any five." : "Shape your team."}</h2>
          <p>Prepare the systems your company uses across the full specialist catalog. Choose or swap your team while keeping those sources in one place.</p>
          <div className="company-map-mission-actions"><Button variant="primary" onClick={onChooseTeam}>{chooseLabel}<ArrowRight size={15} /></Button><span>{selectedCount} of {allowance} team slots selected</span></div>
        </div>
        <div className="company-map-architecture" aria-label={`${state.catalog.length} specialist roles share company source requirements; ${selectedCount} selected for this workspace`}>
          <div className="company-map-source-core"><span aria-hidden="true">D</span><strong>Company sources</strong><small>One shared foundation</small></div>
          <div className="company-map-catalog">
            <div className="company-map-role-marks" aria-hidden="true">{state.catalog.map((agent) => <span key={agent.id} title={agent.name} className={coverage.agents.find((role) => role.id === agent.id)?.selected ? "is-selected" : ""} />)}</div>
            <strong>{state.catalog.length} specialist roles</strong><small>Your selected roles are highlighted</small>
          </div>
        </div>
        <div className="company-map-mission-note"><ShieldCheck size={15} /><span>Shared sources prepare the company. An agent is ready only after its own requirements and work are verified.</span></div>
      </section>

      <section className="company-map-supported" aria-labelledby="company-supported-heading">
        <header className="company-map-section-heading"><div><span className="company-map-kicker">START WITH YOUR COMPANY’S SYSTEMS</span><h2 id="company-supported-heading">Connect what you use.</h2></div><p>{verifiedCount} of {supported.length} supported system groups have verified source access{state.workspace.mode === "fixture" ? " · Synthetic workspace" : ""}.</p></header>
        <div className="company-map-system-grid">{supported.map(renderSystem)}</div>
      </section>

      <details className="company-map-planning">
        <summary><span className="company-map-planning-icon"><Layers3 size={22} strokeWidth={1.5} /></span><span><strong>Plan other systems</strong><small>Ads, social, analytics, documents and the rest of your company’s tools.</small></span><span className="company-map-plan-count">{planned.length} system groups</span><ChevronDown size={19} /></summary>
        <div className="company-map-planning-body"><p className="company-map-planning-note">These systems appear in the full roles’ requirements. Record what you use, who owns it and whether administrator help is needed. There is no live sign-in for ads, social, commerce or the other planned systems; adding an inventory entry does not connect an account.</p><div className="company-map-system-grid">{planned.map(renderSystem)}</div></div>
      </details>

      <footer className="company-map-next"><div><span className="company-map-kicker">YOUR COMPANY. YOUR TEAM.</span><h2>Build the team around the work.</h2><p>You can choose specialists now and return to source setup as needed. Missing inputs and implementation gaps stay visible for every role.</p></div><Button variant="primary" onClick={onChooseTeam}>{chooseLabel}<ArrowRight size={15} /></Button></footer>
    </div>
  );
}
