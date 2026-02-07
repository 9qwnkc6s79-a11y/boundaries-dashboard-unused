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

  if (!response.ok) {
    console.error('Time entries fetch failed:', response.status);
    return [];
  }

  return response.json();
}

async function getShifts(
  restaurantGuid: string,
  startDate: string,
  endDate: string,
  token: string
): Promise<any[]> {
  const response = await fetch(
    `${TOAST_API}/labor/v1/shifts?startDate=${startDate}&endDate=${endDate}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Toast-Restaurant-External-ID': restaurantGuid,
      },
    }
  );

  if (!response.ok) {
    console.error('Shifts fetch failed:', response.status);
    return [];
  }

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

  if (!response.ok) {
    console.error('Employees fetch failed:', response.status);
    return [];
  }

  return response.json();
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

    let totalLaborHours = 0;
    let totalLaborCost = 0;
    let allTimeEntries: any[] = [];
    let allEmployees: any[] = [];
    const employeeMap = new Map<string, any>();

    for (const loc of locations) {
      const restaurantGuid = RESTAURANTS[loc];
      if (!restaurantGuid) continue;

      const [timeEntries, employees] = await Promise.all([
        getTimeEntries(restaurantGuid, String(startDate), String(endDate), token),
        getEmployees(restaurantGuid, token),
      ]);

      // Map employees by GUID
      for (const emp of employees) {
        if (emp.guid) {
          employeeMap.set(emp.guid, { ...emp, location: loc });
        }
      }

      // Process time entries
      for (const entry of timeEntries) {
        if (entry.deleted) continue;

        const inTime = entry.inDate ? new Date(entry.inDate).getTime() : 0;
        const outTime = entry.outDate ? new Date(entry.outDate).getTime() : Date.now();
        
        if (inTime && outTime > inTime) {
          const hours = (outTime - inTime) / (1000 * 60 * 60);
          totalLaborHours += hours;
          
          // Estimate labor cost (use hourly wage if available, else estimate)
          const hourlyWage = entry.hourlyWage || entry.regularHourlyWage || 15;
          totalLaborCost += hours * hourlyWage;

          allTimeEntries.push({
            ...entry,
            location: loc,
            calculatedHours: hours,
          });
        }
      }

      allEmployees.push(...employees.map((e: any) => ({ ...e, location: loc })));
    }

    // Calculate metrics
    // We need sales data to calculate labor percentage - fetch from sales endpoint
    let totalSales = 0;
    try {
      const salesResponse = await fetch(
        `${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/toast-direct?startDate=${startDate}&endDate=${endDate}${location ? `&location=${location}` : ''}`
      );
      if (salesResponse.ok) {
        const salesData = await salesResponse.json();
        totalSales = salesData.netSales || 0;
      }
    } catch {
      // If we can't get sales, we'll return labor data without percentage
    }

    const laborPercent = totalSales > 0 ? (totalLaborCost / totalSales) * 100 : 0;
    const revPerLaborHour = totalLaborHours > 0 ? totalSales / totalLaborHours : 0;

    // Group by employee for shift lead data
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

    // Top employees by hours worked
    const topEmployees = Array.from(employeeMetrics.entries())
      .map(([guid, data]) => ({
        guid,
        name: data.name,
        hoursWorked: Math.round(data.hours * 10) / 10,
        shifts: data.entries,
      }))
      .sort((a, b) => b.hoursWorked - a.hoursWorked)
      .slice(0, 10);

    return res.status(200).json({
      totalLaborHours: Math.round(totalLaborHours * 10) / 10,
      totalLaborCost: Math.round(totalLaborCost * 100) / 100,
      laborPercent: Math.round(laborPercent * 10) / 10,
      revPerLaborHour: Math.round(revPerLaborHour * 100) / 100,
      totalSales,
      employeeCount: allEmployees.length,
      timeEntryCount: allTimeEntries.length,
      topEmployees,
      isLiveData: true,
    });
  } catch (error) {
    console.error('Toast labor API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch labor data',
      details: error instanceof Error ? error.message : 'Unknown error',
      isLiveData: false,
    });
  }
}
