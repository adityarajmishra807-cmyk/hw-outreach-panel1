export type KnowledgeDocument = {
  id: string;
  title: string;
  source: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
};

export type KnowledgeChunk = KnowledgeDocument & {
  chunkId: string;
  chunkIndex: number;
  chunkText: string;
};

const KEY = 'horizon-ai-knowledge';
const EVENT = 'horizon-knowledge-updated';
let syncStarted = false;

function read(): KnowledgeDocument[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: KnowledgeDocument[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function tokens(input: string) {
  return new Set(input.toLowerCase().replace(/[^a-z0-9₹]+/g, ' ').split(/\s+/).filter((x) => x.length > 1));
}

function normalize(doc: Partial<KnowledgeDocument>): KnowledgeDocument {
  const now = new Date().toISOString();
  return {
    id: doc.id || crypto.randomUUID(),
    title: String(doc.title || 'Untitled knowledge').trim(),
    source: String(doc.source || 'Manual entry').trim(),
    content: String(doc.content || '').trim(),
    tags: Array.from(new Set((Array.isArray(doc.tags) ? doc.tags : []).map((tag) => String(tag).trim()).filter(Boolean))),
    createdAt: doc.createdAt || now,
    updatedAt: doc.updatedAt || now,
    archived: Boolean(doc.archived),
  };
}

export function getKnowledge(options?: { includeArchived?: boolean }) {
  const docs = read();
  return options?.includeArchived ? docs : docs.filter((doc) => !doc.archived);
}

async function remote(method: 'GET' | 'POST' | 'PATCH', body?: unknown) {
  const response = await fetch('/api/knowledge', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Knowledge sync failed.');
  return data;
}

export async function syncKnowledge() {
  try {
    const data = await remote('GET');
    if (Array.isArray(data?.documents)) write(data.documents.map(normalize));
    return Boolean(data?.persistent);
  } catch {
    return false;
  }
}

function ensureSync() {
  if (syncStarted || typeof window === 'undefined') return;
  syncStarted = true;
  void syncKnowledge();
}

ensureSync();

export function addKnowledge(input: { title: string; source?: string; content: string; tags?: string[] }) {
  const document = normalize({ title: input.title, source: input.source, content: input.content, tags: input.tags });
  const existing = read();
  write([document, ...existing]);
  void remote('POST', document).then((data) => {
    if (Array.isArray(data?.documents)) write(data.documents.map(normalize));
  }).catch(() => undefined);
  return document;
}

export function updateKnowledge(id: string, patch: Partial<Pick<KnowledgeDocument, 'title' | 'source' | 'content' | 'tags'>>) {
  const docs = read();
  const doc = docs.find((item) => item.id === id);
  if (!doc) return null;
  const updated = normalize({ ...doc, ...patch, updatedAt: new Date().toISOString() });
  const next = docs.map((item) => item.id === id ? updated : item);
  write(next);
  void remote('PATCH', { id, patch }).then((data) => {
    if (Array.isArray(data?.documents)) write(data.documents.map(normalize));
  }).catch(() => undefined);
  return updated;
}

export function archiveKnowledge(id: string) {
  const docs = read();
  const doc = docs.find((item) => item.id === id);
  if (!doc) return;
  doc.archived = true;
  doc.updatedAt = new Date().toISOString();
  write(docs);
  void remote('PATCH', { id, patch: { archived: true } }).then((data) => {
    if (Array.isArray(data?.documents)) write(data.documents.map(normalize));
  }).catch(() => undefined);
}

export function restoreKnowledge(id: string) {
  const docs = read();
  const doc = docs.find((item) => item.id === id);
  if (!doc) return;
  doc.archived = false;
  doc.updatedAt = new Date().toISOString();
  write(docs);
  void remote('PATCH', { id, patch: { archived: false } }).then((data) => {
    if (Array.isArray(data?.documents)) write(data.documents.map(normalize));
  }).catch(() => undefined);
}

export function chunkKnowledge(doc: KnowledgeDocument, wordsPerChunk = 180) {
  const words = doc.content.split(/\s+/).filter(Boolean);
  const chunks: KnowledgeChunk[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push({ ...doc, chunkId: `${doc.id}:${chunks.length}`, chunkIndex: chunks.length, chunkText: words.slice(i, i + wordsPerChunk).join(' ') });
  }
  return chunks;
}

export function searchKnowledge(query: string, limit = 8): KnowledgeChunk[] {
  const cleanQuery = query.trim().toLowerCase();
  const queryTokens = tokens(query);
  return getKnowledge()
    .flatMap((doc) => chunkKnowledge(doc))
    .map((chunk, index) => {
      const haystack = `${chunk.title} ${chunk.source} ${chunk.tags.join(' ')} ${chunk.chunkText}`;
      const words = tokens(haystack);
      let score = 0;
      for (const token of queryTokens) if (words.has(token)) score += 1;
      if (cleanQuery && chunk.title.toLowerCase().includes(cleanQuery)) score += 5;
      if (cleanQuery && chunk.source.toLowerCase().includes(cleanQuery)) score += 2;
      return { chunk, score, index };
    })
    .filter((item) => item.score > 0 || queryTokens.size === 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.chunk);
}

export function subscribeToKnowledgeChanges(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
