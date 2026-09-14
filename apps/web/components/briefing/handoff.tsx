"use client";

import { ArrowUpRight } from "lucide-react";
import { briefingFor, briefingNextAction, goals, recommendedTask } from "@david/domain/briefing";
import { onboardingFor } from "@david/domain/onboarding";
import type { ScreenProps } from "../app-shell";

export function BriefingHandoff({ state, navigate }: ScreenProps) {
  const answers = onboardingFor(state).answers;
  const briefing = briefingFor(state);
  const task = recommendedTask(state, briefing);
  if (!answers.briefing) return null;

  return (
    <section className="today-handoff" aria-label="Your starting plan">
      <div className="today-handoff-plan">
        <p className="eyebrow">Your starting plan</p>
        <h2>{task?.title ?? "Continue your business briefing"}</h2>
        <p>{briefing.goal === "other" ? briefing.otherGoal : goals.find((goal) => goal.id === briefing.goal)?.label}</p>
        <details>
          <summary>Business context</summary>
          <p>{answers.company.offers.join(" · ")}{answers.company.customers.length ? ` for ${answers.company.customers.join(" · ")}` : ""}</p>
        </details>
      </div>
      <div className="today-handoff-action">
        <p>{briefingNextAction(state)}</p>
        <button className="btn" onClick={() => navigate("activation")}>Continue my first task <ArrowUpRight size={14} /></button>
      </div>
    </section>
  );
}
