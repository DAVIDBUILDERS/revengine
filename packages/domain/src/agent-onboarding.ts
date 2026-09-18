import { AgentOnboardingRecord, type AgentRequiredTools, type AppSnapshot } from '../../contracts/src/index';
import { catalog } from '../../agents/src/index';
import { agentSystemRequirements } from './company-connections';

export function requiredToolsFor(agentId: string): AgentRequiredTools {
  const agent = catalog.find(item => item.id === agentId);
  if (!agent) throw new Error(`Unknown specialist: ${agentId}`);
  return {
    tools: [...agent.toolNames],
    capabilities: [...agent.requiredCapabilities],
    systems: [...(agentSystemRequirements[agentId] ?? ['other'])],
    prerequisites: [...agent.prerequisites],
  };
}

export function emptyAgentOnboarding(state: Pick<AppSnapshot, 'workspace' | 'asOf' | 'context'>, agentId: string) {
  return AgentOnboardingRecord.parse({
    workspaceId: state.workspace.id,
    agentId,
    status: 'not_started',
    answers: {},
    requiredTools: requiredToolsFor(agentId),
    missing: [],
    revision: 0,
    updatedAt: state.asOf,
    updatedBy: state.context.actorId,
  });
}

export function ensureAgentOnboarding(state: AppSnapshot) {
  const existing = new Map((state.agentOnboarding ?? []).filter(record => record.workspaceId === state.workspace.id).map(record => [record.agentId, AgentOnboardingRecord.parse(record)]));
  const records = catalog.map(agent => {
    const current = existing.get(agent.id);
    if (!current) return emptyAgentOnboarding(state, agent.id);
    return AgentOnboardingRecord.parse({ ...current, requiredTools: requiredToolsFor(agent.id) });
  });
  state.agentOnboarding = records;
  return records;
}

export function saveAgentOnboarding(state: AppSnapshot, agentId: string, expectedRevision: number, answers: Record<string, unknown>) {
  if (!catalog.some(agent => agent.id === agentId)) throw new Error(`Unknown specialist: ${agentId}`);
  const encoded = JSON.stringify(answers);
  if (encoded.length > 40000) throw new Error('Agent onboarding answers exceed the stored size limit.');
  const records = ensureAgentOnboarding(state);
  const current = records.find(record => record.agentId === agentId)!;
  if (current.revision !== expectedRevision) throw new Error('Agent setup changed in another session. Reload before saving; your changes were not applied.');
  const started = Object.keys(answers).length > 0;
  const completed = answers.completed === true;
  const next = AgentOnboardingRecord.parse({
    ...current,
    answers,
    revision: current.revision + 1,
    status: completed ? 'ready' : current.status === 'ready' ? 'ready' : started ? 'in_progress' : 'not_started',
    updatedAt: state.asOf,
    updatedBy: state.context.actorId,
  });
  state.agentOnboarding = records.map(record => record.agentId === agentId ? next : record);
  return next;
}
