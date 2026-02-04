// Toast POS API Client
// Documentation: https://doc.toasttab.com/doc/devguide/apiOverview.html

const TOAST_API_BASE = 'https://ws-api.toasttab.com';

interface ToastAuthResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

interface ToastCredentials {
  clientId: string;
  clientSecret: string;
  userAccessType: 'TOAST_MACHINE_CLIENT';
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getToastToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    return cachedToken.token;
  }

  const credentials: ToastCredentials = {
    clientId: import.meta.env.VITE_TOAST_CLIENT_ID,
    clientSecret: import.meta.env.VITE_TOAST_CLIENT_SECRET,
    userAccessType: 'TOAST_MACHINE_CLIENT',
  };

  const response = await fetch(`${TOAST_API_BASE}/authentication/v1/authentication/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error(`Toast auth failed: ${response.status} ${response.statusText}`);
  }

  const data: ToastAuthResponse = await response.json();

  cachedToken = {
    token: data.accessToken,
    expiresAt: Date.now() + (data.expiresIn * 1000),
  };

  return data.accessToken;
}

async function toastFetch<T>(endpoint: string, restaurantGuid?: string): Promise<T> {
  const token = await getToastToken();
  const guid = restaurantGuid || import.meta.env.VITE_TOAST_RESTAURANT_GUID;

  const response = await fetch(`${TOAST_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Toast-Restaurant-External-ID': guid,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Toast API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Orders API
export interface ToastOrder {
  guid: string;
  entityType: string;
  externalId?: string;
  openedDate: string;
  modifiedDate: string;
  closedDate?: string;
  checks: ToastCheck[];
  totalAmount: number;
  server?: { guid: string; firstName: string; lastName: string };
  revenueCenter?: { guid: string; name: string };
  diningOption?: { guid: string; name: string };
}

export interface ToastCheck {
  guid: string;
  amount: number;
  totalAmount: number;
  selections: ToastSelection[];
  payments: ToastPayment[];
}

export interface ToastSelection {
  guid: string;
  itemName: string;
  quantity: number;
  price: number;
}

export interface ToastPayment {
  guid: string;
  type: string;
  amount: number;
  tipAmount: number;
}

export async function getOrders(
  startDate: string,
  endDate: string,
  restaurantGuid?: string
): Promise<ToastOrder[]> {
  const params = new URLSearchParams({
    startDate,
    endDate,
  });
  return toastFetch<ToastOrder[]>(`/orders/v2/orders?${params}`, restaurantGuid);
}

// Labor API
export interface ToastEmployee {
  guid: string;
  firstName: string;
  lastName: string;
  email?: string;
  jobReferences?: { guid: string; name: string }[];
}

export interface ToastTimeEntry {
  guid: string;
  employeeReference: { guid: string };
  jobReference?: { guid: string };
  inDate: string;
  outDate?: string;
  regularHours?: number;
  overtimeHours?: number;
  hourlyWage?: number;
}

export interface ToastShift {
  guid: string;
  employeeReference: { guid: string };
  jobReference?: { guid: string };
  inDate: string;
  outDate: string;
}

export async function getEmployees(restaurantGuid?: string): Promise<ToastEmployee[]> {
  return toastFetch<ToastEmployee[]>('/labor/v1/employees', restaurantGuid);
}

export async function getTimeEntries(
  startDate: string,
  endDate: string,
  restaurantGuid?: string
): Promise<ToastTimeEntry[]> {
  const params = new URLSearchParams({
    startDate,
    endDate,
  });
  return toastFetch<ToastTimeEntry[]>(`/labor/v1/timeEntries?${params}`, restaurantGuid);
}

export async function getShifts(
  startDate: string,
  endDate: string,
  restaurantGuid?: string
): Promise<ToastShift[]> {
  const params = new URLSearchParams({
    startDate,
    endDate,
  });
  return toastFetch<ToastShift[]>(`/labor/v1/shifts?${params}`, restaurantGuid);
}

// Restaurant Info
export interface ToastRestaurant {
  guid: string;
  name: string;
  location: {
    address1: string;
    city: string;
    state: string;
    zipCode: string;
  };
  generalInfo?: {
    timeZone: string;
  };
}

export async function getRestaurantInfo(restaurantGuid?: string): Promise<ToastRestaurant> {
  return toastFetch<ToastRestaurant>('/restaurants/v1/restaurants', restaurantGuid);
}

// Cash Management
export interface ToastCashEntry {
  guid: string;
  date: string;
  type: string;
  amount: number;
}

export async function getCashEntries(
  startDate: string,
  endDate: string,
  restaurantGuid?: string
): Promise<ToastCashEntry[]> {
  const params = new URLSearchParams({
    startDate,
    endDate,
  });
  return toastFetch<ToastCashEntry[]>(`/cashmgmt/v1/entries?${params}`, restaurantGuid);
}
