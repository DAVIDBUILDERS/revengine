import { ForecastScenario, type UsageRecord } from '../../contracts/src/index';

export type ForecastCase = { case: 'low' | 'base' | 'high'; stages: { label: string; volume: number }[]; unconstrainedWins: number; wins: number; capacityLimited: boolean; revenueMinor: number | null; incrementalWins: number | null; incrementalRoi: number | null };
export function forecastCases(input: ForecastScenario): ForecastCase[] {
  const scenario = ForecastScenario.parse(input);
  if (!scenario.overlapResolved) throw new Error('Resolve overlap between new-demand and recovery cohorts before forecasting.');
  return (['low', 'base', 'high'] as const).map(key => {
    let volume = scenario.volume;
    const stages = [{ label: scenario.cohort === 'recovery' ? 'Existing recovery cohort' : 'Reachable inquiries', volume }];
    for (const conversion of scenario.conversions) { volume *= conversion[key]; stages.push({label: conversion.label, volume}); }
    const wins = Math.min(volume, scenario.capacity);
    const revenueMinor = scenario.valueMinor === null ? null : Math.round(wins * scenario.valueMinor);
    const incrementalWins = scenario.baselineWins === null ? null : wins - scenario.baselineWins;
    const incrementalRoi = incrementalWins !== null && scenario.valueMinor !== null && !!scenario.counterfactual?.trim() && scenario.spendMinor !== null && scenario.spendMinor > 0 ? (incrementalWins * scenario.valueMinor - scenario.spendMinor) / scenario.spendMinor : null;
    return { case: key, stages, unconstrainedWins: volume, wins, capacityLimited: wins < volume, revenueMinor, incrementalWins, incrementalRoi };
  });
}
export function scenarioComparison(scenario: ForecastScenario, observedWins: number | null) {
  const cases = forecastCases(scenario);
  return { cases, observedWins, varianceFromBase: observedWins === null ? null : observedWins - cases[1].wins, limitation: 'Illustrative planning cases, not confidence intervals or observed outcomes. Incremental ROI requires a counterfactual, baseline and positive cost basis.' };
}
export function deliveryEconomics(subscriptionMinor: number, usage: UsageRecord[]) {
  const categories = ['setup', 'recurring_support', 'provider', 'infrastructure', 'research'] as const;
  const totals = Object.fromEntries(categories.map(category => { const records = usage.filter(row => row.category === category); return [category, { minutes: records.reduce((sum, row) => sum + row.minutes, 0), recordedCostMinor: records.reduce((sum, row) => sum + (row.costMinor ?? 0), 0), complete: records.length > 0 && records.every(row => row.costMinor !== null) }]; })) as Record<typeof categories[number], {minutes:number; recordedCostMinor:number; complete:boolean}>;
  const recurring = ['recurring_support', 'provider', 'infrastructure'] as const;
  const recurringCostMinor = recurring.reduce((sum, category) => sum + totals[category].recordedCostMinor, 0);
  const complete = recurring.every(category => totals[category].complete);
  return { subscriptionMinor, categories: totals, recurringRecordedCostMinor: recurringCostMinor, recurringMarginMinor: complete ? subscriptionMinor - recurringCostMinor : null, coverage: complete ? 'Recorded recurring cost categories present; verify completeness with the operator.' : 'Partial: missing or unknown recurring cost categories.', customerGrossProfitMinor: null, limitation: 'DAVID delivery margin is separate from customer profit. Setup and R&D are excluded from recurring margin; unknown fulfillment cost does not equal zero.' };
}
