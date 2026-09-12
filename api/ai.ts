import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const SYSTEM_INSTRUCTION = `You are Horizon AI, the operating assistant for Horizon Works.
You are embedded inside the Horizon Works outreach control center.
Your job is to understand natural-language updates, questions, plans, client information, tasks, and ideas.
Use the supplied workspace context when relevant.
Do not claim that you changed data unless a tool actually performed that change.
Be concise, practical, and explicit about what you understood.
When the user gives unstructured information, identify useful entities such as clients, projects, tasks, deadlines, budgets, decisions, and follow-ups.
For now, you are an advisory/interpretation layer only: do not invent external actions or pretend to persist memory.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY is not configured in Vercel.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ ok: false, error: 'Message is required.' });
  }

  const ai = new GoogleGenAI({ apiKey });
  const context = body.context ? JSON.stringify(body.context) : '{}';
  const prompt = `${SYSTEM_INSTRUCTION}\n\nWORKSPACE CONTEXT:\n${context}\n\nUSER MESSAGE:\n${message}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 700,
      },
    });

    return res.status(200).json({ ok: true, text: response.text || 'Horizon could not generate a response.' });
  } catch (error) {
    console.error('Horizon AI error:', error);
    return res.status(502).json({ ok: false, error: 'Gemini request failed. Check the Vercel environment variable and model configuration.' });
  }
}
