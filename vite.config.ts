import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

// Toast API configuration
const TOAST_API = 'https://ws-api.toasttab.com';

const RESTAURANTS: Record<string, string> = {
  littleelm: '40980097-47ac-447d-8221-a5574db1b2f7',
  prosper: 'f5e036bc-d8d0-4da9-8ec7-aec94806253b',
};

// Stores that existed last year (for SSSG calculation)
const SSSG_ELIGIBLE_STORES = ['littleelm'];

let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(env: Record<string, string>): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) {
    return cachedToken.token;
  }

  const clientId = env.TOAST_CLIENT_ID || 'CZUYUVKLRTpFY6LVKdgJZh48Raxs99dA';
  const clientSecret = env.TOAST_CLIENT_SECRET || 'kdLp73z_-CYPtrwNZsFpea8tS6YmF58hf6JLeFtdOYg9V04tlEGVoHUU4orODJG7';

  const response = await fetch(`${TOAST_API}/authentication/v1/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId,
      clientSecret,
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

    if (page > 50) {
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
        if (check.voided) continue;
        if (check.paymentStatus !== 'CLOSED') continue;

        hasValidCheck = true;
        let checkAmount = check.amount || 0;

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

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

// Labor API helpers
async function getTimeEntries(
  restaurantGuid: string,
  startDate: string,
  endDate: string,
  token: string
): Promise<any[]> {
  const response = await fetch(
    `${TOAST_API}/labor/v1/timeEntries?startDate=${startDate}&endDate=${endDate}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Toast-Restaurant-External-ID': restaurantGuid,
      },
    }
  );
  if (!response.ok) return [];
  return response.json();
}

async function getEmployees(
  restaurantGuid: string,
  token: string
): Promise<any[]> {
  const response = await fetch(
    `${TOAST_API}/labor/v1/employees`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Toast-Restaurant-External-ID': restaurantGuid,
      },
    }
  );
  if (!response.ok) return [];
  return response.json();
}

// Operations helpers
function calculateTripTimes(orders: any[]): { avgTripTime: number; p90TripTime: number; tripTimes: number[] } {
  const tripTimes: number[] = [];

  for (const order of orders) {
    if (order.voided) continue;
    const createdDate = order.createdDate || order.openedDate;
    const closedDate = order.closedDate || order.paidDate;

    if (createdDate && closedDate) {
      const created = new Date(createdDate).getTime();
      const closed = new Date(closedDate).getTime();

      if (closed > created) {
        const tripTimeSeconds = (closed - created) / 1000;
        if (tripTimeSeconds >= 30 && tripTimeSeconds <= 1800) {
          tripTimes.push(tripTimeSeconds);
        }
      }
    }
  }

  if (tripTimes.length === 0) {
    return { avgTripTime: 0, p90TripTime: 0, tripTimes: [] };
  }

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

function apiPlugin(env: Record<string, string>) {
  return {
    name: 'toast-api-dev',
    configureServer(server: any) {
      // Toast Direct (Sales) API
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/toast-direct')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
          const url = new URL(req.url, 'http://localhost');
          const startDate = url.searchParams.get('startDate');
          const endDate = url.searchParams.get('endDate');
          const location = url.searchParams.get('location');

          if (!startDate || !endDate) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'startDate and endDate required' }));
            return;
          }

          const token = await getAccessToken(env);
          const locations = location ? [location] : ['littleelm', 'prosper'];

          const lastMonth = getLastMonthDates(startDate, endDate);
          const lastYear = getLastYearDates(startDate, endDate);

          const currentResults: any[] = [];
          const lastMonthResults: any[] = [];

          for (const loc of locations) {
            const restaurantGuid = RESTAURANTS[loc];
            if (!restaurantGuid) continue;

            const [currentData, lastMonthData] = await Promise.all([
              getOrdersSummary(restaurantGuid, startDate, endDate, token),
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

          // Calculate SSSG - always use MTD (1st of month to today) regardless of selected period
          const now = new Date();
          const mtdStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          const mtdEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const mtdLastYear = getLastYearDates(mtdStart, mtdEnd);

          let sssgCurrentTotal = 0;
          let sssgLastYearTotal = 0;

          for (const loc of SSSG_ELIGIBLE_STORES) {
            const restaurantGuid = RESTAURANTS[loc];
            if (!restaurantGuid) continue;

            try {
              const [currentMtd, lastYearMtd] = await Promise.all([
                getOrdersSummary(restaurantGuid, mtdStart, mtdEnd, token),
                getOrdersSummary(restaurantGuid, mtdLastYear.startDate, mtdLastYear.endDate, token),
              ]);
              sssgCurrentTotal += currentMtd.netSales;
              sssgLastYearTotal += lastYearMtd.netSales;
            } catch {
              // No data available
            }
          }

          const sssg = sssgLastYearTotal > 0
            ? ((sssgCurrentTotal - sssgLastYearTotal) / sssgLastYearTotal) * 100
            : 0;

          const calcChange = (current: number, previous: number) => {
            if (previous === 0) return 0;
            return Math.round(((current - previous) / previous) * 1000) / 10;
          };

          const lastMonthTotal = {
            netSales: lastMonthResults.reduce((sum, r) => sum + r.netSales, 0),
            totalOrders: lastMonthResults.reduce((sum, r) => sum + r.totalOrders, 0),
            averageCheck: 0,
          };
          lastMonthTotal.averageCheck = lastMonthTotal.totalOrders > 0
            ? lastMonthTotal.netSales / lastMonthTotal.totalOrders
            : 0;

          if (currentResults.length > 1) {
            const currentTotal = currentResults.reduce((sum, r) => sum + r.netSales, 0);
            const currentOrders = currentResults.reduce((sum, r) => sum + r.totalOrders, 0);
            const currentGuests = currentResults.reduce((sum, r) => sum + r.totalGuests, 0);
            const currentAvgCheck = currentOrders > 0 ? currentTotal / currentOrders : 0;

            res.end(JSON.stringify({
              netSales: currentTotal,
              totalOrders: currentOrders,
              totalGuests: currentGuests,
              averageCheck: currentAvgCheck,
              sssg: Math.round(sssg * 10) / 10,
              changes: {
                netSales: calcChange(currentTotal, lastMonthTotal.netSales),
                totalOrders: calcChange(currentOrders, lastMonthTotal.totalOrders),
                averageCheck: calcChange(currentAvgCheck, lastMonthTotal.averageCheck),
              },
              locations: currentResults,
            }));
          } else {
            res.end(JSON.stringify({
              ...currentResults[0],
              sssg: Math.round(sssg * 10) / 10,
              changes: {
                netSales: calcChange(currentResults[0]?.netSales || 0, lastMonthResults[0]?.netSales || 0),
                totalOrders: calcChange(currentResults[0]?.totalOrders || 0, lastMonthResults[0]?.totalOrders || 0),
                averageCheck: calcChange(currentResults[0]?.averageCheck || 0, lastMonthResults[0]?.averageCheck || 0),
              },
            }));
          }
        } catch (error) {
          console.error('Toast API error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({
            error: 'Failed to fetch from Toast',
            details: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      });

      // Toast Labor API
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/toast-labor-direct')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
          const url = new URL(req.url, 'http://localhost');
          const startDate = url.searchParams.get('startDate');
          const endDate = url.searchParams.get('endDate');
          const location = url.searchParams.get('location');

          if (!startDate || !endDate) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'startDate and endDate required' }));
            return;
          }

          const token = await getAccessToken(env);
          const locations = location ? [location] : ['littleelm', 'prosper'];

          let totalLaborHours = 0;
          let totalLaborCost = 0;
          const allTimeEntries: any[] = [];
          const employeeMap = new Map<string, any>();

          for (const loc of locations) {
            const restaurantGuid = RESTAURANTS[loc];
            if (!restaurantGuid) continue;

            const [timeEntries, employees] = await Promise.all([
              getTimeEntries(restaurantGuid, startDate, endDate, token),
              getEmployees(restaurantGuid, token),
            ]);

            for (const emp of employees) {
              if (emp.guid) {
                employeeMap.set(emp.guid, { ...emp, location: loc });
              }
            }

            for (const entry of timeEntries) {
              if (entry.deleted) continue;

              const inTime = entry.inDate ? new Date(entry.inDate).getTime() : 0;
              const outTime = entry.outDate ? new Date(entry.outDate).getTime() : Date.now();

              if (inTime && outTime > inTime) {
                const hours = (outTime - inTime) / (1000 * 60 * 60);
                totalLaborHours += hours;

                const hourlyWage = entry.hourlyWage || entry.regularHourlyWage || 15;
                totalLaborCost += hours * hourlyWage;

                allTimeEntries.push({
                  ...entry,
                  location: loc,
                  calculatedHours: hours,
                });
              }
            }
          }

          // Get sales data for labor percentage calculation
          let totalSales = 0;
          try {
            const salesUrl = new URL('/api/toast-direct', 'http://localhost:3000');
            salesUrl.searchParams.set('startDate', startDate);
            salesUrl.searchParams.set('endDate', endDate);
            if (location) salesUrl.searchParams.set('location', location);

            // Fetch sales from our own endpoint - simulate by calculating directly
            const salesLocations = location ? [location] : ['littleelm', 'prosper'];
            for (const loc of salesLocations) {
              const restaurantGuid = RESTAURANTS[loc];
              if (!restaurantGuid) continue;
              const salesData = await getOrdersSummary(restaurantGuid, startDate, endDate, token);
              totalSales += salesData.netSales;
            }
          } catch {
            // If we can't get sales, continue without percentage
          }

          const laborPercent = totalSales > 0 ? (totalLaborCost / totalSales) * 100 : 0;
          const revPerLaborHour = totalLaborHours > 0 ? totalSales / totalLaborHours : 0;

          // Group by employee for top performers
          const employeeMetrics = new Map<string, { hours: number; entries: number; name: string }>();
          for (const entry of allTimeEntries) {
            const empGuid = entry.employeeReference?.guid;
            if (empGuid) {
              const emp = employeeMap.get(empGuid);
              const current = employeeMetrics.get(empGuid) || { hours: 0, entries: 0, name: emp?.firstName || 'Unknown' };
              current.hours += entry.calculatedHours || 0;
              current.entries += 1;
              employeeMetrics.set(empGuid, current);
            }
          }

          const topEmployees = Array.from(employeeMetrics.entries())
            .map(([guid, data]) => ({
              guid,
              name: data.name,
              hoursWorked: Math.round(data.hours * 10) / 10,
              shifts: data.entries,
            }))
            .sort((a, b) => b.hoursWorked - a.hoursWorked)
            .slice(0, 10);

          res.end(JSON.stringify({
            totalLaborHours: Math.round(totalLaborHours * 10) / 10,
            totalLaborCost: Math.round(totalLaborCost * 100) / 100,
            laborPercent: Math.round(laborPercent * 10) / 10,
            revPerLaborHour: Math.round(revPerLaborHour * 100) / 100,
            totalSales,
            employeeCount: employeeMap.size,
            timeEntryCount: allTimeEntries.length,
            topEmployees,
            isLiveData: true,
          }));
        } catch (error) {
          console.error('Toast labor API error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({
            error: 'Failed to fetch labor data',
            details: error instanceof Error ? error.message : 'Unknown error',
            isLiveData: false,
          }));
        }
      });

      // Toast Daily Sales API (for MTD cumulative chart)
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/toast-daily-sales')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
          const url = new URL(req.url, 'http://localhost');
          const location = url.searchParams.get('location');

          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth();
          const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
          const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

          const token = await getAccessToken(env);
          const locations = location ? [location] : ['littleelm', 'prosper'];

          let allOrders: any[] = [];
          for (const loc of locations) {
            const restaurantGuid = RESTAURANTS[loc];
            if (!restaurantGuid) continue;
            const orders = await getAllOrders(restaurantGuid, startDate, endDate, token);
            allOrders.push(...orders);
          }

          // Bucket orders by day
          const dailyBuckets = new Map<number, number>();
          for (const order of allOrders) {
            if (order.voided) continue;
            const createdDate = order.createdDate || order.openedDate;
            if (!createdDate) continue;

            const orderDate = new Date(createdDate);
            const day = orderDate.getDate();

            let orderAmount = 0;
            if (order.checks) {
              for (const check of order.checks) {
                if (!check.voided && check.paymentStatus === 'CLOSED') {
                  let checkAmount = check.amount || 0;
                  if (check.payments) {
                    for (const payment of check.payments) {
                      if (payment.refund && payment.refund.refundAmount) {
                        checkAmount -= payment.refund.refundAmount;
                      }
                    }
                  }
                  orderAmount += checkAmount;
                }
              }
            }

            dailyBuckets.set(day, (dailyBuckets.get(day) || 0) + orderAmount);
          }

          // Build response array sorted by day
          const result = [];
          for (let day = 1; day <= now.getDate(); day++) {
            result.push({
              date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
              day,
              sales: Math.round((dailyBuckets.get(day) || 0) * 100) / 100,
            });
          }

          res.end(JSON.stringify(result));
        } catch (error) {
          console.error('Toast daily sales API error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({
            error: 'Failed to fetch daily sales',
            details: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      });

      // Toast Operations API
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/toast-operations')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
          const url = new URL(req.url, 'http://localhost');
          const startDate = url.searchParams.get('startDate');
          const endDate = url.searchParams.get('endDate');
          const location = url.searchParams.get('location');

          if (!startDate || !endDate) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'startDate and endDate required' }));
            return;
          }

          const token = await getAccessToken(env);
          const locations = location ? [location] : ['littleelm', 'prosper'];

          let allOrders: any[] = [];
          let totalRefunds = 0;
          let totalOrders = 0;

          for (const loc of locations) {
            const restaurantGuid = RESTAURANTS[loc];
            if (!restaurantGuid) continue;

            const orders = await getAllOrders(restaurantGuid, startDate, endDate, token);
            allOrders.push(...orders.map(o => ({ ...o, location: loc })));
          }

          const { avgTripTime, p90TripTime, tripTimes } = calculateTripTimes(allOrders);
          const hourlyData = calculateHourlyMetrics(allOrders);

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

          const startD = new Date(startDate);
          const endD = new Date(endDate);
          const daysDiff = Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const operatingHours = daysDiff * 13;

          const carsPerHour = operatingHours > 0 ? totalOrders / operatingHours : 0;

          res.end(JSON.stringify({
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
          }));
        } catch (error) {
          console.error('Toast operations API error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({
            error: 'Failed to fetch operational data',
            details: error instanceof Error ? error.message : 'Unknown error',
            isLiveData: false,
          }));
        }
      });

      // ==========================================
      // Meta Ads API
      // ==========================================

      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/meta-ads')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const metaToken = env.META_ACCESS_TOKEN;
        const metaAccountId = env.META_AD_ACCOUNT_ID || 'act_126144970';
        const metaApiVersion = 'v18.0';
        const metaBase = `https://graph.facebook.com/${metaApiVersion}`;

        if (!metaToken) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'META_ACCESS_TOKEN not configured' }));
          return;
        }

        try {
          const url = new URL(req.url, 'http://localhost');
          const period = url.searchParams.get('period') || '7d';

          // Calculate date range
          const endDate = new Date();
          const startDate = new Date();
          switch (period) {
            case '1d': startDate.setDate(startDate.getDate() - 1); break;
            case '7d': startDate.setDate(startDate.getDate() - 7); break;
            case '30d': startDate.setDate(startDate.getDate() - 30); break;
            case '90d': startDate.setDate(startDate.getDate() - 90); break;
            default: startDate.setDate(startDate.getDate() - 7);
          }

          const dateRange = {
            since: startDate.toISOString().split('T')[0],
            until: endDate.toISOString().split('T')[0],
          };

          // Fetch account-level insights
          const insightsParams = new URLSearchParams({
            access_token: metaToken,
            fields: 'spend,impressions,clicks,reach,cpc,cpm,ctr,actions',
            time_range: JSON.stringify(dateRange),
            level: 'account',
          });
          const insightsResp = await fetch(`${metaBase}/${metaAccountId}/insights?${insightsParams}`);
          const insightsData = await insightsResp.json();

          if (insightsData.error) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Meta API error', details: insightsData.error.message }));
            return;
          }

          // Fetch daily breakdown for chart
          const dailyParams = new URLSearchParams({
            access_token: metaToken,
            fields: 'spend,impressions,clicks',
            time_range: JSON.stringify(dateRange),
            time_increment: '1',
            level: 'account',
          });
          const dailyResp = await fetch(`${metaBase}/${metaAccountId}/insights?${dailyParams}`);
          const dailyRaw = await dailyResp.json();

          const dailyData = (dailyRaw.data || []).map((d: any) => ({
            date: d.date_start,
            spend: parseFloat(d.spend || '0'),
            impressions: parseInt(d.impressions || '0', 10),
            clicks: parseInt(d.clicks || '0', 10),
          }));

          // Fetch campaigns
          const campaignsParams = new URLSearchParams({
            access_token: metaToken,
            fields: 'id,name,status,objective,insights{spend,impressions,clicks,ctr,cpc}',
            time_range: JSON.stringify(dateRange),
            limit: '50',
          });
          const campaignsResp = await fetch(`${metaBase}/${metaAccountId}/campaigns?${campaignsParams}`);
          const campaignsData = await campaignsResp.json();

          // Process account insights
          const acct = insightsData.data?.[0] || {};
          const conversions = (acct.actions || []).reduce((sum: number, a: any) => {
            if (['purchase', 'lead', 'complete_registration', 'add_to_cart'].includes(a.action_type)) {
              return sum + parseInt(a.value, 10);
            }
            return sum;
          }, 0);

          const purchaseValue = (acct.actions || []).find((a: any) => a.action_type === 'purchase')?.value || 0;
          const spend = parseFloat(acct.spend || '0');
          const roas = spend > 0 ? parseFloat(String(purchaseValue)) / spend : 0;

          const result = {
            period,
            dateRange,
            summary: {
              spend,
              impressions: parseInt(acct.impressions || '0', 10),
              clicks: parseInt(acct.clicks || '0', 10),
              reach: parseInt(acct.reach || '0', 10),
              cpc: parseFloat(acct.cpc || '0'),
              cpm: parseFloat(acct.cpm || '0'),
              ctr: parseFloat(acct.ctr || '0'),
              conversions,
              roas: Math.round(roas * 100) / 100,
            },
            campaigns: (campaignsData.data || []).map((c: any) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              objective: c.objective,
              metrics: c.insights?.data?.[0] ? {
                spend: parseFloat(c.insights.data[0].spend || '0'),
                impressions: parseInt(c.insights.data[0].impressions || '0', 10),
                clicks: parseInt(c.insights.data[0].clicks || '0', 10),
                ctr: parseFloat(c.insights.data[0].ctr || '0'),
                cpc: parseFloat(c.insights.data[0].cpc || '0'),
              } : null,
            })),
            dailyData,
            fetchedAt: new Date().toISOString(),
          };

          res.end(JSON.stringify(result));
        } catch (error) {
          console.error('Meta Ads API error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({
            error: 'Failed to fetch Meta Ads data',
            details: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      });

      // ==========================================
      // OpenClaw + Bland AI APIs
      // ==========================================

      // OpenClaw Sessions — list all agent sessions
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/openclaw-sessions')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
          // Try CLI first
          const { stdout } = await execAsync('openclaw sessions --json', { timeout: 10000 });
          const sessions = JSON.parse(stdout);

          // Normalize to array format
          const result = Array.isArray(sessions)
            ? sessions
            : Object.entries(sessions).map(([key, val]: [string, any]) => ({
                sessionKey: key,
                ...(typeof val === 'object' ? val : {}),
              }));

          res.end(JSON.stringify(result));
        } catch (cliError) {
          // Fallback: read session files directly
          try {
            const agentsDir = path.join(process.env.HOME || '~', '.openclaw', 'agents');
            const sessions: any[] = [];

            if (fs.existsSync(agentsDir)) {
              const agents = fs.readdirSync(agentsDir);
              for (const agentId of agents) {
                const sessionsFile = path.join(agentsDir, agentId, 'sessions', 'sessions.json');
                if (fs.existsSync(sessionsFile)) {
                  const data = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
                  for (const [key, val] of Object.entries(data)) {
                    sessions.push({
                      sessionKey: key,
                      agentId,
                      ...(typeof val === 'object' && val !== null ? val : {}),
                    });
                  }
                }
              }
            }

            res.end(JSON.stringify(sessions));
          } catch (fsError) {
            console.error('OpenClaw sessions error:', cliError, fsError);
            res.end(JSON.stringify([]));
          }
        }
      });

      // OpenClaw Chat — send message to agent via HTTP API
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/openclaw-chat') || req.method !== 'POST') {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
          const body = await new Promise<any>((resolve) => {
            let data = '';
            req.on('data', (chunk: any) => (data += chunk));
            req.on('end', () => resolve(JSON.parse(data)));
          });

          const gatewayUrl = env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
          const gatewayToken = env.OPENCLAW_GATEWAY_TOKEN || '';

          const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(gatewayToken ? { 'Authorization': `Bearer ${gatewayToken}` } : {}),
              ...(body.agentId ? { 'x-openclaw-agent-id': body.agentId } : {}),
              ...(body.sessionKey ? { 'x-openclaw-session-key': body.sessionKey } : {}),
            },
            body: JSON.stringify({
              model: body.agentId ? `openclaw:${body.agentId}` : 'openclaw',
              messages: [{ role: 'user', content: body.message }],
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gateway returned ${response.status}: ${errText}`);
          }

          const result = await response.json();
          const content = result.choices?.[0]?.message?.content || '';
          res.end(JSON.stringify({ content, raw: result }));
        } catch (error) {
          console.error('OpenClaw chat error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({
            error: 'Chat failed',
            details: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      });

      // OpenClaw History — read JSONL transcript files
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/openclaw-history')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
          const url = new URL(req.url, 'http://localhost');
          const agentId = url.searchParams.get('agentId');
          const sessionId = url.searchParams.get('sessionId');
          const limit = parseInt(url.searchParams.get('limit') || '50');

          if (!agentId || !sessionId) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'agentId and sessionId required' }));
            return;
          }

          const sessionsDir = path.join(process.env.HOME || '~', '.openclaw', 'agents', agentId, 'sessions');
          const transcriptFile = path.join(sessionsDir, `${sessionId}.jsonl`);

          const messages: any[] = [];

          if (fs.existsSync(transcriptFile)) {
            const content = fs.readFileSync(transcriptFile, 'utf-8');
            const lines = content.trim().split('\n').filter(Boolean);

            // Parse JSONL lines — extract user/assistant messages
            for (const line of lines) {
              try {
                const entry = JSON.parse(line);
                if (entry.role === 'user' || entry.role === 'assistant') {
                  messages.push({
                    role: entry.role,
                    content: typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content),
                    timestamp: entry.timestamp || entry.created_at,
                  });
                }
              } catch {
                // Skip malformed lines
              }
            }
          }

          // Return last N messages
          res.end(JSON.stringify(messages.slice(-limit)));
        } catch (error) {
          console.error('OpenClaw history error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to read history' }));
        }
      });

      // Bland AI Calls — list or initiate calls
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/bland-calls')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const blandKey = env.BLAND_API_KEY;
        if (!blandKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'BLAND_API_KEY not configured' }));
          return;
        }

        try {
          if (req.method === 'POST') {
            // Initiate a call
            const body = await new Promise<any>((resolve) => {
              let data = '';
              req.on('data', (chunk: any) => (data += chunk));
              req.on('end', () => resolve(JSON.parse(data)));
            });

            const response = await fetch('https://api.bland.ai/v1/calls', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'authorization': blandKey,
              },
              body: JSON.stringify({
                phone_number: body.phone_number,
                task: body.task || 'You are a helpful assistant for Boundaries Coffee.',
              }),
            });

            const result = await response.json();
            res.end(JSON.stringify(result));
          } else {
            // List recent calls
            const response = await fetch('https://api.bland.ai/v1/calls', {
              headers: { 'authorization': blandKey },
            });

            const result = await response.json();
            res.end(JSON.stringify(result));
          }
        } catch (error) {
          console.error('Bland AI calls error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({
            error: 'Bland AI request failed',
            details: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      });

      // Bland AI Call Details
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/bland-call')) {
          return next();
        }
        // Skip if it matched bland-calls above
        if (req.url?.startsWith('/api/bland-calls')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const blandKey = env.BLAND_API_KEY;
        if (!blandKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'BLAND_API_KEY not configured' }));
          return;
        }

        try {
          const url = new URL(req.url, 'http://localhost');
          const callId = url.searchParams.get('id');

          if (!callId) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'id parameter required' }));
            return;
          }

          const response = await fetch(`https://api.bland.ai/v1/calls/${callId}`, {
            headers: { 'authorization': blandKey },
          });

          const result = await response.json();
          res.end(JSON.stringify(result));
        } catch (error) {
          console.error('Bland AI call details error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({
            error: 'Failed to fetch call details',
            details: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), apiPlugin(env)],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@api': path.resolve(__dirname, './src/api'),
        }
      }
    };
});
