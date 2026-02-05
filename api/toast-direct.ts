import type { VercelRequest, VercelResponse } from '@vercel/node';

const TOAST_API = 'https://ws-api.toasttab.com';
const CLIENT_ID = process.env.TOAST_CLIENT_ID || 'CZUYUVKLRTpFY6LVKdgJZh48Raxs99dA';
const CLIENT_SECRET = process.env.TOAST_CLIENT_SECRET || 'kdLp73z_-CYPtrwNZsFpea8tS6YmF58hf6JLeFtdOYg9V04tlEGVoHUU4orODJG7';

// Restaurant GUIDs
const RESTAURANTS: Record<string, string> = {
  littleelm: process.env.TOAST_RESTAURANT_LITTLEELM || '40980097-47ac-447d-8221-a5574db1b2f7',
  prosper: process.env.TOAST_RESTAURANT_PROSPER || 'f5e036bc-d8d0-4da9-8ec7-aec94806253b',
};

// Stores that existed last year (for SSSG calculation)
const SSSG_ELIGIBLE_STORES = ['littleelm'];

// Cache token
let cachedToken: { token: string; expires: number } | null = null;

const formatDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Calculate same period last year dates
function getLastYearDates(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setFullYear(start.getFullYear() - 1);
  end.setFullYear(end.getFullYear() - 1);

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

// Calculate same period last month dates
function getLastMonthDates(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setMonth(start.getMonth() - 1);
  end.setMonth(end.getMonth() - 1);

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) {
    return cachedToken.token;
  }

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
    throw new Error(`Toast auth failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.token?.accessToken || data.accessToken,
    expires: Date.now() + 23 * 60 * 60 * 1000,
  };

  return cachedToken.token;
}

// Get all orders with pagination
async function getAllOrders(
  restaurantGuid: string,
  startDate: string,
  endDate: string,
  token: string
): Promise<any[]> {
  const allOrders: any[] = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `${TOAST_API}/orders/v2/ordersBulk?startDate=${startDate}T00:00:00.000Z&endDate=${endDate}T23:59:59.999Z&pageSize=${pageSize}&page=${page}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Toast-Restaurant-External-ID': restaurantGuid,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Toast orders API failed: ${response.status} - ${error}`);
    }

    const orders = await response.json();

    if (Array.isArray(orders) && orders.length > 0) {
      allOrders.push(...orders);
      if (orders.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }

    // Safety limit
    if (page > 50) {
      console.warn('Hit pagination safety limit');
      break;
    }
  }

  return allOrders;
}

async function getOrdersSummary(
  restaurantGuid: string,
  startDate: string,
  endDate: string,
  token: string
): Promise<any> {
  const orders = await getAllOrders(restaurantGuid, startDate, endDate, token);

  let netSales = 0;
  let totalOrders = 0;
  let totalGuests = 0;

  for (const order of orders) {
    if (order.voided) continue;

    let orderNet = 0;
    let hasValidCheck = false;

    if (order.checks && Array.isArray(order.checks)) {
      for (const check of order.checks) {
        // Skip voided checks or checks without closed payment
        if (check.voided) continue;
        if (check.paymentStatus !== 'CLOSED') continue;

        hasValidCheck = true;

        // Use check.amount for net sales (pre-tax, excludes tips)
        let checkAmount = check.amount || 0;

        // Subtract any refunds at the payment level
        if (check.payments && Array.isArray(check.payments)) {
          for (const payment of check.payments) {
            if (payment.refund && payment.refund.refundAmount) {
              checkAmount -= payment.refund.refundAmount;
            }
          }
        }

        orderNet += checkAmount;
      }
    }

    if (hasValidCheck) {
      netSales += orderNet;
      totalOrders++;
      totalGuests += order.numberOfGuests || 1;
    }
  }

  return {
    netSales,
    totalOrders,
    totalGuests,
    averageCheck: totalOrders > 0 ? netSales / totalOrders : 0,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const locations = location ? [String(location)] : ['littleelm', 'prosper'];

    // Get comparison date ranges
    const lastYear = getLastYearDates(String(startDate), String(endDate));
    const lastMonth = getLastMonthDates(String(startDate), String(endDate));

    // Fetch current and last month data for all requested locations
    let currentResults: any[] = [];
    let lastMonthResults: any[] = [];

    for (const loc of locations) {
      const restaurantGuid = RESTAURANTS[loc];
      if (!restaurantGuid) continue;

      // Fetch current and last month in parallel
      const [currentData, lastMonthData] = await Promise.all([
        getOrdersSummary(restaurantGuid, String(startDate), String(endDate), token),
        getOrdersSummary(restaurantGuid, lastMonth.startDate, lastMonth.endDate, token).catch(() => ({
          netSales: 0,
          totalOrders: 0,
          totalGuests: 0,
          averageCheck: 0,
        })),
      ]);

      currentResults.push({ location: loc, ...currentData });
      lastMonthResults.push({ location: loc, ...lastMonthData });
    }

    // Calculate SSSG using only eligible stores (stores that existed last year)
    // Only Little Elm is eligible since Prosper is a new store
    let sssgCurrentTotal = 0;
    let sssgLastYearTotal = 0;

    for (const loc of SSSG_ELIGIBLE_STORES) {
      const restaurantGuid = RESTAURANTS[loc];
      if (!restaurantGuid) continue;

      // Get current period sales for this eligible store
      const currentForStore = currentResults.find(r => r.location === loc);
      if (currentForStore) {
        sssgCurrentTotal += currentForStore.netSales;
      }

      // Get last year sales for this eligible store
      try {
        const lastYearData = await getOrdersSummary(
          restaurantGuid,
          lastYear.startDate,
          lastYear.endDate,
          token
        );
        sssgLastYearTotal += lastYearData.netSales;
      } catch {
        // No last year data available
      }
    }

    // SSSG compares only same-store sales (Little Elm vs Little Elm last year)
    const sssg = sssgLastYearTotal > 0
      ? ((sssgCurrentTotal - sssgLastYearTotal) / sssgLastYearTotal) * 100
      : 0;

    // Check if the single requested location is SSSG eligible
    const isSssgEligible = location
      ? SSSG_ELIGIBLE_STORES.includes(String(location))
      : true; // All locations view uses eligible stores for SSSG

    // Calculate last month totals for change percentages
    const lastMonthTotal = {
      netSales: lastMonthResults.reduce((sum, r) => sum + r.netSales, 0),
      totalOrders: lastMonthResults.reduce((sum, r) => sum + r.totalOrders, 0),
      averageCheck: 0,
    };
    lastMonthTotal.averageCheck = lastMonthTotal.totalOrders > 0
      ? lastMonthTotal.netSales / lastMonthTotal.totalOrders
      : 0;

    // Helper to calculate % change
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return 0;
      return Math.round(((current - previous) / previous) * 1000) / 10; // 1 decimal
    };

    if (currentResults.length > 1) {
      const currentTotal = currentResults.reduce((sum, r) => sum + r.netSales, 0);
      const currentOrders = currentResults.reduce((sum, r) => sum + r.totalOrders, 0);
      const currentGuests = currentResults.reduce((sum, r) => sum + r.totalGuests, 0);
      const currentAvgCheck = currentOrders > 0 ? currentTotal / currentOrders : 0;

      const aggregated = {
        netSales: currentTotal,
        totalOrders: currentOrders,
        totalGuests: currentGuests,
        averageCheck: currentAvgCheck,
        sssg: Math.round(sssg * 10) / 10,
        // Month-over-month changes
        changes: {
          netSales: calcChange(currentTotal, lastMonthTotal.netSales),
          totalOrders: calcChange(currentOrders, lastMonthTotal.totalOrders),
          averageCheck: calcChange(currentAvgCheck, lastMonthTotal.averageCheck),
        },
        lastMonth: lastMonthTotal,
        sssgComparison: {
          currentStoreSales: sssgCurrentTotal,
          lastYearStoreSales: sssgLastYearTotal,
          eligibleStores: SSSG_ELIGIBLE_STORES,
        },
        locations: currentResults,
      };

      return res.status(200).json(aggregated);
    }

    // Single location
    const currentAvgCheck = currentResults[0]?.averageCheck || 0;
    const lastMonthAvgCheck = lastMonthResults[0]?.averageCheck || 0;

    return res.status(200).json({
      ...currentResults[0],
      sssg: isSssgEligible ? Math.round(sssg * 10) / 10 : null,
      changes: {
        netSales: calcChange(currentResults[0]?.netSales || 0, lastMonthResults[0]?.netSales || 0),
        totalOrders: calcChange(currentResults[0]?.totalOrders || 0, lastMonthResults[0]?.totalOrders || 0),
        averageCheck: calcChange(currentAvgCheck, lastMonthAvgCheck),
      },
      lastMonth: lastMonthResults[0] || null,
      sssgComparison: isSssgEligible ? {
        currentStoreSales: sssgCurrentTotal,
        lastYearStoreSales: sssgLastYearTotal,
        eligibleStores: SSSG_ELIGIBLE_STORES,
      } : null,
    } || { error: 'No data' });
  } catch (error) {
    console.error('Toast direct API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch from Toast',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
