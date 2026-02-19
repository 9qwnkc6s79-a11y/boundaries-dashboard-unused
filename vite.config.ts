import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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

          // Calculate SSSG
          let sssgCurrentTotal = 0;
          let sssgLastYearTotal = 0;

          for (const loc of SSSG_ELIGIBLE_STORES) {
            const restaurantGuid = RESTAURANTS[loc];
            if (!restaurantGuid) continue;

            const currentForStore = currentResults.find(r => r.location === loc);
            if (currentForStore) {
              sssgCurrentTotal += currentForStore.netSales;
            }

            try {
              const lastYearData = await getOrdersSummary(
                restaurantGuid,
                lastYear.startDate,
                lastYear.endDate,
                token
              );
              sssgLastYearTotal += lastYearData.netSales;
            } catch {
              // No last year data
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
