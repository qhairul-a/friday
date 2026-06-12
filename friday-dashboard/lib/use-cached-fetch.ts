"use client";

import { useState, useEffect, useRef } from "react";

const _cache = new Map<string, { data: unknown; ts: number }>();

/**
 * Stale-while-revalidate fetch hook.
 * On mount: immediately returns cached data (if any) so widgets render instantly.
 * Always fires a background fetch to refresh — updates state when done.
 * Cache is module-level so it survives client-side navigation between pages.
 */
export function useCachedFetch<T>(
  url: string,
  ttlMs = 60_000,
): { data: T | null; loading: boolean; refresh: () => void } {
  const cached = _cache.get(url);
  const [data, setData] = useState<T | null>(
    cached ? (cached.data as T) : null,
  );
  const [loading, setLoading] = useState(!cached);
  const activeRef = useRef(0);

  function doFetch(force = false) {
    const hit = _cache.get(url);
    if (!force && hit && Date.now() - hit.ts < ttlMs) {
      setData(hit.data as T);
      setLoading(false);
      return;
    }
    const id = ++activeRef.current;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((fresh: T) => {
        if (id !== activeRef.current) return;
        _cache.set(url, { data: fresh, ts: Date.now() });
        setData(fresh);
        setLoading(false);
      })
      .catch(() => {
        if (id === activeRef.current) setLoading(false);
      });
  }

  useEffect(() => {
    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { data, loading, refresh: () => doFetch(true) };
}
