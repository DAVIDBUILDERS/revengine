"use client";

import { useState } from "react";
import type { OnboardingAnswers } from "@david/contracts";
import { onboardingFor } from "@david/domain/onboarding";
import { companySystemDefinitions, type SystemKind } from "@david/domain/company-connections";
import type { ScreenProps } from "./app-shell";
import { Button, Drawer } from "./ui";

type System = OnboardingAnswers["systems"][number];

/** Inventory records explain setup work; they never stand in for provider access. */
export function CompanySystemDetails({ state, act, busy, kind, onClose }: Pick<ScreenProps, "state" | "act" | "busy"> & { kind: SystemKind; onClose: () => void }) {
  const record = onboardingFor(state);
  const definition = companySystemDefinitions.find(system => system.kind === kind)!;
  const saved = record.answers.systems.filter(system => system.kind === kind);
  const newSystem = (): System => ({ id: crypto.randomUUID(), kind, tool: "", availability: "available", resource: "", owner: state.setupIdentity?.email ?? "", mapping: "", connectionId: "" });
  const [draft, setDraft] = useState<System>(() => saved[0] ?? newSystem());
  const [revision, setRevision] = useState(record.revision);
  const [message, setMessage] = useState("");
  const canEdit = ["workspace_owner", "david_operator"].includes(state.context.role);
  const conflict = revision !== record.revision;
  function patch(value: Partial<System>) { setDraft(current => ({ ...current, ...value })); setMessage(""); }
  function load(id: string) { setDraft(saved.find(system => system.id === id) ?? newSystem()); setRevision(record.revision); setMessage(""); }
  async function save() {
    if (!canEdit || busy || conflict || !draft.owner.trim()) return;
    const exists = record.answers.systems.some(system => system.id === draft.id);
    const systems = exists ? record.answers.systems.map(system => system.id === draft.id ? draft : system) : [...record.answers.systems, draft];
    const result = await act({ type: "save_onboarding", expectedRevision: revision, answers: { ...record.answers, systems } });
    if (!result?.snapshot.onboarding) { setMessage("The system was not saved. Your edits are still here; review the error and retry."); return; }
    const next = result.snapshot.onboarding;
    setRevision(next.revision);
    if (draft.availability === "admin_needed") {
      const task = await act({ type: "onboarding_task", expectedRevision: next.revision, taskId: `company-system:${draft.id}`, title: `Help connect ${draft.tool || definition.label}`, owner: draft.owner.trim(), status: "open", note: `Company source: ${kind}. ${draft.resource}. ${draft.mapping}`.slice(0, 2000) });
      setMessage(task ? "System saved and administrator help added to the operator setup queue. No invitation or email was sent." : "System saved. The help request was not queued; save again to retry it.");
    } else setMessage("Company system saved. Account access and source checks are tracked separately.");
  }
  return <Drawer open onClose={onClose} title={definition.label} description="Record this system once for your company. Every specialist uses the same source inventory.">
    <div className="stack company-system-details">
      <div className="company-system-inventory-note"><span className="studio-kicker">COMPANY SOURCE / {definition.supported ? "SUPPORTED SETUP" : "PLANNED INTEGRATION"}</span><p>{definition.supported ? "Use source setup to authorize the account and select its resources. These details identify what you use and who can help." : "There is no live sign-in for this system. Saving these details does not connect LinkedIn, Meta, Shopify or any other account. It records inventory for the setup queue."}</p></div>
      {saved.length > 0 && <label>Saved system<select aria-label="Saved system" value={saved.some(system => system.id === draft.id) ? draft.id : "new"} onChange={event => load(event.target.value)}>{saved.map(system => <option key={system.id} value={system.id}>{system.tool || definition.label}</option>)}<option value="new">Add another system</option></select></label>}
      <label>System or tool name<input value={draft.tool} maxLength={4000} onChange={event => patch({ tool: event.target.value })} placeholder={kind === "proposals" ? "Google Sheets, CRM or CSV export" : "The tool your company uses"} /></label>
      <label>Availability<select aria-label="Availability" value={draft.availability} onChange={event => patch({ availability: event.target.value as System["availability"] })}><option value="available">We have this system</option><option value="admin_needed">We need administrator help</option><option value="not_available">We don’t use this system</option></select></label>
      <label>Source owner<input value={draft.owner} maxLength={300} onChange={event => patch({ owner: event.target.value })} placeholder="Name or work email" /></label>
      <details className="connections-setup-details"><summary>Resource details (optional)</summary><div className="stack"><label>Account, folder or resource<input value={draft.resource} maxLength={4000} onChange={event => patch({ resource: event.target.value })} /></label><label>Field mapping or setup notes<textarea value={draft.mapping} maxLength={1500} onChange={event => patch({ mapping: event.target.value })} /></label></div></details>
      {conflict && <div className="notice notice-warning" role="status"><p>The company setup changed while this was open. Reload the saved details before editing further.</p><Button onClick={() => load(draft.id)}>Reload saved details</Button></div>}
      {!canEdit && <p className="notice">A workspace owner or assigned operator can edit company systems.</p>}
      {state.workspace.mode === "fixture" && <p className="help">Synthetic workspace. Changes affect this demonstration only.</p>}
      {message && <p className="notice" role="status">{message}</p>}
      <Button variant="primary" disabled={!canEdit || busy || conflict || !draft.owner.trim() || (!saved.some(system => system.id === draft.id) && record.answers.systems.length >= 40)} onClick={() => void save()}>{busy ? "Saving…" : draft.availability === "admin_needed" ? "Save & request setup help" : "Save company system"}</Button>
    </div>
  </Drawer>;
}
