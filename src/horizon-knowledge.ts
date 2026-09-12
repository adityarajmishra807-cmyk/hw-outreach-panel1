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
  return new Set(
    input.toLowerCase().replace(/[^a-z0-9₹]+/g, ' ').split(/\s+/).filter((x) => x.length > 1),
  );
}

export function getKnowledge(options?: { includeArchived?: boolean }) {
  const docs = read();
  return options?.includeArchived ? docs : docs.filter((doc) => !doc.archived);
}

export function addKnowledge(input: { title: string; source?: string; content: string; tags?: string[] }) {
  const now = new Date().toISOString();
  const document: KnowledgeDocument = {
    id: crypto.randomUUID(),
    title: input.title.trim() || 'Untitled knowledge',
    source: input.source?.trim() || 'Manual entry',
    content: input.content.trim(),
    tags: Array.from(new Set((input.tags || []).map((tag) => tag.trim()).filter(Boolean))),
    createdAt: now,
    updatedAt: now,
  };
  write([document, ...read()]);
  return document;
}

export function updateKnowledge(id: string, patch: Partial<Pick<KnowledgeDocument, 'title' | 'source' | 'content' | 'tags'>>) {
  const docs = read();
  const doc = docs.find((item) => item.id === id);
  if (!doc) return null;
  if (patch.title !== undefined) doc.title = patch.title.trim() || doc.title;
  if (patch.source !== undefined) doc.source = patch.source.trim() || doc.source;
  if (patch.content !== undefined) doc.content = patch.content.trim();
  if (patch.tags !== undefined) doc.tags = Array.from(new Set(patch.tags.map((tag) => tag.trim()).filter(Boolean)));
  doc.updatedAt = new Date().toISOString();
  write(docs);
  return doc;
}

export function archiveKnowledge(id: string) {
  const docs = read();
  const doc = docs.find((item) => item.id === id);
  if (!doc) return;
  doc.archived = true;
  doc.updatedAt = new Date().toISOString();
  write(docs);
}

export function restoreKnowledge(id: string) {
  const docs = read();
  const doc = docs.find((item) => item.id === id);
  if (!doc) return;
  doc.archived = false;
  doc.updatedAt = new Date().toISOString();
  write(docs);
}

export function chunkKnowledge(doc: KnowledgeDocument, size = 900): KnowledgeChunk[] {
  const words = doc.content.split(/\s+/).filter(Boolean);
  const chunks: KnowledgeChunk[] = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push({ ...doc, chunkId: `${doc.id}:${chunks.length}`, chunkIndex: chunks.length, chunkText: words.slice(i, i + size).join(' ') });
  }
  return chunks;
}

export function searchKnowledge(query: string, limit = 8): KnowledgeChunk[] {
  const queryTokens = tokens(query);
  return getKnowledge()
    .flatMap((doc) => chunkKnowledge(doc))
    .map((chunk, index) => {
      const haystack = `${chunk.title} ${chunk.source} ${chunk.tags.join(' ')} ${chunk.chunkText}`;
      const words = tokens(haystack);
      let score = 0;
      for (const token of queryTokens) if (words.has(token)) score += 1;
      if (chunk.title.toLowerCase().includes(query.toLowerCase())) score += 3;
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
