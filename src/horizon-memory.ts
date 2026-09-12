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

export function getMemories(options?: { includeArchived?: boolean }) {
  const items = read();
  return options?.includeArchived ? items : items.filter((m) => !m.archived && !m.supersededBy);
}

export function upsertMemory(input: Omit<HorizonMemory, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  const now = new Date().toISOString();
  const memories = read();
  const normalized = input.content.trim().toLowerCase();
  const existing = memories.find((m) => !m.archived && m.content.trim().toLowerCase() === normalized);

  if (existing) {
    existing.type = input.type;
    existing.scope = input.scope;
    existing.confidence = Math.max(existing.confidence, input.confidence);
    existing.importance = Math.max(existing.importance, input.importance);
    existing.source = input.source;
    existing.updatedAt = now;
    write(memories);
    return existing;
  }

  const memory: HorizonMemory = {
    id: input.id || crypto.randomUUID(),
    content: input.content.trim(),
    type: input.type,
    scope: input.scope,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    importance: Math.max(0, Math.min(1, input.importance)),
    source: input.source,
    createdAt: now,
    updatedAt: now,
  };
  write([memory, ...memories]);
  return memory;
}

export function touchMemory(id: string) {
  const memories = read();
  const item = memories.find((m) => m.id === id);
  if (!item) return;
  item.lastUsedAt = new Date().toISOString();
  item.updatedAt = item.lastUsedAt;
  write(memories);
}

export function archiveMemory(id: string) {
  const memories = read();
  const item = memories.find((m) => m.id === id);
  if (!item) return;
  item.archived = true;
  item.updatedAt = new Date().toISOString();
  write(memories);
}

export function restoreMemory(id: string) {
  const memories = read();
  const item = memories.find((m) => m.id === id);
  if (!item) return;
  item.archived = false;
  item.supersededBy = undefined;
  item.updatedAt = new Date().toISOString();
  write(memories);
}

export function subscribeToMemoryChanges(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
