const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have',
  'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'our', 'that', 'the',
  'this', 'to', 'was', 'we', 'will', 'with', 'you', 'your', 'today', 'tomorrow',
]);

function tokens(input) {
  return new Set(
    String(input || '')
      .toLowerCase()
      .replace(/[^a-z0-9₹]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token && !STOP_WORDS.has(token) && token.length > 1),
  );
}

function textOf(record) {
  if (!record || typeof record !== 'object') return '';
  return Object.entries(record)
    .filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key))
    .map(([key, value]) => `${key} ${typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}`)
    .join(' ');
}

function scoreRecord(record, queryTokens) {
  const words = tokens(textOf(record));
  let score = 0;
  for (const token of queryTokens) if (words.has(token)) score += 1;
  return score;
}

function rank(records, query, limit) {
  const queryTokens = tokens(query);
  return (Array.isArray(records) ? records : [])
    .filter((record) => !record?.archived)
    .map((record, index) => ({ record, score: scoreRecord(record, queryTokens), index }))
    .filter((item) => item.score > 0 || queryTokens.size === 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ record, score }) => ({ ...record, _relevance: score }));
}

function byType(records, type) {
  return (Array.isArray(records) ? records : []).filter((record) => record?.type === type);
}

export function buildContext({ message, workspace = {}, prospects = [], conversation = [], knowledge = [], organizedRecords = [], memories = [] }) {
  const query = String(message || '');
  const safeWorkspace = workspace && typeof workspace === 'object' ? workspace : {};
  const workspaceRecords = Array.isArray(organizedRecords) ? organizedRecords : [];
  const workspaceMemories = Array.isArray(memories) ? memories : [];

  const result = {
    strategy: 'relevance-ranked-bounded-context-v3',
    query,
    conversation: Array.isArray(conversation) ? conversation.slice(-8) : [],
    workspace: {
      clients: rank(safeWorkspace.clients ?? byType(workspaceRecords, 'client'), query, 12),
      projects: rank(safeWorkspace.projects ?? byType(workspaceRecords, 'project'), query, 12),
      tasks: rank(safeWorkspace.tasks ?? byType(workspaceRecords, 'task'), query, 16),
      memories: rank(safeWorkspace.memories ?? workspaceMemories, query, 16),
      notes: rank(safeWorkspace.notes ?? byType(workspaceRecords, 'note'), query, 10),
    },
    outreach: { prospects: rank(prospects, query, 20) },
    knowledge: rank(knowledge, query, 12),
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

  return result;
}
