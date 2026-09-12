const COOKIE_NAME = 'horizon_workspace_id';
const MEMORY_PREFIX = 'horizon:memory:';

function cookieValue(req, name) {
  const header = req.headers?.cookie || '';
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function workspaceId(req) {
  return cookieValue(req, COOKIE_NAME) || crypto.randomUUID();
}

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kv(path, options = {}) {
  const response = await fetch(`${process.env.KV_REST_API_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || 'Persistent memory storage request failed.');
  return payload?.result;
}

function normalizeMemory(input) {
  const now = new Date().toISOString();
  return {
    id: typeof input?.id === 'string' && input.id ? input.id : crypto.randomUUID(),
    content: String(input?.content || '').trim(),
    type: ['fact', 'preference', 'decision', 'observation'].includes(input?.type) ? input.type : 'observation',
    scope: ['personal', 'company', 'client', 'project'].includes(input?.scope) ? input.scope : 'company',
    confidence: Math.max(0, Math.min(1, Number(input?.confidence ?? 0.9))),
    importance: Math.max(0, Math.min(1, Number(input?.importance ?? 0.7))),
    source: input?.source === 'User' ? 'User' : 'Horizon AI',
    createdAt: input?.createdAt || now,
    updatedAt: now,
    lastUsedAt: input?.lastUsedAt,
    supersededBy: input?.supersededBy,
    archived: Boolean(input?.archived),
  };
}

export default async function handler(req, res) {
  const id = workspaceId(req);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
  res.setHeader('Cache-Control', 'no-store');

  if (!kvConfigured()) {
    if (req.method === 'GET') return res.status(200).json({ ok: true, persistent: false, memories: [] });
    return res.status(503).json({ ok: false, persistent: false, error: 'Persistent memory storage is not configured. Connect an Upstash Redis store to Vercel so KV_REST_API_URL and KV_REST_API_TOKEN are available.' });
  }

  const key = `${MEMORY_PREFIX}${id}`;

  try {
    if (req.method === 'GET') {
      const memories = (await kv(`get/${encodeURIComponent(key)}`)) || [];
      return res.status(200).json({ ok: true, persistent: true, memories: Array.isArray(memories) ? memories : [] });
    }

    if (req.method === 'POST') {
      const memory = normalizeMemory(req.body || {});
      if (!memory.content) return res.status(400).json({ ok: false, error: 'Memory content is required.' });
      const existing = (await kv(`get/${encodeURIComponent(key)}`)) || [];
      const items = Array.isArray(existing) ? existing : [];
      const index = items.findIndex((item) => item.id === memory.id || String(item.content || '').trim().toLowerCase() === memory.content.toLowerCase());
      if (index >= 0) {
        items[index] = { ...items[index], ...memory, id: items[index].id, createdAt: items[index].createdAt || memory.createdAt };
      } else {
        items.unshift(memory);
      }
      await kv(`set/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify(items) });
      return res.status(200).json({ ok: true, persistent: true, memory: index >= 0 ? items[index] : memory, memories: items });
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const existing = (await kv(`get/${encodeURIComponent(key)}`)) || [];
      const items = Array.isArray(existing) ? existing : [];
      const index = items.findIndex((item) => item.id === body.id);
      if (index < 0) return res.status(404).json({ ok: false, error: 'Memory not found.' });
      items[index] = { ...items[index], ...body.patch, updatedAt: new Date().toISOString() };
      await kv(`set/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify(items) });
      return res.status(200).json({ ok: true, persistent: true, memory: items[index], memories: items });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    return res.status(502).json({ ok: false, persistent: false, error: error instanceof Error ? error.message : 'Persistent memory storage failed.' });
  }
}
