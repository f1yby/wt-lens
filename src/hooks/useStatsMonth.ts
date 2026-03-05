import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { StatsMonthId, StatsMonthRange } from '../types';
import { isValidStatsMonthId, isValidMonthRange } from '../types';
import {
  getInitialStatsMonth,
  saveStatsMonthToStorage,
  getInitialStatsMonthRange,
  saveStatsMonthRangeToStorage,
} from '../utils/statsMonth';

/**
 * Return type for useStatsMonth hook (legacy single month)
 */
export interface UseStatsMonthReturn {
  /** Current stats month ID */
  statsMonth: StatsMonthId;
  /** Handler to change stats month - updates state, localStorage, and URL */
  handleStatsMonthChange: (month: StatsMonthId) => void;
}

/**
 * Custom hook for managing stats month state with URL sync and localStorage persistence.
 * 
 * Features:
 * - Initializes from URL params > localStorage > default (latest month)
 * - Syncs changes to both URL and localStorage
 * - Responds to external URL changes (e.g., browser back/forward)
 * 
 * @deprecated Use useStatsMonthRange instead for range selection support
 * 
 * @example
 * ```tsx
 * function MyPage() {
 *   const { statsMonth, handleStatsMonthChange } = useStatsMonth();
 *   
 *   return (
 *     <MonthSelector
 *       currentMonth={statsMonth}
 *       onMonthChange={handleStatsMonthChange}
 *     />
 *   );
 * }
 * ```
 */
export function useStatsMonth(): UseStatsMonthReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize stats month from URL or storage
  const [statsMonth, setStatsMonth] = useState<StatsMonthId>(() =>
    getInitialStatsMonth(searchParams)
  );

  // Handle stats month change - uses functional setSearchParams to avoid stale closure
  const handleStatsMonthChange = useCallback((month: StatsMonthId) => {
    setStatsMonth(month);
    saveStatsMonthToStorage(month);
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set('month', month);
      return newParams;
    });
  }, [setSearchParams]);

  // Sync stats month from URL when URL changes externally
  // (e.g., browser back/forward navigation)
  useEffect(() => {
    const urlMonth = searchParams.get('month');
    if (urlMonth && isValidStatsMonthId(urlMonth)) {
      setStatsMonth((prev) => prev === urlMonth ? prev : urlMonth);
    }
  }, [searchParams]);

  return {
    statsMonth,
    handleStatsMonthChange,
  };
}

// ============================================================================
// Month Range Hook
// ============================================================================

/**
 * Return type for useStatsMonthRange hook
 */
export interface UseStatsMonthRangeReturn {
  /** Current stats month range */
  statsMonthRange: StatsMonthRange;
  /** Handler to change stats month range - updates state, localStorage, and URL */
  handleStatsMonthRangeChange: (range: StatsMonthRange) => void;
}

/**
 * Custom hook for managing stats month range state with URL sync and localStorage persistence.
 * 
 * Features:
 * - Initializes from URL params > localStorage > default (latest month as single-month range)
 * - Syncs changes to both URL and localStorage
 * - Responds to external URL changes (e.g., browser back/forward)
 * - Supports both new range format and legacy single month format
 * 
 * @example
 * ```tsx
 * function MyPage() {
 *   const { statsMonthRange, handleStatsMonthRangeChange } = useStatsMonthRange();
 *   
 *   return (
 *     <MonthRangeSelector
 *       currentRange={statsMonthRange}
 *       onRangeChange={handleStatsMonthRangeChange}
 *     />
 *   );
 * }
 * ```
 */
export function useStatsMonthRange(): UseStatsMonthRangeReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize stats month range from URL or storage
  const [statsMonthRange, setStatsMonthRange] = useState<StatsMonthRange>(() =>
    getInitialStatsMonthRange(searchParams)
  );

  // Handle stats month range change - uses functional setSearchParams to avoid stale closure
  const handleStatsMonthRangeChange = useCallback((range: StatsMonthRange) => {
    // Validate range before applying
    if (!isValidMonthRange(range)) {
      console.warn('Invalid month range:', range);
      return;
    }
    
    setStatsMonthRange(range);
    saveStatsMonthRangeToStorage(range);
    
    // Use functional update to avoid stale searchParams closure
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('month');
      newParams.set('monthStart', range.startMonth);
      newParams.set('monthEnd', range.endMonth);
      return newParams;
    });
  }, [setSearchParams]);

  // Sync stats month range from URL when URL changes externally
  // (e.g., browser back/forward navigation)
  useEffect(() => {
    const urlMonthStart = searchParams.get('monthStart');
    const urlMonthEnd = searchParams.get('monthEnd');
    const legacyMonth = searchParams.get('month');
    
    // Try new format first
    if (urlMonthStart && urlMonthEnd && 
        isValidStatsMonthId(urlMonthStart) && 
        isValidStatsMonthId(urlMonthEnd)) {
      const urlRange: StatsMonthRange = { startMonth: urlMonthStart, endMonth: urlMonthEnd };
      if (isValidMonthRange(urlRange)) {
        setStatsMonthRange((prev) => {
          if (prev.startMonth === urlRange.startMonth && prev.endMonth === urlRange.endMonth) {
            return prev;
          }
          return urlRange;
        });
      }
    }
    // Fallback to legacy format
    else if (legacyMonth && isValidStatsMonthId(legacyMonth)) {
      setStatsMonthRange((prev) => {
        if (prev.startMonth === legacyMonth && prev.endMonth === legacyMonth) {
          return prev;
        }
        return { startMonth: legacyMonth, endMonth: legacyMonth };
      });
    }
  }, [searchParams]);

  return {
    statsMonthRange,
    handleStatsMonthRangeChange,
  };
}

export default useStatsMonth;
