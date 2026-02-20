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

async function fetchSalesFromToast(startDate: string, endDate: string, location?: Location) {
  const params = new URLSearchParams({ startDate, endDate });
  if (location) params.append('location', location);

  const response = await fetch(`/api/toast-direct?${params}`);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch sales: ${error}`);
  }
  return response.json();
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

      // Fetch directly from Toast API (aggregates both locations if no location specified)
      const salesData = await fetchSalesFromToast(startDate, endDate, location);

      // Transform to dashboard format
      // Use month-over-month changes from API
      const changes = salesData.changes || {};
      const revenueMetrics = {
        netRevenue: { value: Math.round(salesData.netSales), change: changes.netSales || 0 },
        sssg: { value: salesData.sssg || 0, change: 0 },
        guestCount: { value: salesData.totalOrders, change: changes.totalOrders || 0 },
        avgTicket: { value: Math.round(salesData.averageCheck * 100) / 100, change: changes.averageCheck || 0 },
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
      // Fallback to N/A - no fake data
      setData({
        revenueMetrics: {
          netRevenue: { value: 0, change: 0 },
          sssg: { value: 0, change: 0 },
          guestCount: { value: 0, change: 0 },
          avgTicket: { value: 0, change: 0 },
        },
        operationalMetrics: null,
        laborMetrics: null,
        experienceMetrics: null,
        shiftLeads: [],
        revenueMix: [],
        hourlyData: [],
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
