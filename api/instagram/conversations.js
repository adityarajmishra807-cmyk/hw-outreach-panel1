export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ ok: false, error: 'INSTAGRAM_ACCESS_TOKEN is not configured' });
  }

  async function graphGet(url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  try {
    const meUrl = new URL('https://graph.instagram.com/v26.0/me');
    meUrl.searchParams.set('fields', 'id,username,name');
    const meResult = await graphGet(meUrl);

    if (!meResult.response.ok) {
      return res.status(meResult.response.status).json({
        ok: false,
        error: meResult.data?.error?.message || 'Instagram account lookup failed',
      });
    }

    const ownId = meResult.data?.id;
    const conversationsUrl = new URL('https://graph.instagram.com/v26.0/me/conversations');
    conversationsUrl.searchParams.set('platform', 'instagram');
    conversationsUrl.searchParams.set('fields', 'id,updated_time');
    conversationsUrl.searchParams.set('limit', '20');

    const listResult = await graphGet(conversationsUrl);
    if (!listResult.response.ok) {
      return res.status(listResult.response.status).json({
        ok: false,
        error: listResult.data?.error?.message || 'Instagram rejected the conversations request',
        details: listResult.data?.error ? {
          type: listResult.data.error.type,
          code: listResult.data.error.code,
          fbtrace_id: listResult.data.error.fbtrace_id,
        } : undefined,
      });
    }

    const rawConversations = Array.isArray(listResult.data?.data) ? listResult.data.data : [];
    const conversations = [];

    for (const conversation of rawConversations) {
      if (!conversation?.id) continue;

      const detailUrl = new URL(`https://graph.instagram.com/v26.0/${conversation.id}`);
      detailUrl.searchParams.set('fields', 'messages.limit(10){id,created_time,from,to,message}');
      const detailResult = await graphGet(detailUrl);
      if (!detailResult.response.ok) continue;

      const messages = Array.isArray(detailResult.data?.messages?.data)
        ? detailResult.data.messages.data
        : [];

      let participant = null;
      for (const message of messages) {
        const from = message?.from;
        const to = Array.isArray(message?.to?.data) ? message.to.data : [];
        const candidates = [];
        if (from?.id && from.id !== ownId) candidates.push(from);
        for (const recipient of to) {
          if (recipient?.id && recipient.id !== ownId) candidates.push(recipient);
        }
        if (candidates.length) {
          participant = candidates[0];
          break;
        }
      }

      if (!participant?.id) continue;

      const latestMessage = messages[0] || null;
      conversations.push({
        id: conversation.id,
        recipientId: participant.id,
        username: participant.username || null,
        name: participant.name || participant.username || 'Instagram user',
        updatedTime: conversation.updated_time || latestMessage?.created_time || null,
        latestMessage: latestMessage?.message || null,
      });
    }

    return res.status(200).json({
      ok: true,
      account: {
        id: ownId,
        username: meResult.data?.username || null,
        name: meResult.data?.name || null,
      },
      conversations,
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Instagram conversations request failed',
    });
  }
}
