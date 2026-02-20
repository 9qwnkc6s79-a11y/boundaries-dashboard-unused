import { useState, useEffect, useCallback } from 'react';

export type MetaPeriod = '1d' | '7d' | '30d' | '90d';

export interface MetaSummary {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  cpc: number;
  cpm: number;
  ctr: number;
  conversions: number;
  roas: number;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  metrics: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
  } | null;
}

export interface MetaDailyData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
}

export interface MetaAdsData {
  period: string;
  dateRange: { since: string; until: string };
  summary: MetaSummary;
  campaigns: MetaCampaign[];
  dailyData: MetaDailyData[];
  fetchedAt: string;
}

export function useMetaAds(period: MetaPeriod = '7d') {
  const [data, setData] = useState<MetaAdsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meta-ads?period=${period}`);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Meta Ads API failed: ${errText}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch Meta Ads data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
