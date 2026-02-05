// API client for Boundaries Logbook backend (Vercel serverless functions)
// These endpoints proxy Toast POS API calls

// Use local API proxy to avoid CORS issues
const LOGBOOK_API_BASE = '/api';

// Store location mapping
export const STORE_LOCATIONS = {
  'store-elm': 'littleelm',
  'store-prosper': 'prosper',
} as const;

export type StoreId = keyof typeof STORE_LOCATIONS;
export type Location = (typeof STORE_LOCATIONS)[StoreId];

// Toast Sales Data from Logbook API
export interface ToastSalesData {
  netSales: number;
  grossSales: number;
  orderCount: number;
  guestCount: number;
  avgCheck: number;
  tips: number;
  discounts: number;
  refunds: number;
  voids: number;
  hourlyBreakdown?: HourlySales[];
  revenueByChannel?: ChannelRevenue[];
}

export interface HourlySales {
  hour: number;
  sales: number;
  orders: number;
}

export interface ChannelRevenue {
  channel: string;
  amount: number;
  percentage: number;
}

// Toast Labor Data
export interface ToastLaborData {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  laborCost: number;
  laborPercent: number;
  employeeCount: number;
  currentlyClocked: ClockedEmployee[];
  timeEntries: TimeEntry[];
}

export interface ClockedEmployee {
  guid: string;
  name: string;
  jobTitle: string;
  clockedInAt: string;
  hours: number;
}

export interface TimeEntry {
  employeeGuid: string;
  employeeName: string;
  jobTitle: string;
  inDate: string;
  outDate?: string;
  hours: number;
  wage?: number;
}

// Toast Employee Data
export interface ToastEmployee {
  guid: string;
  firstName: string;
  lastName: string;
  email?: string;
  jobTitle?: string;
  location?: string;
}

// Toast Cash Data
export interface ToastCashData {
  entries: CashEntry[];
  totalDrops: number;
  totalPayouts: number;
  netCash: number;
}

export interface CashEntry {
  guid: string;
  date: string;
  type: 'DROP' | 'PAYOUT' | 'ADJUSTMENT';
  amount: number;
  reason?: string;
}

// API Helper
async function fetchLogbookApi<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${LOGBOOK_API_BASE}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Logbook API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Format date for API calls (YYYY-MM-DD)
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get date range for period
export function getDateRangeForPeriod(period: 'Today' | 'WTD' | 'MTD'): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const endDate = formatDate(now);

  let startDate: string;
  switch (period) {
    case 'Today':
      startDate = endDate;
      break;
    case 'WTD':
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - dayOfWeek);
      startDate = formatDate(weekStart);
      break;
    case 'MTD':
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      break;
  }

  return { startDate, endDate };
}

// API Endpoints

export async function getToastSales(
  startDate: string,
  endDate: string,
  location?: Location
): Promise<ToastSalesData> {
  const params: Record<string, string> = { startDate, endDate };
  if (location) params.location = location;

  return fetchLogbookApi<ToastSalesData>('/toast-sales', params);
}

export async function getToastLabor(
  startDate: string,
  endDate: string,
  location?: Location
): Promise<ToastLaborData> {
  const params: Record<string, string> = { startDate, endDate };
  if (location) params.location = location;

  return fetchLogbookApi<ToastLaborData>('/toast-labor', params);
}

export async function getToastEmployees(location?: Location): Promise<ToastEmployee[]> {
  const params: Record<string, string> = {};
  if (location) params.location = location;

  return fetchLogbookApi<ToastEmployee[]>('/toast-employees', params);
}

export async function getToastCash(
  startDate: string,
  endDate: string,
  location?: Location
): Promise<ToastCashData> {
  const params: Record<string, string> = { startDate, endDate };
  if (location) params.location = location;

  return fetchLogbookApi<ToastCashData>('/toast-cash', params);
}

export async function getToastLaborLive(): Promise<ClockedEmployee[]> {
  const data = await fetchLogbookApi<{ currentlyClocked: ClockedEmployee[] }>(
    '/toast-labor-live'
  );
  return data.currentlyClocked || [];
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${LOGBOOK_API_BASE}/toast-health`);
    return response.ok;
  } catch {
    return false;
  }
}

// Aggregate data for both locations
export async function getAggregatedSales(
  startDate: string,
  endDate: string
): Promise<ToastSalesData> {
  const [elmData, prosperData] = await Promise.all([
    getToastSales(startDate, endDate, 'littleelm').catch(() => null),
    getToastSales(startDate, endDate, 'prosper').catch(() => null),
  ]);

  // Combine data from both locations
  const combined: ToastSalesData = {
    netSales: (elmData?.netSales || 0) + (prosperData?.netSales || 0),
    grossSales: (elmData?.grossSales || 0) + (prosperData?.grossSales || 0),
    orderCount: (elmData?.orderCount || 0) + (prosperData?.orderCount || 0),
    guestCount: (elmData?.guestCount || 0) + (prosperData?.guestCount || 0),
    avgCheck: 0,
    tips: (elmData?.tips || 0) + (prosperData?.tips || 0),
    discounts: (elmData?.discounts || 0) + (prosperData?.discounts || 0),
    refunds: (elmData?.refunds || 0) + (prosperData?.refunds || 0),
    voids: (elmData?.voids || 0) + (prosperData?.voids || 0),
  };

  // Calculate combined average check
  if (combined.orderCount > 0) {
    combined.avgCheck = combined.netSales / combined.orderCount;
  }

  return combined;
}

export async function getAggregatedLabor(
  startDate: string,
  endDate: string
): Promise<ToastLaborData> {
  const [elmData, prosperData] = await Promise.all([
    getToastLabor(startDate, endDate, 'littleelm').catch(() => null),
    getToastLabor(startDate, endDate, 'prosper').catch(() => null),
  ]);

  const combined: ToastLaborData = {
    totalHours: (elmData?.totalHours || 0) + (prosperData?.totalHours || 0),
    regularHours: (elmData?.regularHours || 0) + (prosperData?.regularHours || 0),
    overtimeHours: (elmData?.overtimeHours || 0) + (prosperData?.overtimeHours || 0),
    laborCost: (elmData?.laborCost || 0) + (prosperData?.laborCost || 0),
    laborPercent: 0,
    employeeCount: (elmData?.employeeCount || 0) + (prosperData?.employeeCount || 0),
    currentlyClocked: [
      ...(elmData?.currentlyClocked || []),
      ...(prosperData?.currentlyClocked || []),
    ],
    timeEntries: [...(elmData?.timeEntries || []), ...(prosperData?.timeEntries || [])],
  };

  return combined;
}
