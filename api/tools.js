const TOOL_REGISTRY = [
  {
    name: 'list_records',
    description: 'Read structured Horizon workspace records.',
    readOnly: true,
    confirmation: 'none',
    arguments: { type: 'object', properties: { type: { type: 'string', enum: ['client', 'project', 'task', 'note'] }, limit: { type: 'number', minimum: 1, maximum: 50 } } },
  },
  {
    name: 'search_knowledge',
    description: 'Search indexed Horizon knowledge.',
    readOnly: true,
    confirmation: 'none',
    arguments: { type: 'object', required: ['query'], properties: { query: { type: 'string', minLength: 1 }, limit: { type: 'number', minimum: 1, maximum: 12 } } },
  },
  {
    name: 'save_memory',
    description: 'Create or update a durable Horizon memory.',
    readOnly: false,
    confirmation: 'user',
    arguments: { type: 'object', required: ['content'], properties: { content: { type: 'string', minLength: 1, maxLength: 4000 }, type: { type: 'string', enum: ['fact', 'preference', 'decision', 'observation'] }, scope: { type: 'string', enum: ['personal', 'company', 'client', 'project'] }, confidence: { type: 'number', minimum: 0, maximum: 1 }, importance: { type: 'number', minimum: 0, maximum: 1 } } },
  },
  {
    name: 'organize_records',
    description: 'Create or update typed Horizon workspace records.',
    readOnly: false,
    confirmation: 'user',
    arguments: { type: 'object', required: ['actions'], properties: { actions: { type: 'array', minItems: 1, maxItems: 20 } } },
  },
];

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function validCall(call) {
  if (!call || typeof call !== 'object') return { ok: false, error: 'Tool call must be an object.' };
  const tool = TOOL_REGISTRY.find((item) => item.name === call.name);
  if (!tool) return { ok: false, error: `Unknown Horizon tool: ${String(call.name || '')}` };
  const args = call.arguments && typeof call.arguments === 'object' ? call.arguments : {};
  for (const required of tool.arguments.required || []) {
    if (!(required in args)) return { ok: false, error: `${tool.name} requires ${required}.` };
  }
  if (tool.name === 'search_knowledge' && typeof args.query !== 'string') return { ok: false, error: 'search_knowledge.query must be a string.' };
  if (tool.name === 'save_memory' && typeof args.content !== 'string') return { ok: false, error: 'save_memory.content must be a string.' };
  if (tool.name === 'organize_records' && !Array.isArray(args.actions)) return { ok: false, error: 'organize_records.actions must be an array.' };
  return { ok: true, tool, arguments: args };
}

export default async function handler(req, res) {
  if (req.method === 'GET') return json(res, 200, { ok: true, tools: TOOL_REGISTRY });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const calls = Array.isArray(req.body?.calls) ? req.body.calls : [req.body];
  const validated = calls.map(validCall);
  const valid = validated.filter((item) => item.ok).map((item) => ({ name: item.tool.name, arguments: item.arguments, readOnly: item.tool.readOnly, confirmation: item.tool.confirmation }));
  const rejected = validated.filter((item) => !item.ok).map((item) => item.error);
  return json(res, rejected.length ? 400 : 200, { ok: rejected.length === 0, tools: TOOL_REGISTRY, valid, rejected });
}
