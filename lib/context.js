const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have',
  'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'our', 'that', 'the',
  'this', 'to', 'was', 'we', 'will', 'with', 'you', 'your', 'today', 'tomorrow',
  'what', 'when', 'where', 'who', 'why', 'how', 'about', 'can', 'could', 'should',
]);

const MAX_CONTEXT_ITEMS = 50;

function tokens(input) {
  return new Set(
    String(input || '')
      .toLowerCase()
      .replace(/[^a-z0-9₹]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token && !STOP_WORDS.has(token) && token.length > 1),
  );
}

function normalize(input) {
  return String(input ?? '').trim().toLowerCase();
}

function textOf(record) {
  if (!record || typeof record !== 'object') return '';
  return Object.entries(record)
    .filter(([key]) => !['id', 'createdAt', 'updatedAt', '_relevance'].includes(key))
    .map(([key, value]) => `${key} ${typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}`)
    .join(' ');
}

function recencyBoost(record) {
  const raw = record?.updatedAt || record?.createdAt || record?.lastUsedAt;
  const time = raw ? Date.parse(String(raw)) : NaN;
  if (!Number.isFinite(time)) return 0;
  const ageDays = Math.max(0, (Date.now() - time) / 86400000);
  if (ageDays <= 1) return 2;
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.5;
  return 0;
}

function scoreRecord(record, query, queryTokens) {
  const text = textOf(record).toLowerCase();
  const words = tokens(text);
  let score = 0;
  for (const token of queryTokens) if (words.has(token)) score += 1;

  const normalizedQuery = normalize(query);
  if (normalizedQuery && text.includes(normalizedQuery)) score += 4;

  const title = normalize(record?.title || record?.name);
  if (title && normalizedQuery && normalizedQuery.includes(title)) score += 3;

  score += recencyBoost(record);
  return score;
}

function rank(records, query, limit) {
  const queryTokens = tokens(query);
  const source = Array.isArray(records) ? records : [];
  return source
    .filter((record) => record && !record?.archived && record?.status !== 'archived')
    .map((record, index) => ({ record, score: scoreRecord(record, query, queryTokens), index }))
    .filter((item) => item.score > 0 || queryTokens.size === 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ record, score }) => ({ ...record, _relevance: Number(score.toFixed(2)) }));
}

function byType(records, type) {
  return (Array.isArray(records) ? records : []).filter((record) => record?.type === type);
}

function recordIdentity(record) {
  return normalize(record?.title || record?.name || record?.data?.name || record?.data?.title);
}

function collectLinkedNames(records) {
  const names = new Set();
  for (const record of Array.isArray(records) ? records : []) {
    const data = record?.data && typeof record.data === 'object' ? record.data : {};
    for (const key of ['client', 'clientName', 'project', 'projectName', 'relatedTo', 'relatedClient', 'relatedProject']) {
      const value = data[key] ?? record?.[key];
      if (typeof value === 'string' && value.trim()) names.add(normalize(value));
    }
  }
  return names;
}

function expandRelations(primary, allRecords, query, limit) {
  const linkedNames = collectLinkedNames(primary);
  const direct = new Set(primary.map(recordIdentity));
  const related = (Array.isArray(allRecords) ? allRecords : [])
    .filter((record) => !record?.archived && record?.status !== 'archived')
    .filter((record) => {
      const identity = recordIdentity(record);
      if (!identity || direct.has(identity)) return false;
      const data = record?.data && typeof record.data === 'object' ? record.data : {};
      const relationValues = [record?.client, record?.project, record?.relatedTo, data.client, data.project, data.relatedTo]
        .filter((value) => typeof value === 'string')
        .map(normalize);
      return relationValues.some((value) => linkedNames.has(value));
    });

  return rank(related, query, limit);
}

function uniqueByIdentity(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = recordIdentity(record) || JSON.stringify(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildContext({ message, workspace = {}, prospects = [], conversation = [], knowledge = [], organizedRecords = [], memories = [] }) {
  const query = String(message || '').trim();
  const safeWorkspace = workspace && typeof workspace === 'object' ? workspace : {};
  const workspaceRecords = Array.isArray(organizedRecords) ? organizedRecords : [];
  const workspaceMemories = Array.isArray(memories) ? memories : [];

  const clientSource = safeWorkspace.clients ?? byType(workspaceRecords, 'client');
  const projectSource = safeWorkspace.projects ?? byType(workspaceRecords, 'project');
  const taskSource = safeWorkspace.tasks ?? byType(workspaceRecords, 'task');
  const noteSource = safeWorkspace.notes ?? byType(workspaceRecords, 'note');
  const memorySource = safeWorkspace.memories ?? workspaceMemories;

  const rankedClients = rank(clientSource, query, 10);
  const rankedProjects = rank(projectSource, query, 12);
  const rankedTasks = rank(taskSource, query, 14);
  const rankedNotes = rank(noteSource, query, 8);
  const rankedMemories = rank(memorySource, query, 14);
  const rankedProspects = rank(prospects, query, 16);
  const rankedKnowledge = rank(knowledge, query, 10);

  const linkedProjects = expandRelations(rankedClients, projectSource, query, 4);
  const linkedTasks = expandRelations([...rankedProjects, ...rankedClients], taskSource, query, 6);
  const linkedNotes = expandRelations([...rankedClients, ...rankedProjects], noteSource, query, 4);

  const result = {
    strategy: 'relevance-ranked-bounded-context-v4',
    query,
    conversation: Array.isArray(conversation) ? conversation.slice(-8) : [],
    workspace: {
      clients: uniqueByIdentity([...rankedClients, ...expandRelations(rankedProjects, clientSource, query, 3)]).slice(0, 10),
      projects: uniqueByIdentity([...rankedProjects, ...linkedProjects]).slice(0, 14),
      tasks: uniqueByIdentity([...rankedTasks, ...linkedTasks]).slice(0, 18),
      memories: rankedMemories.slice(0, 14),
      notes: uniqueByIdentity([...rankedNotes, ...linkedNotes]).slice(0, 10),
    },
    outreach: { prospects: rankedProspects.slice(0, 16) },
    knowledge: rankedKnowledge.slice(0, 10),
  };

  result.summary = {
    clients: result.workspace.clients.length,
    projects: result.workspace.projects.length,
    tasks: result.workspace.tasks.length,
    memories: result.workspace.memories.length,
    notes: result.workspace.notes.length,
    prospects: result.outreach.prospects.length,
    knowledge: result.knowledge.length,
    conversationTurns: result.conversation.length,
  };

  const totalItems = Object.values(result.workspace).reduce((sum, items) => sum + items.length, 0) + result.outreach.prospects.length + result.knowledge.length;
  result.summary.boundedItems = Math.min(totalItems, MAX_CONTEXT_ITEMS);
  result.summary.strategyVersion = 'v4';

  return result;
}
