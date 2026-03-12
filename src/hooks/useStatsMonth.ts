import { useState, useEffect, useCallback } from 'react';
import type { StatsMonthRange } from '../types';
import { isValidMonthRange, getDefaultStatsMonthRange } from '../types';
import { isServiceInitialized } from '../services/statsMonthService';
import { loadStatsMeta } from '../data/base';

/**
 * Return type for useStatsMonthRange hook
 */
export interface UseStatsMonthRangeReturn {
  /** Current stats month range */
  statsMonthRange: StatsMonthRange;
  /** Handler to change stats month range */
  handleStatsMonthRangeChange: (range: StatsMonthRange) => void;
}

/**
 * Custom hook for managing stats month range state.
 * 
 * Pure in-memory state — no URL params, no localStorage.
 * Initializes to empty, then resolves to the default (latest month)
 * once the stats month service is ready.
 */
export function useStatsMonthRange(): UseStatsMonthRangeReturn {
  const [statsMonthRange, setStatsMonthRange] = useState<StatsMonthRange>({
    startMonth: '',
    endMonth: '',
  });

  // Handler: validate then set
  const handleStatsMonthRangeChange = useCallback((range: StatsMonthRange) => {
    if (!isValidMonthRange(range)) {
      console.warn('Invalid month range:', range);
      return;
    }
    setStatsMonthRange(range);
  }, []);

  // Once service is initialized, resolve the default range.
  // Before that, statsMonthRange is empty and pages show a loading state.
  //
  // IMPORTANT: We must call loadStatsMeta() ourselves to trigger service
  // initialization. Otherwise there's a deadlock:
  //   - This hook waits for service init to set range
  //   - Pages wait for non-empty range to call loadVehicles()
  //   - loadVehicles() calls loadStatsMeta() which inits the service
  //   → Nobody kicks off loadStatsMeta() → stuck forever
  useEffect(() => {
    // If service is already ready (e.g. hot-reload), set immediately
    if (isServiceInitialized()) {
      const defaultRange = getDefaultStatsMonthRange();
      if (defaultRange.startMonth && defaultRange.endMonth) {
        setStatsMonthRange(defaultRange);
      }
      return;
    }

    // Kick off meta loading to initialize the service
    loadStatsMeta().then(() => {
      const defaultRange = getDefaultStatsMonthRange();
      if (defaultRange.startMonth && defaultRange.endMonth) {
        setStatsMonthRange(defaultRange);
      }
    });
  }, []);

  return {
    statsMonthRange,
    handleStatsMonthRangeChange,
  };
}

export default useStatsMonthRange;
