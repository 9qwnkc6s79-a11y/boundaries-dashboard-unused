import type { VercelRequest, VercelResponse } from '@vercel/node';

const TOAST_API = 'https://ws-api.toasttab.com';
const CLIENT_ID = process.env.TOAST_CLIENT_ID || 'CZUYUVKLRTpFY6LVKdgJZh48Raxs99dA';
const CLIENT_SECRET = process.env.TOAST_CLIENT_SECRET || 'kdLp73z_-CYPtrwNZsFpea8tS6YmF58hf6JLeFtdOYg9V04tlEGVoHUU4orODJG7';

const RESTAURANTS: Record<string, string> = {
  littleelm: process.env.TOAST_RESTAURANT_LITTLEELM || '40980097-47ac-447d-8221-a5574db1b2f7',
  prosper: process.env.TOAST_RESTAURANT_PROSPER || 'f5e036bc-d8d0-4da9-8ec7-aec94806253b',
};

let cachedToken: { token: string; expires: number } | null = null;

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
    throw new Error(`Toast auth failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.token?.accessToken || data.accessToken,
    expires: Date.now() + 23 * 60 * 60 * 1000,
  };

  return cachedToken.token;
}

// Get orders with timing info for operational metrics
async function getOrdersWithTiming(
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
      break;
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

    if (page > 30) break; // Safety limit
  }

  return allOrders;
}

function calculateTripTimes(orders: any[]): { avgTripTime: number; p90TripTime: number; tripTimes: number[] } {
  const tripTimes: number[] = [];

  for (const order of orders) {
    if (order.voided) continue;

    // Calculate trip time from order creation to completion
    // Use different timestamps available in Toast API
    const createdDate = order.createdDate || order.openedDate;
    const closedDate = order.closedDate || order.paidDate;

    if (createdDate && closedDate) {
      const created = new Date(createdDate).getTime();
      const closed = new Date(closedDate).getTime();
      
      if (closed > created) {
        const tripTimeSeconds = (closed - created) / 1000;
        // Filter out unreasonable times (< 30 seconds or > 30 minutes)
        if (tripTimeSeconds >= 30 && tripTimeSeconds <= 1800) {
          tripTimes.push(tripTimeSeconds);
        }
      }
    }
  }

  if (tripTimes.length === 0) {
    return { avgTripTime: 0, p90TripTime: 0, tripTimes: [] };
  }

  // Sort for percentile calculation
  tripTimes.sort((a, b) => a - b);

  const avgTripTime = tripTimes.reduce((sum, t) => sum + t, 0) / tripTimes.length;
  const p90Index = Math.floor(tripTimes.length * 0.9);
  const p90TripTime = tripTimes[p90Index] || tripTimes[tripTimes.length - 1];

  return {
    avgTripTime: Math.round(avgTripTime),
    p90TripTime: Math.round(p90TripTime),
    tripTimes,
  };
}

function calculateHourlyMetrics(orders: any[]): any[] {
  const hourlyBuckets: Map<number, { revenue: number; orders: number }> = new Map();

  for (const order of orders) {
    if (order.voided) continue;

    const createdDate = order.createdDate || order.openedDate;
    if (!createdDate) continue;

    const hour = new Date(createdDate).getHours();
    const current = hourlyBuckets.get(hour) || { revenue: 0, orders: 0 };

    // Get order amount
    let orderAmount = 0;
    if (order.checks) {
      for (const check of order.checks) {
        if (!check.voided && check.paymentStatus === 'CLOSED') {
          orderAmount += check.amount || 0;
        }
      }
    }

    current.revenue += orderAmount;
    current.orders += 1;
    hourlyBuckets.set(hour, current);
  }

  // Convert to array format for chart
  const result = [];
  for (let hour = 6; hour <= 19; hour++) {
    const data = hourlyBuckets.get(hour) || { revenue: 0, orders: 0 };
    result.push({
      time: `${hour.toString().padStart(2, '0')}:00`,
      hour,
      revenue: Math.round(data.revenue),
      transactions: data.orders,
    });
  }

  return result;
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

    let allOrders: any[] = [];
    let totalRefunds = 0;
    let totalOrders = 0;

    for (const loc of locations) {
      const restaurantGuid = RESTAURANTS[loc];
      if (!restaurantGuid) continue;

      const orders = await getOrdersWithTiming(restaurantGuid, String(startDate), String(endDate), token);
      allOrders.push(...orders.map(o => ({ ...o, location: loc })));
    }

    // Calculate operational metrics
    const { avgTripTime, p90TripTime, tripTimes } = calculateTripTimes(allOrders);
    const hourlyData = calculateHourlyMetrics(allOrders);

    // Count refunds
    for (const order of allOrders) {
      if (order.voided) continue;
      totalOrders++;
      
      if (order.checks) {
        for (const check of order.checks) {
          if (check.payments) {
            for (const payment of check.payments) {
              if (payment.refund && payment.refund.refundAmount > 0) {
                totalRefunds++;
              }
            }
          }
        }
      }
    }

    const refundRate = totalOrders > 0 ? (totalRefunds / totalOrders) * 100 : 0;

    // Calculate operating hours (assume 6 AM - 7 PM = 13 hours)
    const startD = new Date(String(startDate));
    const endD = new Date(String(endDate));
    const daysDiff = Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const operatingHours = daysDiff * 13; // 13 hours per day

    const carsPerHour = operatingHours > 0 ? totalOrders / operatingHours : 0;

    return res.status(200).json({
      avgTripTime,
      p90TripTime,
      carsPerHour: Math.round(carsPerHour * 10) / 10,
      totalOrders,
      refundCount: totalRefunds,
      refundRate: Math.round(refundRate * 100) / 100,
      hourlyData,
      tripTimeCount: tripTimes.length,
      operatingHours,
      isLiveData: true,
    });
  } catch (error) {
    console.error('Toast operations API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch operational data',
      details: error instanceof Error ? error.message : 'Unknown error',
      isLiveData: false,
    });
  }
}
