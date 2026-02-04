// Data Service - Transforms Toast API data to dashboard format
import {
  getOrders,
  getTimeEntries,
  getEmployees,
  ToastOrder,
  ToastTimeEntry,
  ToastEmployee,
} from './toast';
import {
  RevenueMetrics,
  OperationalMetrics,
  LaborMetrics,
  ShiftLeadData,
  RevenueMix,
} from '../../types';

// Date helpers
function getDateRange(period: 'Today' | 'WTD' | 'MTD'): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];

  let start: Date;
  switch (period) {
    case 'Today':
      start = new Date(now);
      break;
    case 'WTD':
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      break;
    case 'MTD':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  return {
    start: start.toISOString().split('T')[0],
    end,
  };
}

function getPreviousYearRange(period: 'Today' | 'WTD' | 'MTD'): { start: string; end: string } {
  const { start, end } = getDateRange(period);
  const startDate = new Date(start);
  const endDate = new Date(end);

  startDate.setFullYear(startDate.getFullYear() - 1);
  endDate.setFullYear(endDate.getFullYear() - 1);

  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  };
}

// Calculate revenue metrics from orders
function calculateRevenueFromOrders(orders: ToastOrder[]): {
  netRevenue: number;
  guestCount: number;
  avgTicket: number;
} {
  const netRevenue = orders.reduce((sum, order) => {
    const orderTotal = order.checks?.reduce((checkSum, check) => checkSum + (check.totalAmount || 0), 0) || order.totalAmount || 0;
    return sum + orderTotal;
  }, 0);

  const guestCount = orders.length;
  const avgTicket = guestCount > 0 ? netRevenue / guestCount : 0;

  return { netRevenue: netRevenue / 100, guestCount, avgTicket: avgTicket / 100 }; // Convert cents to dollars
}

// Calculate YoY change
function calculateYoYChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// Revenue mix by dining option
function calculateRevenueMix(orders: ToastOrder[]): RevenueMix[] {
  const mixMap: Record<string, number> = {
    'Drive-thru': 0,
    'Mobile/App': 0,
    'Third-Party': 0,
  };

  let total = 0;
  orders.forEach((order) => {
    const orderTotal = order.totalAmount || 0;
    total += orderTotal;

    const diningOption = order.diningOption?.name?.toLowerCase() || '';
    if (diningOption.includes('drive') || diningOption.includes('thru')) {
      mixMap['Drive-thru'] += orderTotal;
    } else if (diningOption.includes('mobile') || diningOption.includes('app') || diningOption.includes('online')) {
      mixMap['Mobile/App'] += orderTotal;
    } else if (diningOption.includes('doordash') || diningOption.includes('uber') || diningOption.includes('grubhub') || diningOption.includes('third')) {
      mixMap['Third-Party'] += orderTotal;
    } else {
      mixMap['Drive-thru'] += orderTotal; // Default to drive-thru for coffee shop
    }
  });

  if (total === 0) {
    return [
      { channel: 'Drive-thru', value: 65 },
      { channel: 'Mobile/App', value: 25 },
      { channel: 'Third-Party', value: 10 },
    ];
  }

  return Object.entries(mixMap).map(([channel, value]) => ({
    channel,
    value: Math.round((value / total) * 100),
  }));
}

// Hourly revenue chart data
function calculateHourlyRevenue(orders: ToastOrder[]): { time: string; revenue: number; transactions: number }[] {
  const hourlyData: Record<string, { revenue: number; transactions: number }> = {};

  // Initialize hours from 5am to 9pm
  for (let h = 5; h <= 21; h++) {
    const timeStr = `${h.toString().padStart(2, '0')}:00`;
    hourlyData[timeStr] = { revenue: 0, transactions: 0 };
  }

  orders.forEach((order) => {
    const date = new Date(order.openedDate);
    const hour = date.getHours();
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;

    if (hourlyData[timeStr]) {
      hourlyData[timeStr].revenue += (order.totalAmount || 0) / 100;
      hourlyData[timeStr].transactions += 1;
    }
  });

  return Object.entries(hourlyData)
    .map(([time, data]) => ({
      time,
      revenue: Math.round(data.revenue),
      transactions: data.transactions,
    }))
    .filter((d) => d.transactions > 0 || parseInt(d.time) >= 6 && parseInt(d.time) <= 18);
}

// Labor metrics calculation
function calculateLaborMetrics(
  timeEntries: ToastTimeEntry[],
  totalRevenue: number
): Partial<LaborMetrics> {
  const totalHours = timeEntries.reduce((sum, entry) => {
    return sum + (entry.regularHours || 0) + (entry.overtimeHours || 0);
  }, 0);

  const totalLaborCost = timeEntries.reduce((sum, entry) => {
    const hours = (entry.regularHours || 0) + (entry.overtimeHours || 0);
    const wage = entry.hourlyWage || 15; // Default $15/hr if not specified
    return sum + hours * wage;
  }, 0);

  const laborPercent = totalRevenue > 0 ? (totalLaborCost / totalRevenue) * 100 : 0;
  const revPerLaborHour = totalHours > 0 ? totalRevenue / totalHours : 0;

  return {
    laborPercent: { value: Math.round(laborPercent * 10) / 10, change: 0 },
    revPerLaborHour: { value: Math.round(revPerLaborHour), change: 0 },
    laborVariance: { value: 0, change: 0 }, // Would need scheduled vs actual comparison
    callOutRate: { value: 0, change: 0 }, // Would need call-out tracking
  };
}

// Shift lead performance
function calculateShiftLeadPerformance(
  orders: ToastOrder[],
  employees: ToastEmployee[],
  timeEntries: ToastTimeEntry[]
): ShiftLeadData[] {
  const employeeMap = new Map(employees.map((e) => [e.guid, e]));
  const employeeOrders: Record<string, ToastOrder[]> = {};
  const employeeHours: Record<string, number> = {};

  // Group orders by server
  orders.forEach((order) => {
    if (order.server?.guid) {
      if (!employeeOrders[order.server.guid]) {
        employeeOrders[order.server.guid] = [];
      }
      employeeOrders[order.server.guid].push(order);
    }
  });

  // Calculate hours per employee
  timeEntries.forEach((entry) => {
    const guid = entry.employeeReference.guid;
    const hours = (entry.regularHours || 0) + (entry.overtimeHours || 0);
    employeeHours[guid] = (employeeHours[guid] || 0) + hours;
  });

  // Build shift lead data
  const shiftLeads: ShiftLeadData[] = [];

  Object.entries(employeeOrders).forEach(([guid, orders]) => {
    const employee = employeeMap.get(guid);
    if (!employee || orders.length < 10) return; // Only include employees with significant orders

    const metrics = calculateRevenueFromOrders(orders);
    const hours = employeeHours[guid] || 1;

    shiftLeads.push({
      id: guid,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      avgTicket: Math.round(metrics.avgTicket * 100) / 100,
      avgTripTime: 180, // Would need timing data from order opened to closed
      salesPerLaborHour: Math.round(metrics.netRevenue / hours),
    });
  });

  // Sort by sales per labor hour and return top performers
  return shiftLeads
    .sort((a, b) => b.salesPerLaborHour - a.salesPerLaborHour)
    .slice(0, 5);
}

// Main data fetching function
export async function fetchDashboardData(period: 'Today' | 'WTD' | 'MTD' = 'Today') {
  const { start, end } = getDateRange(period);
  const prevYear = getPreviousYearRange(period);

  try {
    // Fetch current period data
    const [orders, prevOrders, timeEntries, employees] = await Promise.all([
      getOrders(start, end),
      getOrders(prevYear.start, prevYear.end),
      getTimeEntries(start, end),
      getEmployees(),
    ]);

    // Calculate current metrics
    const currentMetrics = calculateRevenueFromOrders(orders);
    const prevMetrics = calculateRevenueFromOrders(prevOrders);

    // Build revenue metrics
    const revenueMetrics: RevenueMetrics = {
      netRevenue: {
        value: Math.round(currentMetrics.netRevenue),
        change: Math.round(calculateYoYChange(currentMetrics.netRevenue, prevMetrics.netRevenue) * 10) / 10,
      },
      sssg: {
        value: Math.round(calculateYoYChange(currentMetrics.netRevenue, prevMetrics.netRevenue) * 10) / 10,
        change: 0,
      },
      guestCount: {
        value: currentMetrics.guestCount,
        change: Math.round(calculateYoYChange(currentMetrics.guestCount, prevMetrics.guestCount) * 10) / 10,
      },
      avgTicket: {
        value: Math.round(currentMetrics.avgTicket * 100) / 100,
        change: Math.round(calculateYoYChange(currentMetrics.avgTicket, prevMetrics.avgTicket) * 10) / 10,
      },
    };

    // Calculate other metrics
    const laborMetrics = calculateLaborMetrics(timeEntries, currentMetrics.netRevenue);
    const revenueMix = calculateRevenueMix(orders);
    const hourlyData = calculateHourlyRevenue(orders);
    const shiftLeads = calculateShiftLeadPerformance(orders, employees, timeEntries);

    return {
      revenueMetrics,
      laborMetrics,
      revenueMix,
      hourlyData,
      shiftLeads,
      rawOrders: orders,
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw error;
  }
}

// Export for real-time updates
export async function fetchRealtimeOrders() {
  const today = new Date().toISOString().split('T')[0];
  return getOrders(today, today);
}
