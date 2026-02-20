import { useState, useEffect, useCallback } from 'react';

export interface BlandCall {
  call_id: string;
  created_at: string;
  started_at?: string;
  end_at?: string;
  call_length?: number;
  status: string;
  queue_status: string;
  answered_by?: string;
  from?: string;
  to?: string;
  summary?: string;
  price?: number;
  recording_url?: string;
  transcripts?: Array<{ id: number; text: string; user: string }>;
  concatenated_transcript?: string;
}

// List recent calls
export function useBlandCalls() {
  const [calls, setCalls] = useState<BlandCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bland-calls');
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
      const data = await response.json();
      setCalls(data.calls || data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  return { calls, loading, error, refetch: fetchCalls };
}

// Initiate an outbound call
export function useInitiateCall() {
  const [calling, setCalling] = useState(false);

  const initiateCall = useCallback(async (phoneNumber: string, task: string): Promise<{ call_id: string; status: string }> => {
    setCalling(true);
    try {
      const response = await fetch('/api/bland-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber, task }),
      });
      if (!response.ok) throw new Error(`Call failed: ${response.status}`);
      return response.json();
    } finally {
      setCalling(false);
    }
  }, []);

  return { initiateCall, calling };
}

// Get details for a specific call
export function useCallDetails(callId: string | null) {
  const [call, setCall] = useState<BlandCall | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!callId) return;
    setLoading(true);
    fetch(`/api/bland-call?id=${callId}`)
      .then(r => r.json())
      .then(data => setCall(data))
      .catch(() => setCall(null))
      .finally(() => setLoading(false));
  }, [callId]);

  return { call, loading };
}
