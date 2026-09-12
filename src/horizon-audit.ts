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
const MAX_ENTRIES = 500;

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

function enqueueRemote(entry: HorizonAuditEntry) {
  void fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
    keepalive: true,
  }).catch(() => undefined);
}

export function recordAudit(input: Omit<HorizonAuditEntry, 'id' | 'createdAt'>) {
  const entry: HorizonAuditEntry = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  write([entry, ...read()]);
  enqueueRemote(entry);
  return entry;
}

export async function hydrateAudit() {
  try {
    const response = await fetch('/api/audit', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) return false;
    const data = await response.json();
    if (!data?.ok || !Array.isArray(data.entries)) return false;
    const local = read();
    const merged = new Map<string, HorizonAuditEntry>();
    for (const entry of [...data.entries, ...local]) if (entry?.id) merged.set(entry.id, entry);
    write([...merged.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, MAX_ENTRIES));
    return Boolean(data.persistent);
  } catch {
    return false;
  }
}

export function getAuditEntries(options?: { limit?: number; kind?: HorizonAuditKind }) {
  const limit = Math.max(1, Math.min(200, options?.limit ?? 40));
  return read()
    .filter((entry) => !options?.kind || entry.kind === options.kind)
    .slice(0, limit);
}

export function clearAudit() {
  write([]);
  void fetch('/api/audit', { method: 'DELETE', keepalive: true }).catch(() => undefined);
}

export function subscribeToAuditChanges(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
