import { applyOrganization, getOrganizedRecords, type OrganizationAction, type HorizonRecord } from './horizon-organization';
import { getMemories, upsertMemory, type HorizonMemory } from './horizon-memory';
import { searchKnowledge, type KnowledgeChunk } from './horizon-knowledge';

type ToolResult = { ok: boolean; summary: string; data?: unknown };

export type HorizonToolName =
  | 'list_records'
  | 'search_knowledge'
  | 'save_memory'
  | 'organize_records';

export type HorizonToolCall = {
  name: HorizonToolName;
  arguments?: Record<string, unknown>;
};

export const HORIZON_TOOLS: Array<{
  name: HorizonToolName;
  description: string;
  readOnly: boolean;
}> = [
  { name: 'list_records', description: 'Read structured Horizon workspace records, optionally filtered by type.', readOnly: true },
  { name: 'search_knowledge', description: 'Search the local Horizon knowledge base for relevant source material.', readOnly: true },
  { name: 'save_memory', description: 'Persist a durable Horizon memory after the AI has classified it.', readOnly: false },
  { name: 'organize_records', description: 'Create or update typed Horizon workspace records.', readOnly: false },
];

function stringArg(args: Record<string, unknown> | undefined, key: string) {
  return typeof args?.[key] === 'string' ? String(args[key]).trim() : '';
}

function numberArg(args: Record<string, unknown> | undefined, key: string, fallback: number) {
  return typeof args?.[key] === 'number' && Number.isFinite(args[key]) ? Number(args[key]) : fallback;
}

export function executeHorizonTool(call: HorizonToolCall): ToolResult {
  const args = call.arguments || {};

  try {
    switch (call.name) {
      case 'list_records': {
        const type = stringArg(args, 'type') as HorizonRecord['type'];
        const records = getOrganizedRecords(type ? { type } : undefined).slice(0, Math.max(1, Math.min(50, numberArg(args, 'limit', 20))));
        return { ok: true, summary: `${records.length} workspace record${records.length === 1 ? '' : 's'} returned.`, data: records };
      }
      case 'search_knowledge': {
        const query = stringArg(args, 'query');
        if (!query) return { ok: false, summary: 'Knowledge search requires a query.' };
        const results: KnowledgeChunk[] = searchKnowledge(query, Math.max(1, Math.min(12, numberArg(args, 'limit', 8))));
        return { ok: true, summary: `${results.length} knowledge result${results.length === 1 ? '' : 's'} found.`, data: results };
      }
      case 'save_memory': {
        const content = stringArg(args, 'content');
        if (!content) return { ok: false, summary: 'Memory content is required.' };
        const memory = upsertMemory({
          content,
          type: (['fact', 'preference', 'decision', 'observation'].includes(stringArg(args, 'type')) ? stringArg(args, 'type') : 'observation') as HorizonMemory['type'],
          scope: (['personal', 'company', 'client', 'project'].includes(stringArg(args, 'scope')) ? stringArg(args, 'scope') : 'company') as HorizonMemory['scope'],
          confidence: Math.max(0, Math.min(1, numberArg(args, 'confidence', 0.9))),
          importance: Math.max(0, Math.min(1, numberArg(args, 'importance', 0.7))),
          source: 'Horizon AI',
        });
        return { ok: true, summary: `Memory saved: ${memory.content}`, data: memory };
      }
      case 'organize_records': {
        const actions = Array.isArray(args.actions) ? args.actions as OrganizationAction[] : [];
        if (!actions.length) return { ok: false, summary: 'No organization actions supplied.' };
        const result = applyOrganization(actions);
        return { ok: true, summary: `${result.created} record${result.created === 1 ? '' : 's'} created and ${result.updated} updated.`, data: result };
      }
      default:
        return { ok: false, summary: 'Tool is not available.' };
    }
  } catch (error) {
    return { ok: false, summary: error instanceof Error ? error.message : 'Tool execution failed.' };
  }
}

export function executeHorizonToolCalls(calls: HorizonToolCall[]) {
  return calls.filter((call) => HORIZON_TOOLS.some((tool) => tool.name === call.name)).map(executeHorizonTool);
}
