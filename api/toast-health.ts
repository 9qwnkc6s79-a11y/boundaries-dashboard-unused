import type { VercelRequest, VercelResponse } from '@vercel/node';

const LOGBOOK_API = 'https://boundaries-logbook-application.vercel.app/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch(`${LOGBOOK_API}/toast-health`);
    if (response.ok) {
      return res.status(200).json({ status: 'ok' });
    }
    return res.status(503).json({ status: 'unavailable' });
  } catch (error) {
    return res.status(503).json({ status: 'unavailable' });
  }
}
