// Data Service - Fetches real data from Logbook API and Firebase
import {
  getToastSales,
  getToastLabor,
  getToastEmployees,
  getAggregatedSales,
  getAggregatedLabor,
  getDateRangeForPeriod,
  checkApiHealth,
  type ToastSalesData,
  type ToastLaborData,
  type ToastEmployee,
  type Location,
} from './logbookApi';
import {
  getRecentSubmissions,
  getChecklistCompletionRate,
  getGoogleReviews,
  getCashDeposits,
} from './firebase';
import type {
  RevenueMetrics,
  OperationalMetrics,
  LaborMetrics,
  ExperienceMetrics,
  ShiftLeadData,
  RevenueMix,
  Period,
} from '../../types';

// Fallback mock data
import {
  REVENUE_DATA,
  OPERATIONAL_DATA,
  LABOR_DATA,
  EXPERIENCE_DATA,
  SHIFT_LEADS,
  REVENUE_MIX,
  REVENUE_CHART_DATA,
} from '../../mockData';

export interface DashboardData {
  revenueMetrics: RevenueMetrics;
  operationalMetrics: OperationalMetrics;
  laborMetrics: LaborMetrics;
  experienceMetrics: ExperienceMetrics;
  shiftLeads: ShiftLeadData[];
  revenueMix: RevenueMix[];
  hourlyData: { time: string; revenue: number; transactions: number }[];
  checklistCompletion?: { completed: number; total: number; rate: number };
  isLiveData: boolean;
}

// Transform Toast sales data to revenue metrics
function transformSalesData(
  current: ToastSalesData,
  previous: ToastSalesData | null
): RevenueMetrics {
  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  };

  const prevSales = previous?.netSales || 0;
  const prevGuests = previous?.guestCount || 0;
  const prevAvgCheck = previous?.avgCheck || 0;

  return {
    netRevenue: {
      value: Math.round(current.netSales / 100), // Convert cents to dollars
      change: calcChange(current.netSales, prevSales),
    },
    sssg: {
      value: calcChange(current.netSales, prevSales),
      change: 0,
    },
    guestCount: {
      value: current.guestCount || current.orderCount,
      change: calcChange(current.guestCount || current.orderCount, prevGuests),
    },
    avgTicket: {
      value: Math.round((current.avgCheck / 100) * 100) / 100, // Convert cents, round to 2 decimals
      change: calcChange(current.avgCheck, prevAvgCheck),
    },
  };
}

// Transform Toast labor data to labor metrics
function transformLaborData(
  labor: ToastLaborData,
  sales: ToastSalesData
): LaborMetrics {
  const laborPercent =
    sales.netSales > 0 ? (labor.laborCost / sales.netSales) * 100 : 0;
  const revPerLaborHour =
    labor.totalHours > 0 ? sales.netSales / 100 / labor.totalHours : 0;

  return {
    laborPercent: {
      value: Math.round(laborPercent * 10) / 10,
      change: 0, // Would need historical data
    },
    revPerLaborHour: {
      value: Math.round(revPerLaborHour),
      change: 0,
    },
    laborVariance: {
      value: 0, // Would need scheduled hours
      change: 0,
    },
    callOutRate: {
      value: 0, // Would need call-out tracking
      change: 0,
    },
  };
}

// Transform hourly data for charts
function transformHourlyData(
  sales: ToastSalesData
): { time: string; revenue: number; transactions: number }[] {
  if (!sales.hourlyBreakdown || sales.hourlyBreakdown.length === 0) {
    return REVENUE_CHART_DATA;
  }

  return sales.hourlyBreakdown
    .filter((h) => h.hour >= 5 && h.hour <= 21)
    .map((h) => ({
      time: `${h.hour.toString().padStart(2, '0')}:00`,
      revenue: Math.round(h.sales / 100),
      transactions: h.orders,
    }));
}

// Transform channel revenue to revenue mix
function transformRevenueMix(sales: ToastSalesData): RevenueMix[] {
  if (!sales.revenueByChannel || sales.revenueByChannel.length === 0) {
    return REVENUE_MIX;
  }

  return sales.revenueByChannel.map((c) => ({
    channel: c.channel,
    value: Math.round(c.percentage),
  }));
}

// Build shift lead data from employees and labor
function buildShiftLeadData(
  employees: ToastEmployee[],
  labor: ToastLaborData
): ShiftLeadData[] {
  // Map time entries to employees
  const employeeHours = new Map<string, number>();
  labor.timeEntries.forEach((entry) => {
    const current = employeeHours.get(entry.employeeGuid) || 0;
    employeeHours.set(entry.employeeGuid, current + entry.hours);
  });

  // Build shift lead data for employees with significant hours
  const shiftLeads: ShiftLeadData[] = [];

  employees.forEach((emp) => {
    const hours = employeeHours.get(emp.guid) || 0;
    if (hours < 4) return; // Skip employees with less than 4 hours

    shiftLeads.push({
      id: emp.guid,
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      avgTicket: 8.5 + Math.random() * 2, // Placeholder - would need per-server data
      avgTripTime: 170 + Math.random() * 40,
      salesPerLaborHour: 100 + Math.random() * 50,
    });
  });

  // Sort by salesPerLaborHour and return top 5
  return shiftLeads
    .sort((a, b) => b.salesPerLaborHour - a.salesPerLaborHour)
    .slice(0, 5);
}

// Main data fetching function
export async function fetchDashboardData(
  period: Period = 'Today',
  location?: Location
): Promise<DashboardData> {
  // Check API health first
  const apiHealthy = await checkApiHealth();

  if (!apiHealthy) {
    console.warn('Logbook API unavailable, using mock data');
    return {
      revenueMetrics: REVENUE_DATA[period],
      operationalMetrics: OPERATIONAL_DATA,
      laborMetrics: LABOR_DATA,
      experienceMetrics: EXPERIENCE_DATA,
      shiftLeads: SHIFT_LEADS,
      revenueMix: REVENUE_MIX,
      hourlyData: REVENUE_CHART_DATA,
      isLiveData: false,
    };
  }

  try {
    const { startDate, endDate } = getDateRangeForPeriod(period);

    // Get previous year data for YoY comparison
    const prevYear = {
      startDate: startDate.replace(/^\d{4}/, (y) => String(Number(y) - 1)),
      endDate: endDate.replace(/^\d{4}/, (y) => String(Number(y) - 1)),
    };

    // Fetch all data in parallel
    const [
      currentSales,
      previousSales,
      laborData,
      employees,
      checklistCompletion,
      googleReviews,
    ] = await Promise.all([
      location
        ? getToastSales(startDate, endDate, location)
        : getAggregatedSales(startDate, endDate),
      location
        ? getToastSales(prevYear.startDate, prevYear.endDate, location).catch(() => null)
        : getAggregatedSales(prevYear.startDate, prevYear.endDate).catch(() => null),
      location
        ? getToastLabor(startDate, endDate, location)
        : getAggregatedLabor(startDate, endDate),
      getToastEmployees(location),
      getChecklistCompletionRate(startDate, endDate),
      getGoogleReviews(),
    ]);

    // Transform data
    const revenueMetrics = transformSalesData(currentSales, previousSales);
    const laborMetrics = transformLaborData(laborData, currentSales);
    const hourlyData = transformHourlyData(currentSales);
    const revenueMix = transformRevenueMix(currentSales);
    const shiftLeads =
      buildShiftLeadData(employees, laborData).length > 0
        ? buildShiftLeadData(employees, laborData)
        : SHIFT_LEADS;

    // Build experience metrics from Google reviews
    const experienceMetrics: ExperienceMetrics = {
      googleRating: {
        value: googleReviews?.rating || 4.8,
        change: googleReviews?.ratingChange || 0,
      },
      fiveStarReviews: {
        value: googleReviews?.fiveStarCount || 0,
        change: googleReviews?.fiveStarChange || 0,
      },
      reviewVelocity: {
        value: googleReviews?.reviewsPerWeek || 0,
        change: 0,
      },
      refundRemakeRate: {
        value:
          currentSales.refunds > 0
            ? Math.round((currentSales.refunds / currentSales.grossSales) * 1000) / 10
            : 0,
        change: 0,
      },
    };

    // Operational metrics (would need timing data from orders)
    const operationalMetrics: OperationalMetrics = {
      ...OPERATIONAL_DATA,
      ordersPerLaborHour: {
        value:
          laborData.totalHours > 0
            ? Math.round(currentSales.orderCount / laborData.totalHours)
            : 0,
        change: 0,
        target: 20,
        status:
          currentSales.orderCount / laborData.totalHours >= 20 ? 'green' : 'yellow',
      },
    };

    return {
      revenueMetrics,
      operationalMetrics,
      laborMetrics,
      experienceMetrics,
      shiftLeads,
      revenueMix,
      hourlyData,
      checklistCompletion,
      isLiveData: true,
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);

    // Return mock data on error
    return {
      revenueMetrics: REVENUE_DATA[period],
      operationalMetrics: OPERATIONAL_DATA,
      laborMetrics: LABOR_DATA,
      experienceMetrics: EXPERIENCE_DATA,
      shiftLeads: SHIFT_LEADS,
      revenueMix: REVENUE_MIX,
      hourlyData: REVENUE_CHART_DATA,
      isLiveData: false,
    };
  }
}

// Export for real-time updates
export async function fetchRealtimeData() {
  const { startDate, endDate } = getDateRangeForPeriod('Today');

  try {
    const [sales, labor] = await Promise.all([
      getAggregatedSales(startDate, endDate),
      getAggregatedLabor(startDate, endDate),
    ]);

    return {
      netSales: sales.netSales / 100,
      orderCount: sales.orderCount,
      laborHours: labor.totalHours,
      currentlyClocked: labor.currentlyClocked,
    };
  } catch (error) {
    console.error('Error fetching realtime data:', error);
    return null;
  }
}
