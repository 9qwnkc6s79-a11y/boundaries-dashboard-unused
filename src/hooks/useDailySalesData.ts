import { useState, useEffect, useCallback } from 'react';
import type { Location } from './useToastData';

export interface DailySales {
  date: string;
  day: number;
  sales: number;
}

export function useDailySalesData(location?: Location) {
  const [data, setData] = useState<DailySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (location) params.append('location', location);

      const response = await fetch(`/api/toast-daily-sales?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch daily sales: ${await response.text()}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch daily sales:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
