import { applyOrganization, getOrganizedRecords, type OrganizationAction, type HorizonRecord } from './horizon-organization';
import { getMemories, upsertMemory, type HorizonMemory } from './horizon-memory';
import { searchKnowledge, type KnowledgeChunk } from './horizon-knowledge';
import { recordAudit } from './horizon-audit';

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
    let result: ToolResult;
    switch (call.name) {
      case 'list_records': {
        const type = stringArg(args, 'type') as HorizonRecord['type'];
        const records = getOrganizedRecords(type ? { type } : undefined).slice(0, Math.max(1, Math.min(50, numberArg(args, 'limit', 20))));
        result = { ok: true, summary: `${records.length} workspace record${records.length === 1 ? '' : 's'} returned.`, data: records };
        break;
      }
      case 'search_knowledge': {
        const query = stringArg(args, 'query');
        if (!query) result = { ok: false, summary: 'Knowledge search requires a query.' };
        else {
          const results: KnowledgeChunk[] = searchKnowledge(query, Math.max(1, Math.min(12, numberArg(args, 'limit', 8))));
          result = { ok: true, summary: `${results.length} knowledge result${results.length === 1 ? '' : 's'} found.`, data: results };
        }
        break;
      }
      case 'save_memory': {
        const content = stringArg(args, 'content');
        if (!content) result = { ok: false, summary: 'Memory content is required.' };
        else {
          const memory = upsertMemory({
            content,
            type: (['fact', 'preference', 'decision', 'observation'].includes(stringArg(args, 'type')) ? stringArg(args, 'type') : 'observation') as HorizonMemory['type'],
            scope: (['personal', 'company', 'client', 'project'].includes(stringArg(args, 'scope')) ? stringArg(args, 'scope') : 'company') as HorizonMemory['scope'],
            confidence: Math.max(0, Math.min(1, numberArg(args, 'confidence', 0.9))),
            importance: Math.max(0, Math.min(1, numberArg(args, 'importance', 0.7))),
            source: 'Horizon AI',
          });
          result = { ok: true, summary: `Memory saved: ${memory.content}`, data: memory };
        }
        break;
      }
      case 'organize_records': {
        const actions = Array.isArray(args.actions) ? args.actions as OrganizationAction[] : [];
        if (!actions.length) result = { ok: false, summary: 'No organization actions supplied.' };
        else {
          const organization = applyOrganization(actions);
          result = { ok: true, summary: `${organization.created} record${organization.created === 1 ? '' : 's'} created and ${organization.updated} updated.`, data: organization };
        }
        break;
      }
      default:
        result = { ok: false, summary: 'Tool is not available.' };
    }
    recordAudit({
      kind: call.name === 'search_knowledge' ? 'knowledge_search' : call.name === 'save_memory' ? 'memory' : call.name === 'organize_records' ? 'organization' : 'tool_call',
      action: call.name,
      summary: result.summary,
      metadata: { ok: result.ok },
    });
    return result;
  } catch (error) {
    const summary = error instanceof Error ? error.message : 'Tool execution failed.';
    recordAudit({ kind: 'error', action: call.name, summary, metadata: { ok: false } });
    return { ok: false, summary };
  }
}

export function executeHorizonToolCalls(calls: HorizonToolCall[]) {
  return calls.filter((call) => HORIZON_TOOLS.some((tool) => tool.name === call.name)).map(executeHorizonTool);
}
