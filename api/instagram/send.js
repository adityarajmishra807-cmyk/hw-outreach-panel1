export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ ok: false, error: 'INSTAGRAM_ACCESS_TOKEN is not configured' });
  }

  const recipientId = typeof req.body?.recipientId === 'string' ? req.body.recipientId.trim() : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

  if (!recipientId) {
    return res.status(400).json({ ok: false, error: 'recipientId is required' });
  }

  if (!message) {
    return res.status(400).json({ ok: false, error: 'message is required' });
  }

  if (message.length > 1000) {
    return res.status(400).json({ ok: false, error: 'message must be 1000 characters or fewer' });
  }

  try {
    const response = await fetch('https://graph.instagram.com/v26.0/me/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data?.error?.message || 'Instagram rejected the message',
        details: data?.error ? { type: data.error.type, code: data.error.code, fbtrace_id: data.error.fbtrace_id } : undefined,
      });
    }

    return res.status(200).json({
      ok: true,
      recipientId: data?.recipient_id,
      messageId: data?.message_id,
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Instagram API request failed',
    });
  }
}
