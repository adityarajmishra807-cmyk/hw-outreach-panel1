const COOKIE_NAME = 'horizon_workspace_id';
const AUDIT_PREFIX = 'horizon:audit:';
const MAX_ENTRIES = 500;

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
  if (!response.ok) throw new Error(payload?.error || 'Persistent audit request failed.');
  return payload?.result;
}

function normalize(entry) {
  const now = new Date().toISOString();
  return {
    id: typeof entry?.id === 'string' && entry.id ? entry.id : crypto.randomUUID(),
    kind: typeof entry?.kind === 'string' ? entry.kind : 'tool_call',
    action: typeof entry?.action === 'string' ? entry.action : 'unknown',
    summary: typeof entry?.summary === 'string' ? entry.summary : '',
    metadata: entry?.metadata && typeof entry.metadata === 'object' ? entry.metadata : undefined,
    createdAt: typeof entry?.createdAt === 'string' ? entry.createdAt : now,
  };
}

export default async function handler(req, res) {
  const id = workspaceId(req);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
  res.setHeader('Cache-Control', 'no-store');

  if (!configured()) {
    if (req.method === 'GET') return res.status(200).json({ ok: true, persistent: false, entries: [] });
    return res.status(503).json({ ok: false, persistent: false, error: 'Persistent audit storage is not configured.' });
  }

  const key = `${AUDIT_PREFIX}${id}`;

  try {
    if (req.method === 'GET') {
      const entries = (await kv(`get/${encodeURIComponent(key)}`)) || [];
      return res.status(200).json({ ok: true, persistent: true, entries: Array.isArray(entries) ? entries.slice(0, MAX_ENTRIES) : [] });
    }

    if (req.method === 'POST') {
      const entry = normalize(req.body || {});
      const existing = (await kv(`get/${encodeURIComponent(key)}`)) || [];
      const items = Array.isArray(existing) ? existing : [];
      const index = items.findIndex((item) => item.id === entry.id);
      if (index >= 0) items[index] = entry;
      else items.unshift(entry);
      items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      await kv(`set/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify(items.slice(0, MAX_ENTRIES)) });
      return res.status(200).json({ ok: true, persistent: true, entry, entries: items.slice(0, MAX_ENTRIES) });
    }

    if (req.method === 'DELETE') {
      await kv(`del/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify(true) });
      return res.status(200).json({ ok: true, persistent: true, entries: [] });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    return res.status(502).json({ ok: false, persistent: false, error: error instanceof Error ? error.message : 'Persistent audit storage failed.' });
  }
}
