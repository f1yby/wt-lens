import { useState, useEffect } from 'react';
import type { StatsMonthRange } from '../types';

/**
 * Generic hook for loading data that depends on a StatsMonthRange.
 *
 * Encapsulates the pattern shared by all list pages:
 *   - Skip loading when range is empty (guard)
 *   - Show loading state during fetch
 *   - Cancel stale requests on range change (race-condition protection)
 *
 * @param loader  - async function that takes a StatsMonthRange and returns data
 * @param range   - current stats month range (from useStatsMonthRange)
 * @returns { data, loading }
 */
export function useRangeLoader<T>(
  loader: (range: StatsMonthRange) => Promise<T>,
  range: StatsMonthRange,
): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!range.startMonth || !range.endMonth) return;

    let cancelled = false;
    setLoading(true);

    loader(range).then(result => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [loader, range]);

  return { data, loading };
}
