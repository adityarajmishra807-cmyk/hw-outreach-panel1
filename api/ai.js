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
  const system = `You are Horizon AI, the operating intelligence for Horizon Works. The user gives you informal updates about clients, prospects, projects, tasks, ideas, decisions, deadlines, and observations.

Your job is to understand the update and propose safe, concrete workspace organization. Do not invent missing facts. Reuse the user's terminology. When something is uncertain, put it in followUps instead of making it up.

Return ONLY JSON in this exact shape:
{
  "text": "A concise natural-language response to the user.",
  "actions": [
    {
      "type": "create_client" | "create_project" | "create_task" | "save_memory" | "save_note",
      "title": "short human-readable title",
      "data": {}
    }
  ],
  "memories": [
    {
      "content": "durable fact, preference, decision, or recurring observation",
      "type": "fact" | "preference" | "decision" | "observation",
      "confidence": 0.0
    }
  ],
  "followUps": ["question only if necessary"]
}

Use these data conventions where useful:
create_client: { name, handle, industry, notes }
create_project: { name, client, status, deadline, budget, notes }
create_task: { title, client, project, due, priority, notes }
save_memory: { content, scope: "personal" | "company" | "client" | "project" }
save_note: { content }

Current Horizon Works outreach context:
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
          temperature: 0.15,
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

    return res.status(200).json({
      ok: true,
      model,
      text: typeof structured.text === 'string' ? structured.text : 'I organized that update.',
      organization: {
        actions: Array.isArray(structured.actions) ? structured.actions : [],
        memories: Array.isArray(structured.memories) ? structured.memories : [],
        followUps: Array.isArray(structured.followUps) ? structured.followUps : [],
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unexpected Gemini error.' });
  }
}
