// React hook for fetching Toast POS data
import { useState, useEffect, useCallback } from 'react';
import { fetchDashboardData } from '../api/dataService';
import type { RevenueMetrics, LaborMetrics, ShiftLeadData, RevenueMix, Period } from '../../types';

// Fallback mock data when API is unavailable
import { REVENUE_DATA, LABOR_DATA, SHIFT_LEADS, REVENUE_MIX, REVENUE_CHART_DATA } from '../../mockData';

interface DashboardData {
  revenueMetrics: RevenueMetrics;
  laborMetrics: Partial<LaborMetrics>;
  revenueMix: RevenueMix[];
  hourlyData: { time: string; revenue: number; transactions: number }[];
  shiftLeads: ShiftLeadData[];
}

interface UseToastDataResult {
  data: DashboardData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  isUsingMockData: boolean;
}

export function useToastData(period: Period = 'Today'): UseToastDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Check if API credentials are configured
    const hasCredentials =
      import.meta.env.VITE_TOAST_CLIENT_ID &&
      import.meta.env.VITE_TOAST_CLIENT_SECRET &&
      import.meta.env.VITE_TOAST_RESTAURANT_GUID;

    if (!hasCredentials) {
      console.warn('Toast API credentials not configured. Using mock data.');
      setData({
        revenueMetrics: REVENUE_DATA[period],
        laborMetrics: LABOR_DATA,
        revenueMix: REVENUE_MIX,
        hourlyData: REVENUE_CHART_DATA,
        shiftLeads: SHIFT_LEADS,
      });
      setIsUsingMockData(true);
      setLoading(false);
      return;
    }

    try {
      const result = await fetchDashboardData(period);
      setData({
        revenueMetrics: result.revenueMetrics,
        laborMetrics: result.laborMetrics,
        revenueMix: result.revenueMix,
        hourlyData: result.hourlyData,
        shiftLeads: result.shiftLeads.length > 0 ? result.shiftLeads : SHIFT_LEADS,
      });
      setIsUsingMockData(false);
    } catch (err) {
      console.error('Failed to fetch Toast data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));

      // Fall back to mock data on error
      setData({
        revenueMetrics: REVENUE_DATA[period],
        laborMetrics: LABOR_DATA,
        revenueMix: REVENUE_MIX,
        hourlyData: REVENUE_CHART_DATA,
        shiftLeads: SHIFT_LEADS,
      });
      setIsUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 5 minutes for real data
    const interval = setInterval(() => {
      if (!isUsingMockData) {
        fetchData();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchData, isUsingMockData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    isUsingMockData,
  };
}

// Hook for real-time order updates (for live dashboard)
export function useRealtimeOrders(enabled = true) {
  const [orderCount, setOrderCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Poll for new orders every 30 seconds
    const interval = setInterval(async () => {
      try {
        const { fetchRealtimeOrders } = await import('../api/dataService');
        const orders = await fetchRealtimeOrders();
        setOrderCount(orders.length);
        setLastUpdate(new Date());
      } catch (err) {
        console.error('Failed to fetch realtime orders:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [enabled]);

  return { orderCount, lastUpdate };
}
