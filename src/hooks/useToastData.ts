// React hook for fetching dashboard data from Logbook API
import { useState, useEffect, useCallback } from 'react';
import { fetchDashboardData, fetchRealtimeData, type DashboardData } from '../api/dataService';
import type { Period } from '../../types';
import type { Location } from '../api/logbookApi';

interface UseToastDataResult {
  data: DashboardData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  isLiveData: boolean;
}

export function useToastData(
  period: Period = 'Today',
  location?: Location
): UseToastDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchDashboardData(period, location);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [period, location]);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    isLiveData: data?.isLiveData ?? false,
  };
}

// Hook for real-time order updates
export function useRealtimeData(enabled = true) {
  const [data, setData] = useState<{
    netSales: number;
    orderCount: number;
    laborHours: number;
    currentlyClocked: any[];
  } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const fetchRealtime = async () => {
      const result = await fetchRealtimeData();
      if (result) {
        setData(result);
        setLastUpdate(new Date());
      }
    };

    // Initial fetch
    fetchRealtime();

    // Poll every 30 seconds
    const interval = setInterval(fetchRealtime, 30000);
    return () => clearInterval(interval);
  }, [enabled]);

  return { data, lastUpdate };
}

// Hook for location selection
export function useLocationFilter() {
  const [location, setLocation] = useState<Location | undefined>(undefined);

  const locations = [
    { value: undefined, label: 'All Locations' },
    { value: 'littleelm' as Location, label: 'Little Elm' },
    { value: 'prosper' as Location, label: 'Prosper' },
  ];

  return { location, setLocation, locations };
}
