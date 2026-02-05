import type { VercelRequest, VercelResponse } from '@vercel/node';

const TOAST_API = 'https://ws-api.toasttab.com';
const CLIENT_ID = process.env.TOAST_CLIENT_ID || 'CZUYUVKLRTpFY6LVKdgJZh48Raxs99dA';
const CLIENT_SECRET = process.env.TOAST_CLIENT_SECRET || 'kdLp73z_-CYPtrwNZsFpea8tS6YmF58hf6JLeFtdOYg9V04tlEGVoHUU4orODJG7';

// Restaurant GUIDs
const RESTAURANTS: Record<string, string> = {
  littleelm: process.env.TOAST_RESTAURANT_LITTLEELM || '40980097-47ac-447d-8221-a5574db1b2f7',
  prosper: process.env.TOAST_RESTAURANT_PROSPER || 'f5e036bc-d8d0-4da9-8ec7-aec94806253b',
};

// Cache token to avoid re-auth on every request
let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && cachedToken.expires > Date.now()) {
    return cachedToken.token;
  }

  const response = await fetch(`${TOAST_API}/authentication/v1/authentication/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      userAccessType: 'TOAST_MACHINE_CLIENT',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Toast auth failed: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Cache token for 23 hours (tokens typically last 24 hours)
  cachedToken = {
    token: data.token?.accessToken || data.accessToken,
    expires: Date.now() + 23 * 60 * 60 * 1000,
  };

  return cachedToken.token;
}

async function getOrdersSummary(
  restaurantGuid: string,
  startDate: string,
  endDate: string,
  token: string
): Promise<any> {
  // Toast Orders API - get orders for date range
  const response = await fetch(
    `${TOAST_API}/orders/v2/ordersBulk?startDate=${startDate}T00:00:00.000Z&endDate=${endDate}T23:59:59.999Z`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Toast-Restaurant-External-ID': restaurantGuid,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Toast orders API failed: ${response.status} - ${error}`);
  }

  const orders = await response.json();

  // Calculate summary from orders
  let netSales = 0;
  let totalOrders = 0;
  let totalGuests = 0;

  for (const order of orders) {
    if (order.voided) continue;

    // Sum payments from all checks in the order
    let orderTotal = 0;
    if (order.checks && Array.isArray(order.checks)) {
      for (const check of order.checks) {
        if (check.payments && Array.isArray(check.payments)) {
          for (const payment of check.payments) {
            if (payment.refundStatus !== 'FULL') {
              orderTotal += payment.amount || 0;
            }
          }
        }
      }
    }

    netSales += orderTotal;
    totalOrders++;
    totalGuests += order.numberOfGuests || 1;
  }

  return {
    netSales, // Already in dollars
    totalOrders,
    totalGuests,
    averageCheck: totalOrders > 0 ? netSales / totalOrders : 0,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { startDate, endDate, location } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate required' });
    }

    const token = await getAccessToken();

    let results: any[] = [];
    const locations = location ? [String(location)] : ['littleelm', 'prosper'];

    for (const loc of locations) {
      const restaurantGuid = RESTAURANTS[loc];
      if (!restaurantGuid) {
        console.warn(`No restaurant GUID for location: ${loc}`);
        continue;
      }

      const data = await getOrdersSummary(
        restaurantGuid,
        String(startDate),
        String(endDate),
        token
      );

      results.push({ location: loc, ...data });
    }

    // Aggregate if multiple locations
    if (results.length > 1) {
      const aggregated = {
        netSales: results.reduce((sum, r) => sum + r.netSales, 0),
        totalOrders: results.reduce((sum, r) => sum + r.totalOrders, 0),
        totalGuests: results.reduce((sum, r) => sum + r.totalGuests, 0),
        averageCheck: 0,
        locations: results,
      };
      aggregated.averageCheck = aggregated.totalOrders > 0
        ? aggregated.netSales / aggregated.totalOrders
        : 0;

      return res.status(200).json(aggregated);
    }

    return res.status(200).json(results[0] || { error: 'No data' });
  } catch (error) {
    console.error('Toast direct API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch from Toast',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
