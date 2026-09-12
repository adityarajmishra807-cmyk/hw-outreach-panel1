export type HorizonAuditKind =
  | 'ai_request'
  | 'tool_call'
  | 'organization'
  | 'memory'
  | 'knowledge_search'
  | 'error';

export type HorizonAuditEntry = {
  id: string;
  kind: HorizonAuditKind;
  action: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

const KEY = 'horizon-ai-audit-log';
const EVENT = 'horizon-audit-updated';
const MAX_ENTRIES = 250;

function read(): HorizonAuditEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: HorizonAuditEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function recordAudit(input: Omit<HorizonAuditEntry, 'id' | 'createdAt'>) {
  const entry: HorizonAuditEntry = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  write([entry, ...read()]);
  return entry;
}

export function getAuditEntries(options?: { limit?: number; kind?: HorizonAuditKind }) {
  const limit = Math.max(1, Math.min(100, options?.limit ?? 40));
  return read()
    .filter((entry) => !options?.kind || entry.kind === options.kind)
    .slice(0, limit);
}

export function clearAudit() {
  write([]);
}

export function subscribeToAuditChanges(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
