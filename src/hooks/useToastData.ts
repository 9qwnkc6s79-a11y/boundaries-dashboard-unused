// Simplified hook for fetching Toast sales data
import { useState, useEffect, useCallback } from 'react';
import type { Period } from '../../types';
import { REVENUE_DATA, OPERATIONAL_DATA, LABOR_DATA, EXPERIENCE_DATA, SHIFT_LEADS, REVENUE_MIX, REVENUE_CHART_DATA } from '../../mockData';

export type Location = 'littleelm' | 'prosper' | undefined;

function getDateRangeForPeriod(period: Period): { startDate: string; endDate: string } {
  // Use local date, not UTC
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const endDate = `${year}-${month}-${day}`;

  let startDate: string;
  switch (period) {
    case 'Today':
      startDate = endDate;
      break;
    case 'WTD':
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - dayOfWeek);
      startDate = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
      break;
    case 'MTD':
      startDate = `${year}-${month}-01`;
      break;
    default:
      startDate = endDate;
  }
  return { startDate, endDate };
}

async function fetchSalesForDay(date: string, location: Location) {
  const params = new URLSearchParams({ startDate: date, endDate: date });
  params.append('location', location);

  const response = await fetch(`/api/toast-sales?${params}`);
  if (!response.ok) throw new Error('Failed to fetch sales');
  return response.json();
}

function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

async function fetchSalesForRange(startDate: string, endDate: string, location: Location) {
  const dates = getDatesBetween(startDate, endDate);
  const dailyResults = await Promise.all(dates.map(date => fetchSalesForDay(date, location)));

  // Sum up all days
  let netSales = 0;
  let totalOrders = 0;

  for (const day of dailyResults) {
    netSales += day.netSales || 0;
    totalOrders += day.totalOrders || 0;
  }

  return {
    netSales,
    totalOrders,
    averageCheck: totalOrders > 0 ? netSales / totalOrders : 0,
  };
}

export function useToastData(period: Period = 'Today', location?: Location) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isLiveData, setIsLiveData] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getDateRangeForPeriod(period);

      let salesData;
      if (location) {
        // Single location - fetch each day and sum
        salesData = await fetchSalesForRange(startDate, endDate, location);
      } else {
        // Aggregate both locations - fetch each day for each location and sum
        const [elmData, prosperData] = await Promise.all([
          fetchSalesForRange(startDate, endDate, 'littleelm'),
          fetchSalesForRange(startDate, endDate, 'prosper'),
        ]);

        const totalOrders = (elmData?.totalOrders || 0) + (prosperData?.totalOrders || 0);
        const netSales = (elmData?.netSales || 0) + (prosperData?.netSales || 0);

        salesData = {
          netSales,
          totalOrders,
          averageCheck: totalOrders > 0 ? netSales / totalOrders : 0,
        };
      }

      // Transform to dashboard format
      const revenueMetrics = {
        netRevenue: { value: Math.round(salesData.netSales), change: 0 },
        sssg: { value: 0, change: 0 },
        guestCount: { value: salesData.totalOrders, change: 0 },
        avgTicket: { value: Math.round(salesData.averageCheck * 100) / 100, change: 0 },
      };

      setData({
        revenueMetrics,
        operationalMetrics: OPERATIONAL_DATA,
        laborMetrics: LABOR_DATA,
        experienceMetrics: EXPERIENCE_DATA,
        shiftLeads: SHIFT_LEADS,
        revenueMix: REVENUE_MIX,
        hourlyData: REVENUE_CHART_DATA,
        isLiveData: true,
      });
      setIsLiveData(true);
    } catch (err) {
      console.error('Failed to fetch Toast data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Fallback to mock data
      setData({
        revenueMetrics: REVENUE_DATA[period],
        operationalMetrics: OPERATIONAL_DATA,
        laborMetrics: LABOR_DATA,
        experienceMetrics: EXPERIENCE_DATA,
        shiftLeads: SHIFT_LEADS,
        revenueMix: REVENUE_MIX,
        hourlyData: REVENUE_CHART_DATA,
        isLiveData: false,
      });
      setIsLiveData(false);
    } finally {
      setLoading(false);
    }
  }, [period, location]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, isLiveData };
}

export function useLocationFilter() {
  const [location, setLocation] = useState<Location>(undefined);

  const locations = [
    { value: undefined, label: 'All Locations' },
    { value: 'littleelm' as Location, label: 'Little Elm' },
    { value: 'prosper' as Location, label: 'Prosper' },
  ];

  return { location, setLocation, locations };
}
