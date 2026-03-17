import { useState, useEffect, useRef } from 'react';
import type { StatsMonthRange, GameMode } from '../types';

/**
 * Hook for loading packaged stats data that depends on both StatsMonthRange and GameMode.
 *
 * Similar to useRangeLoader, but also watches gameMode changes.
 * Used for loading pre-packaged stats files organized by month, category, and mode.
 *
 * @param loader  - async function that takes range and mode, returns data
 * @param range   - current stats month range
 * @param mode    - current game mode (arcade, historical, simulation)
 * @returns { data, loading }
 */
export function usePackagedLoader<T>(
  loader: (range: StatsMonthRange, mode: GameMode) => Promise<T>,
  range: StatsMonthRange,
  mode: GameMode,
): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Track last loaded params to avoid duplicate loads
  const lastLoadRef = useRef<string | null>(null);

  useEffect(() => {
    if (!range.startMonth || !range.endMonth) return;

    const loadKey = `${range.startMonth}-${range.endMonth}-${mode}`;
    
    // Skip if same params as last load
    if (lastLoadRef.current === loadKey && data !== null) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    loader(range, mode).then(result => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
        lastLoadRef.current = loadKey;
      }
    });

    return () => { cancelled = true; };
  }, [loader, range, mode, data]);

  return { data, loading };
}
