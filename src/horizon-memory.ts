export type MemoryType = 'fact' | 'preference' | 'decision' | 'observation';
export type MemoryScope = 'personal' | 'company' | 'client' | 'project';

export type HorizonMemory = {
  id: string;
  content: string;
  type: MemoryType;
  scope: MemoryScope;
  confidence: number;
  importance: number;
  source: 'Horizon AI' | 'User';
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  supersededBy?: string;
  archived?: boolean;
};

const KEY = 'horizon-ai-memories';
const EVENT = 'horizon-memory-updated';

function read(): HorizonMemory[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(memories: HorizonMemory[]) {
  localStorage.setItem(KEY, JSON.stringify(memories));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.7));
}

function mergeRemote(remote: HorizonMemory[]) {
  const local = read();
  const byId = new Map(local.map((memory) => [memory.id, memory]));
  for (const memory of remote) {
    const existing = byId.get(memory.id);
    byId.set(memory.id, existing ? { ...existing, ...memory } : memory);
  }
  write(Array.from(byId.values()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
}

export function getMemories(options?: { includeArchived?: boolean }) {
  const items = read();
  return options?.includeArchived ? items : items.filter((m) => !m.archived && !m.supersededBy);
}

export async function syncMemories() {
  try {
    const response = await fetch('/api/memory', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.persistent || !Array.isArray(data.memories)) return false;
    mergeRemote(data.memories as HorizonMemory[]);
    return true;
  } catch {
    return false;
  }
}

export function upsertMemory(input: Omit<HorizonMemory, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  const now = new Date().toISOString();
  const memories = read();
  const content = input.content.trim();
  if (!content) return undefined;
  const normalized = content.toLowerCase();
  const existing = memories.find((m) => !m.archived && m.content.trim().toLowerCase() === normalized);

  if (existing) {
    existing.type = input.type;
    existing.scope = input.scope;
    existing.confidence = Math.max(existing.confidence, clamp(input.confidence));
    existing.importance = Math.max(existing.importance, clamp(input.importance));
    existing.source = input.source;
    existing.updatedAt = now;
    write(memories);
    void persistMemory(existing);
    return existing;
  }

  const memory: HorizonMemory = {
    id: input.id || crypto.randomUUID(),
    content,
    type: input.type,
    scope: input.scope,
    confidence: clamp(input.confidence),
    importance: clamp(input.importance),
    source: input.source,
    createdAt: now,
    updatedAt: now,
  };
  write([memory, ...memories]);
  void persistMemory(memory);
  return memory;
}

async function persistMemory(memory: HorizonMemory) {
  try {
    const response = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memory),
    });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    if (Array.isArray(data.memories)) mergeRemote(data.memories as HorizonMemory[]);
  } catch {
    // Local persistence remains available when the remote store is unavailable.
  }
}

export function touchMemory(id: string) {
  const memories = read();
  const item = memories.find((m) => m.id === id);
  if (!item) return;
  item.lastUsedAt = new Date().toISOString();
  item.updatedAt = item.lastUsedAt;
  write(memories);
  void patchMemory(id, { lastUsedAt: item.lastUsedAt });
}

export function archiveMemory(id: string) {
  const memories = read();
  const item = memories.find((m) => m.id === id);
  if (!item) return;
  item.archived = true;
  item.updatedAt = new Date().toISOString();
  write(memories);
  void patchMemory(id, { archived: true });
}

export function restoreMemory(id: string) {
  const memories = read();
  const item = memories.find((m) => m.id === id);
  if (!item) return;
  item.archived = false;
  item.supersededBy = undefined;
  item.updatedAt = new Date().toISOString();
  write(memories);
  void patchMemory(id, { archived: false, supersededBy: undefined });
}

async function patchMemory(id: string, patch: Record<string, unknown>) {
  try {
    const response = await fetch('/api/memory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, patch }),
    });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    if (Array.isArray(data.memories)) mergeRemote(data.memories as HorizonMemory[]);
  } catch {
    // Keep the local state when the remote store is unavailable.
  }
}

export function subscribeToMemoryChanges(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
