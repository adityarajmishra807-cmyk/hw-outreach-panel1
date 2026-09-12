export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ ok: false, error: 'GEMINI_KEY is not configured in Vercel.' });
    return;
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
  if (!message) {
    res.status(400).json({ ok: false, error: 'Message is required.' });
    return;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const system = `You are Horizon AI, the operating intelligence for Horizon Works.

The user speaks naturally and may provide messy updates about clients, prospects, projects, tasks, ideas, decisions, deadlines, budgets, preferences, or observations. Your job is to understand the update and propose precise workspace organization.

CRITICAL RULES:
1. Never invent facts. Only extract or infer what is strongly supported.
2. Prefer updating an existing record over creating a duplicate.
3. Use the supplied current workspace context to identify existing records.
4. A memory is for durable context; transactional facts such as deadlines and budgets should also live on the relevant project/client/task.
5. When something is uncertain, put it in followUps instead of guessing.
6. Keep actions atomic and easy for the application to apply safely.
7. Return ONLY valid JSON. No markdown, no code fences.

Return exactly this shape:
{
  "text": "concise natural-language response",
  "actions": [
    {
      "operation": "create" | "update",
      "type": "client" | "project" | "task" | "note",
      "title": "short human-readable title",
      "match": { "name": "existing record name" },
      "data": {}
    }
  ],
  "memories": [
    {
      "operation": "create" | "update",
      "content": "durable fact, preference, decision, or recurring observation",
      "type": "fact" | "preference" | "decision" | "observation",
      "scope": "personal" | "company" | "client" | "project",
      "confidence": 0.0
    }
  ],
  "followUps": ["question only if necessary"]
}

Action data conventions:
client: { name, handle, industry, notes }
project: { name, client, status, deadline, budget, notes }
task: { title, client, project, due, priority, status, notes }
note: { content, relatedTo }

For update actions, match against an existing record using the strongest available stable identifier (usually name). Only use update when the current workspace context contains a plausible matching record.

CURRENT HORIZON WORKS WORKSPACE CONTEXT:
${JSON.stringify(context)}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: payload?.error?.message || 'Gemini request failed.' });
    }

    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    if (!text) return res.status(502).json({ ok: false, error: 'Gemini returned no content.' });

    let structured;
    try {
      structured = JSON.parse(text);
    } catch {
      return res.status(502).json({ ok: false, error: 'Gemini returned invalid JSON.' });
    }

    const actions = Array.isArray(structured.actions)
      ? structured.actions.map((a) => ({
          operation: a?.operation === 'update' ? 'update' : 'create',
          type: ['client', 'project', 'task', 'note'].includes(a?.type) ? a.type : 'note',
          title: typeof a?.title === 'string' ? a.title : undefined,
          match: a?.match && typeof a.match === 'object' ? a.match : undefined,
          data: a?.data && typeof a.data === 'object' ? a.data : {},
        }))
      : [];

    const memories = Array.isArray(structured.memories)
      ? structured.memories.map((m) => ({
          operation: m?.operation === 'update' ? 'update' : 'create',
          content: typeof m?.content === 'string' ? m.content : '',
          type: ['fact', 'preference', 'decision', 'observation'].includes(m?.type) ? m.type : 'observation',
          scope: ['personal', 'company', 'client', 'project'].includes(m?.scope) ? m.scope : 'company',
          confidence: typeof m?.confidence === 'number' ? Math.max(0, Math.min(1, m.confidence)) : 0.9,
        })).filter((m) => m.content);

    return res.status(200).json({
      ok: true,
      model,
      text: typeof structured.text === 'string' ? structured.text : 'I organized that update.',
      organization: {
        actions,
        memories,
        followUps: Array.isArray(structured.followUps) ? structured.followUps.filter((x) => typeof x === 'string') : [],
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unexpected Gemini error.' });
  }
}
