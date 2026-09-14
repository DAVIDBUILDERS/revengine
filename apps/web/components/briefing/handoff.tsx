"use client";

import { ArrowUpRight } from "lucide-react";
import { briefingFor, briefingFinished, briefingNextAction, goalLabels, presentFacts } from "@david/domain/briefing";
import { onboardingFor } from "@david/domain/onboarding";
import type { ScreenProps } from "../app-shell";

export function BriefingHandoff({ state, navigate }: ScreenProps) {
  const answers = onboardingFor(state).answers;
  const briefing = briefingFor(state);
  if (!answers.briefing) return null;
  const done = briefingFinished(answers);

  return (
    <section className="today-handoff" aria-label="Your business">
      <div className="today-handoff-plan">
        <p className="eyebrow">Your business</p>
        <h2>{answers.company.name || "Continue your business briefing"}</h2>
        <p>{goalLabels(briefing).join(" · ")}</p>
        <details>
          <summary>Business context</summary>
          <p>{presentFacts(answers.company.offers).join(" · ")}{answers.company.customers.length ? ` for ${presentFacts(answers.company.customers).join(" · ")}` : ""}</p>
        </details>
      </div>
      <div className="today-handoff-action">
        <p>{briefingNextAction(state)}</p>
        <button className="btn" onClick={() => navigate("activation")}>{done ? "Review your briefing" : "Continue your briefing"} <ArrowUpRight size={14} /></button>
      </div>
    </section>
  );
}
