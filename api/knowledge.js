const COOKIE_NAME = 'horizon_workspace_id';
const KNOWLEDGE_PREFIX = 'horizon:knowledge:';

function cookieValue(req, name) {
  const header = req.headers?.cookie || '';
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function workspaceId(req) {
  return cookieValue(req, COOKIE_NAME) || crypto.randomUUID();
}

function configured() {
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
  if (!response.ok) throw new Error(payload?.error || 'Knowledge storage request failed.');
  return payload?.result;
}

function normalizeDocument(input, existing) {
  const now = new Date().toISOString();
  return {
    id: existing?.id || input?.id || crypto.randomUUID(),
    title: String(input?.title || existing?.title || 'Untitled knowledge').trim(),
    source: String(input?.source || existing?.source || 'Manual entry').trim(),
    content: String(input?.content || existing?.content || '').trim(),
    tags: Array.from(new Set((Array.isArray(input?.tags) ? input.tags : existing?.tags || []).map((tag) => String(tag).trim()).filter(Boolean))),
    createdAt: existing?.createdAt || input?.createdAt || now,
    updatedAt: now,
    archived: Boolean(input?.archived ?? existing?.archived),
  };
}

export default async function handler(req, res) {
  const id = workspaceId(req);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
  res.setHeader('Cache-Control', 'no-store');

  if (!configured()) {
    return res.status(503).json({ ok: false, persistent: false, error: 'Persistent knowledge storage is not configured. Connect the same Upstash Redis store used by Horizon Memory.' });
  }

  const key = `${KNOWLEDGE_PREFIX}${id}`;
  try {
    const existing = (await kv(`get/${encodeURIComponent(key)}`)) || [];
    const items = Array.isArray(existing) ? existing : [];

    if (req.method === 'GET') return res.status(200).json({ ok: true, persistent: true, documents: items });

    if (req.method === 'POST') {
      const document = normalizeDocument(req.body || {});
      if (!document.content) return res.status(400).json({ ok: false, error: 'Knowledge content is required.' });
      const duplicate = items.find((item) => !item.archived && item.title.toLowerCase() === document.title.toLowerCase() && item.content.toLowerCase() === document.content.toLowerCase());
      if (duplicate) return res.status(200).json({ ok: true, persistent: true, document: duplicate, documents: items });
      items.unshift(document);
      await kv(`set/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify(items) });
      return res.status(200).json({ ok: true, persistent: true, document, documents: items });
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const index = items.findIndex((item) => item.id === body.id);
      if (index < 0) return res.status(404).json({ ok: false, error: 'Knowledge document not found.' });
      items[index] = normalizeDocument(body.patch || {}, items[index]);
      await kv(`set/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify(items) });
      return res.status(200).json({ ok: true, persistent: true, document: items[index], documents: items });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    return res.status(502).json({ ok: false, persistent: false, error: error instanceof Error ? error.message : 'Persistent knowledge storage failed.' });
  }
}
