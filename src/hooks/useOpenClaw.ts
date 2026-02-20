import { useState, useEffect, useCallback, useRef } from 'react';

export interface OpenClawSession {
  sessionId: string;
  sessionKey: string;
  updatedAt: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextTokens: number;
  displayName: string;
  channel: string;
  agentId: string;
  origin?: {
    label?: string;
    provider?: string;
    from?: string;
    to?: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// Fetch all sessions from OpenClaw gateway
export function useOpenClawSessions(pollIntervalMs = 30000) {
  const [sessions, setSessions] = useState<OpenClawSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/openclaw-sessions');
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
      const data = await response.json();
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    if (pollIntervalMs > 0) {
      timerRef.current = setInterval(fetchSessions, pollIntervalMs);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchSessions, pollIntervalMs]);

  return { sessions, loading, error, refetch: fetchSessions };
}

// Send a message to an agent and get response
export function useOpenClawChat() {
  const [sending, setSending] = useState(false);

  const sendMessage = useCallback(async (agentId: string, message: string, sessionKey?: string): Promise<string> => {
    setSending(true);
    try {
      const response = await fetch('/api/openclaw-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, message, sessionKey }),
      });
      if (!response.ok) throw new Error(`Chat failed: ${response.status}`);
      const data = await response.json();
      return data.content || data.choices?.[0]?.message?.content || '';
    } finally {
      setSending(false);
    }
  }, []);

  return { sendMessage, sending };
}

// Fetch conversation history for an agent
export function useOpenClawHistory(agentId: string | null, sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!agentId || !sessionId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ agentId, sessionId, limit: '50' });
      const response = await fetch(`/api/openclaw-history?${params}`);
      if (!response.ok) throw new Error(`History failed: ${response.status}`);
      const data = await response.json();
      setMessages(data);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [agentId, sessionId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { messages, loading, refetch: fetchHistory };
}
