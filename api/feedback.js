export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const url = process.env.MAKE_FEEDBACK_WEBHOOK_URL;
    if (!url) return res.status(500).json({ error: 'Missing webhook URL' });

    const makeRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });

    const text = await makeRes.text();
    try {
      const json = JSON.parse(text);
      return res.status(makeRes.status).json(json);
    } catch {
      return res.status(makeRes.status).send(text);
    }
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'Upstream error' });
  }
}
