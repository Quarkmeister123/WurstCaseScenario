export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const upstream = await fetch(process.env.MAKE_OPENAI_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // WICHTIG: Status durchreichen (inkl. 429) – aber IMMER JSON liefern
    if (!upstream.ok) {
      // Optional: Retry-After weitergeben, falls vorhanden
      const ra = upstream.headers.get('retry-after');
      if (ra) res.setHeader('Retry-After', ra);
      return res.status(upstream.status).json({
        error: 'upstream_error',
        status: upstream.status,
        details: data
      });
    }
    return res.status(200).json(data);
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'gateway_error' });
  }
}
