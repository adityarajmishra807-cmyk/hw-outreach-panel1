export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ connected: false, error: 'INSTAGRAM_ACCESS_TOKEN is not configured' });
  }

  try {
    const url = new URL('https://graph.instagram.com/v26.0/me');
    url.searchParams.set('fields', 'id,username,name,account_type');
    url.searchParams.set('access_token', accessToken);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(401).json({ connected: false, error: data?.error?.message || 'Instagram token rejected' });
    }

    return res.status(200).json({
      connected: true,
      account: data,
    });
  } catch (error) {
    return res.status(500).json({
      connected: false,
      error: error instanceof Error ? error.message : 'Instagram connection check failed',
    });
  }
}
