import { executeHorizonToolCalls, type HorizonToolCall, type HorizonToolName } from './horizon-tools';
import { recordAudit } from './horizon-audit';

type AgentMode = 'planner' | 'outreach' | 'research' | 'operator';

type AgentDefinition = {
  id: AgentMode;
  name: string;
  description: string;
  tools: HorizonToolName[];
  systemPrompt: string;
};

export const HORIZON_AGENTS: AgentDefinition[] = [
  { id: 'planner', name: 'Planner', description: 'Turns ambiguous requests into concrete, ordered work.', tools: ['list_records', 'search_knowledge'], systemPrompt: 'Break the request into the smallest useful ordered steps. Prefer existing workspace context before proposing new records.' },
  { id: 'outreach', name: 'Outreach Strategist', description: 'Prioritizes prospects, replies, follow-ups, and conversion actions.', tools: ['list_records', 'search_knowledge'], systemPrompt: 'Optimize for qualified conversations and timely follow-up. Never invent prospect facts; use the supplied outreach context.' },
  { id: 'research', name: 'Researcher', description: 'Finds relevant internal knowledge and turns it into grounded recommendations.', tools: ['search_knowledge', 'list_records'], systemPrompt: 'Ground recommendations in the Horizon knowledge base and clearly distinguish known facts from suggestions.' },
  { id: 'operator', name: 'Operator', description: 'Carries out approved workspace changes through controlled tools.', tools: ['list_records', 'search_knowledge', 'save_memory', 'organize_records'], systemPrompt: 'Execute only explicit, validated workspace changes. Never bypass the Horizon tool policy or invent missing arguments.' },
];

export function getHorizonAgent(id: AgentMode) {
  return HORIZON_AGENTS.find((agent) => agent.id === id) || HORIZON_AGENTS[0];
}

export function routeHorizonAgent(message: string): AgentDefinition {
  const text = message.toLowerCase();
  if (/send|follow.?up|prospect|lead|outreach|reply|pitch|demo|client/.test(text)) return getHorizonAgent('outreach');
  if (/research|knowledge|document|what do we know|find out|source/.test(text)) return getHorizonAgent('research');
  if (/create|update|save|organize|add|change|mark|record/.test(text)) return getHorizonAgent('operator');
  return getHorizonAgent('planner');
}

export function buildAgentInstruction(agent: AgentDefinition, message: string) {
  return `${agent.systemPrompt}\n\nUser request:\n${message}\n\nAvailable controlled tools: ${agent.tools.join(', ')}.`;
}

export function executeAgentTools(agent: AgentDefinition, calls: HorizonToolCall[], options?: { confirmed?: boolean }) {
  const allowed = calls.filter((call) => agent.tools.includes(call.name));
  const results = executeHorizonToolCalls(allowed, options);
  recordAudit({ kind: 'agent', action: `agent_${agent.id}`, summary: `${agent.name} handled ${allowed.length} controlled tool call${allowed.length === 1 ? '' : 's'}.`, metadata: { agent: agent.id, calls: allowed.length } });
  return results;
}
