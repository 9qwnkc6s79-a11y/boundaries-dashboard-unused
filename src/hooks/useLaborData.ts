import { useState, useEffect, useCallback } from 'react';
import type { Period } from '../../types';

export type Location = 'littleelm' | 'prosper' | undefined;

function getDateRangeForPeriod(period: Period): { startDate: string; endDate: string } {
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

export interface LaborData {
  totalLaborHours: number;
  totalLaborCost: number;
  laborPercent: number;
  revPerLaborHour: number;
  totalSales: number;
  employeeCount: number;
  timeEntryCount: number;
  topEmployees: Array<{
    guid: string;
    name: string;
    hoursWorked: number;
    shifts: number;
  }>;
  isLiveData: boolean;
}

export function useLaborData(period: Period = 'Today', location?: Location) {
  const [data, setData] = useState<LaborData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getDateRangeForPeriod(period);
      const params = new URLSearchParams({ startDate, endDate });
      if (location) params.append('location', location);

      const response = await fetch(`/api/toast-labor-direct?${params}`);
      
      if (!response.ok) {
        throw new Error(`Labor API failed: ${response.status}`);
      }

      const laborData = await response.json();
      setData(laborData);
    } catch (err) {
      console.error('Failed to fetch labor data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, location]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
