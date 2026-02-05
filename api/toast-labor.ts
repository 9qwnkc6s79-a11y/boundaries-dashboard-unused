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
    const { startDate, endDate, location } = req.query;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', String(startDate));
    if (endDate) params.append('endDate', String(endDate));
    if (location) params.append('location', String(location));

    const response = await fetch(`${LOGBOOK_API}/toast-labor?${params}`);
    const data = await response.json();

    return res.status(200).json(data);
  } catch (error) {
    console.error('Toast labor API error:', error);
    return res.status(500).json({ error: 'Failed to fetch labor data' });
  }
}
