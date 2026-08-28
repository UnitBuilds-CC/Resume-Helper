import { useState, useCallback } from 'react';

interface UseApiOptions {
  method?: string;
  body?: unknown;
}

export function useApi<T>(url: string, options?: UseApiOptions) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async (overrides?: UseApiOptions) => {
    setLoading(true);
    setError(null);
    try {
      const method = overrides?.method ?? options?.method ?? 'GET';
      const body = overrides?.body ?? options?.body;
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      setData(json);
      return json as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [url, options]);

  return { data, error, loading, execute };
}
