import { useState, useEffect, useCallback } from 'react';

export interface CredentialField {
  key: string;
  label: string;
  masked: string;
  hasValue: boolean;
}

export interface CredentialService {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  fields: CredentialField[];
}

export function useCredentials() {
  const [services, setServices] = useState<CredentialService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCredentials = useCallback(async () => {
    try {
      const response = await fetch('/api/credentials');
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
      const data = await response.json();
      setServices(data.services || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const updateCredential = useCallback(async (key: string, value: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!response.ok) throw new Error(`Save failed: ${response.status}`);
      await fetchCredentials();
      return true;
    } catch {
      return false;
    }
  }, [fetchCredentials]);

  return { services, loading, error, updateCredential, refetch: fetchCredentials };
}
