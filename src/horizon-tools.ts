import { applyOrganization, getOrganizedRecords, type OrganizationAction, type HorizonRecord } from './horizon-organization';
import { getMemories, upsertMemory, type HorizonMemory } from './horizon-memory';
import { searchKnowledge, type KnowledgeChunk } from './horizon-knowledge';
import { recordAudit } from './horizon-audit';
import { getHorizonToolPolicy, requiresHorizonToolConfirmation } from './horizon-tool-policy';

type ToolResult = { ok: boolean; summary: string; data?: unknown; requiresConfirmation?: boolean };

export type HorizonToolName = 'list_records' | 'search_knowledge' | 'save_memory' | 'organize_records';

export type HorizonToolCall = {
  name: HorizonToolName;
  arguments?: Record<string, unknown>;
};

export const HORIZON_TOOLS = [
  { name: 'list_records', description: 'Read structured Horizon workspace records, optionally filtered by type.', readOnly: true, permission: 'auto' as const },
  { name: 'search_knowledge', description: 'Search the local Horizon knowledge base for relevant source material.', readOnly: true, permission: 'auto' as const },
  { name: 'save_memory', description: 'Persist a durable Horizon memory after the AI has classified it.', readOnly: false, permission: 'confirm' as const },
  { name: 'organize_records', description: 'Create or update typed Horizon workspace records.', readOnly: false, permission: 'confirm' as const },
];

function stringArg(args: Record<string, unknown> | undefined, key: string) {
  return typeof args?.[key] === 'string' ? String(args[key]).trim() : '';
}

function numberArg(args: Record<string, unknown> | undefined, key: string, fallback: number) {
  return typeof args?.[key] === 'number' && Number.isFinite(args[key]) ? Number(args[key]) : fallback;
}

export function validateHorizonToolCall(call: HorizonToolCall) {
  const definition = getHorizonToolPolicy(call.name);
  if (!definition) return { ok: false, error: `Tool is not allowlisted: ${String(call.name || '')}` };
  const args = call.arguments || {};
  if (call.name === 'search_knowledge' && !stringArg(args, 'query')) return { ok: false, error: 'search_knowledge requires query.' };
  if (call.name === 'save_memory' && !stringArg(args, 'content')) return { ok: false, error: 'save_memory requires content.' };
  if (call.name === 'organize_records' && !Array.isArray(args.actions)) return { ok: false, error: 'organize_records requires actions.' };
  return { ok: true, definition };
}

export function executeHorizonTool(call: HorizonToolCall, options?: { confirmed?: boolean }): ToolResult {
  const validation = validateHorizonToolCall(call);
  if (!validation.ok) return { ok: false, summary: validation.error };
  if (requiresHorizonToolConfirmation(call.name) && !options?.confirmed) {
    const args = call.arguments || {};
    const count = Array.isArray(args.actions) ? args.actions.length : 1;
    const summary = call.name === 'organize_records' ? `Horizon proposed ${count} workspace record change${count === 1 ? '' : 's'}. Confirmation required.` : 'Horizon proposed saving a durable memory. Confirmation required.';
    recordAudit({ kind: 'tool_call', action: `${call.name}_pending`, summary, metadata: { requiresConfirmation: true } });
    return { ok: false, summary, requiresConfirmation: true };
  }

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
        const results: KnowledgeChunk[] = searchKnowledge(query, Math.max(1, Math.min(12, numberArg(args, 'limit', 8))));
        result = { ok: true, summary: `${results.length} knowledge result${results.length === 1 ? '' : 's'} found.`, data: results };
        break;
      }
      case 'save_memory': {
        const content = stringArg(args, 'content');
        const memory = upsertMemory({ content, type: (['fact', 'preference', 'decision', 'observation'].includes(stringArg(args, 'type')) ? stringArg(args, 'type') : 'observation') as HorizonMemory['type'], scope: (['personal', 'company', 'client', 'project'].includes(stringArg(args, 'scope')) ? stringArg(args, 'scope') : 'company') as HorizonMemory['scope'], confidence: Math.max(0, Math.min(1, numberArg(args, 'confidence', 0.9))), importance: Math.max(0, Math.min(1, numberArg(args, 'importance', 0.7))), source: 'Horizon AI' });
        result = { ok: true, summary: `Memory saved: ${memory.content}`, data: memory };
        break;
      }
      case 'organize_records': {
        const organization = applyOrganization(args.actions as OrganizationAction[]);
        result = { ok: true, summary: `${organization.created} record${organization.created === 1 ? '' : 's'} created and ${organization.updated} updated.`, data: organization };
        break;
      }
      default:
        result = { ok: false, summary: 'Tool is not available.' };
    }
    recordAudit({ kind: call.name === 'search_knowledge' ? 'knowledge_search' : call.name === 'save_memory' ? 'memory' : call.name === 'organize_records' ? 'organization' : 'tool_call', action: call.name, summary: result.summary, metadata: { ok: result.ok, permission: validation.definition.permission } });
    return result;
  } catch (error) {
    const summary = error instanceof Error ? error.message : 'Tool execution failed.';
    recordAudit({ kind: 'error', action: call.name, summary, metadata: { ok: false } });
    return { ok: false, summary };
  }
}

export function executeHorizonToolCalls(calls: HorizonToolCall[], options?: { confirmed?: boolean }) {
  return calls.map((call) => executeHorizonTool(call, options));
}
