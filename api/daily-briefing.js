import { buildContext } from '../lib/context.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'GEMINI_KEY is not configured in Vercel.' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const workspace = body.workspace && typeof body.workspace === 'object' ? body.workspace : {};
  const prospects = asArray(body.prospects);
  const organizedRecords = asArray(body.organizedRecords);
  const memories = asArray(body.memories).filter((item) => !item?.archived);
  const knowledge = asArray(body.knowledge);
  const now = typeof body.now === 'string' ? body.now : new Date().toISOString();

  const context = buildContext({
    message: 'today daily briefing priorities deadlines follow ups risks',
    workspace,
    organizedRecords,
    memories,
    prospects,
    knowledge,
    conversation: [],
  });

  const system = `You are Horizon AI, the daily operating intelligence for Horizon Works.

Create a practical daily briefing from the supplied workspace context. Never invent facts. Prioritize concrete work, deadlines, follow-ups, risks, and opportunities. Use only evidence present in the context. When a date is known, preserve it. Distinguish urgent from important.

Return ONLY valid JSON matching this shape:
{
  "headline": "one sentence summary",
  "priorities": [
    { "title": "short priority", "reason": "why now", "urgency": "high" | "medium" | "low", "source": "record or prospect name" }
  ],
  "followUps": [
    { "title": "follow-up", "reason": "why", "source": "record or prospect name" }
  ],
  "risks": [
    { "title": "risk", "detail": "evidence-based detail", "severity": "high" | "medium" | "low" }
  ],
  "opportunities": [
    { "title": "opportunity", "detail": "evidence-based detail", "source": "record or prospect name" }
  ],
  "note": "one concise operating recommendation"
}

Prefer 3-5 priorities, 0-5 follow-ups, 0-3 risks, and 0-3 opportunities. Do not repeat the same item across sections unless the distinction is meaningful.

CURRENT TIME:
${now}

BOUNDED CONTEXT:
${JSON.stringify(context)}`;

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: 'Generate today\'s Horizon Works briefing.' }] }],
        generationConfig: { temperature: 0.15, responseMimeType: 'application/json' },
      }),
    });

    const payload = await response.json();
    if (!response.ok) return res.status(response.status).json({ ok: false, error: payload?.error?.message || 'Gemini briefing request failed.' });

    const raw = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    if (!raw) return res.status(502).json({ ok: false, error: 'Gemini returned no briefing.' });

    let briefing;
    try {
      briefing = JSON.parse(raw);
    } catch {
      return res.status(502).json({ ok: false, error: 'Gemini returned invalid briefing JSON.' });
    }

    const normalizeItem = (item, kind) => {
      if (!item || typeof item !== 'object') return null;
      const result = {
        title: typeof item.title === 'string' ? item.title.trim() : '',
        reason: typeof item.reason === 'string' ? item.reason.trim() : '',
        detail: typeof item.detail === 'string' ? item.detail.trim() : '',
        source: typeof item.source === 'string' ? item.source.trim() : '',
      };
      if (!result.title) return null;
      if (kind === 'priority') result.urgency = ['high', 'medium', 'low'].includes(item.urgency) ? item.urgency : 'medium';
      if (kind === 'risk') result.severity = ['high', 'medium', 'low'].includes(item.severity) ? item.severity : 'medium';
      return result;
    };

    const priorities = asArray(briefing.priorities).map((item) => normalizeItem(item, 'priority')).filter(Boolean).slice(0, 5);
    const followUps = asArray(briefing.followUps).map((item) => normalizeItem(item, 'followUp')).filter(Boolean).slice(0, 5);
    const risks = asArray(briefing.risks).map((item) => normalizeItem(item, 'risk')).filter(Boolean).slice(0, 3);
    const opportunities = asArray(briefing.opportunities).map((item) => normalizeItem(item, 'opportunity')).filter(Boolean).slice(0, 3);

    return res.status(200).json({
      ok: true,
      model,
      context: context.summary,
      briefing: {
        headline: typeof briefing.headline === 'string' ? briefing.headline.trim() : 'Here is your Horizon briefing.',
        priorities,
        followUps,
        risks,
        opportunities,
        note: typeof briefing.note === 'string' ? briefing.note.trim() : '',
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unexpected daily briefing error.' });
  }
}
