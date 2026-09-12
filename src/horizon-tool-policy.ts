export type HorizonToolPermission = 'auto' | 'confirm';

export type HorizonToolDefinition = {
  name: string;
  description: string;
  readOnly: boolean;
  permission: HorizonToolPermission;
};

export const HORIZON_TOOL_POLICY: HorizonToolDefinition[] = [
  { name: 'list_records', description: 'Read structured Horizon workspace records.', readOnly: true, permission: 'auto' },
  { name: 'search_knowledge', description: 'Search indexed Horizon knowledge.', readOnly: true, permission: 'auto' },
  { name: 'save_memory', description: 'Persist a durable Horizon memory.', readOnly: false, permission: 'confirm' },
  { name: 'organize_records', description: 'Create or update structured workspace records.', readOnly: false, permission: 'confirm' },
];

export function getHorizonToolPolicy(name: string) {
  return HORIZON_TOOL_POLICY.find((tool) => tool.name === name);
}

export function requiresHorizonToolConfirmation(name: string) {
  return getHorizonToolPolicy(name)?.permission === 'confirm';
}
