export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ ok: false, error: 'INSTAGRAM_ACCESS_TOKEN is not configured' });
  }

  try {
    const url = new URL('https://graph.instagram.com/v26.0/me/conversations');
    url.searchParams.set('platform', 'instagram');
    url.searchParams.set('fields', 'id,participants,updated_time');
    url.searchParams.set('limit', '50');

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data?.error?.message || 'Instagram rejected the conversations request',
        details: data?.error ? { type: data.error.type, code: data.error.code, fbtrace_id: data.error.fbtrace_id } : undefined,
      });
    }

    const ownId = typeof data?.id === 'string' ? data.id : null;
    const conversations = Array.isArray(data?.data)
      ? data.data.map((conversation) => {
          const participants = Array.isArray(conversation?.participants?.data) ? conversation.participants.data : [];
          const other = participants.find((participant) => participant?.id && participant.id !== ownId) || participants[0];
          return {
            id: conversation?.id || null,
            recipientId: other?.id || null,
            username: other?.username || null,
            name: other?.name || other?.username || 'Instagram user',
            updatedTime: conversation?.updated_time || null,
          };
        }).filter((conversation) => conversation.recipientId)
      : [];

    return res.status(200).json({ ok: true, conversations });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Instagram conversations request failed',
    });
  }
}
