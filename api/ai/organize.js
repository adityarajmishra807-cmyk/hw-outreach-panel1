export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ ok: false, error: 'Gemini API key is not configured on the server.' });
    return;
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};

  if (!message) {
    res.status(400).json({ ok: false, error: 'Message is required.' });
    return;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const prompt = `You are Horizon AI, the operating intelligence for Horizon Works.\n\nYour job is to take an unstructured note from the founder and organize it into structured workspace updates. Never invent facts. Preserve uncertainty explicitly. Prefer updating existing entities conceptually instead of creating duplicates.\n\nReturn ONLY valid JSON with this exact shape:\n{\n  "reply": "brief natural-language confirmation",\n  "actions": [\n    {\n      "type": "create_client" | "create_project" | "create_task" | "create_memory" | "update_client" | "update_project" | "update_task" | "save_note",\n      "title": "short title",\n      "data": {}\n    }\n  ],\n  "memories": [\n    {\n      "content": "durable fact or preference worth remembering",\n      "type": "fact" | "preference" | "decision" | "observation",\n      "confidence": 0.0\n    }\n  ],\n  "followUps": ["optional question only when ambiguity blocks a safe action"]\n}\n\nFor actions, use these data fields where relevant:\n- client: {"name":"", "industry":"", "handle":"", "notes":""}\n- project: {"name":"", "client":"", "status":"", "deadline":"", "budget":"", "notes":""}\n- task: {"title":"", "project":"", "client":"", "due":"", "priority":"low|medium|high", "notes":""}\n- memory: {"content":"", "scope":"company|client|project|personal"}\n\nCurrent workspace context:\n${JSON.stringify(context)}\n\nFounder message:\n${message}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    const data = await response.json();
    if (!response.ok) {
      const detail = data?.error?.message || 'Gemini request failed.';
      res.status(response.status).json({ ok: false, error: detail });
      return;
    }

    const raw = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    let organized;

    try {
      organized = JSON.parse(raw);
    } catch {
      res.status(502).json({ ok: false, error: 'Gemini returned an invalid structured response.' });
      return;
    }

    res.status(200).json({
      ok: true,
      model,
      result: {
        reply: typeof organized.reply === 'string' ? organized.reply : 'I organized that into your Horizon workspace.',
        actions: Array.isArray(organized.actions) ? organized.actions : [],
        memories: Array.isArray(organized.memories) ? organized.memories : [],
        followUps: Array.isArray(organized.followUps) ? organized.followUps : [],
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Unexpected Gemini error.' });
  }
}
