export default async function handler(req, res) {
  // CORS erlauben (für lokale Tests / andere Origins, MVP-freundlich)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const url = process.env.MAKE_OPENAI_WEBHOOK_URL; // in Vercel als ENV setzen!
    if (!url) return res.status(500).json({ error: 'Missing webhook URL' });

    // Optional: einfache Payload-Validierung
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    // Optional: Rate-Limit, Origin-Check etc.

    const makeRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' /*, 'Authorization': `Bearer ${process.env.MY_SECRET}`*/ },
      body: JSON.stringify(body)
    });

    const text = await makeRes.text();
    // Versuche JSON zurückzugeben, sonst Plaintext
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
