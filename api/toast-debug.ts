import type { VercelRequest, VercelResponse } from '@vercel/node';

const TOAST_API = 'https://ws-api.toasttab.com';
const CLIENT_ID = 'CZUYUVKLRTpFY6LVKdgJZh48Raxs99dA';
const CLIENT_SECRET = 'kdLp73z_-CYPtrwNZsFpea8tS6YmF58hf6JLeFtdOYg9V04tlEGVoHUU4orODJG7';

async function getAccessToken(): Promise<string> {
  const response = await fetch(`${TOAST_API}/authentication/v1/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      userAccessType: 'TOAST_MACHINE_CLIENT',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Auth failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.token?.accessToken || data.accessToken;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const token = await getAccessToken();
    const restaurantGuid = '40980097-47ac-447d-8221-a5574db1b2f7'; // Little Elm
    const startDate = '2026-02-04';
    const endDate = '2026-02-04';

    const response = await fetch(
      `${TOAST_API}/orders/v2/ordersBulk?startDate=${startDate}T00:00:00.000Z&endDate=${endDate}T23:59:59.999Z`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Toast-Restaurant-External-ID': restaurantGuid,
        },
      }
    );

    const orders = await response.json();

    // Return first order to see structure
    return res.status(200).json({
      orderCount: orders.length,
      sampleOrder: orders[0] || null,
      allFields: orders[0] ? Object.keys(orders[0]) : [],
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown' });
  }
}
