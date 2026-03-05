import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { StatsMonthId } from '../types';
import { isValidStatsMonthId } from '../types';
import {
  getInitialStatsMonth,
  saveStatsMonthToStorage,
  updateURLWithStatsMonth,
} from '../utils/statsMonth';

/**
 * Return type for useStatsMonth hook
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

  // Handle stats month change - memoized to prevent unnecessary re-renders
  const handleStatsMonthChange = useCallback((month: StatsMonthId) => {
    setStatsMonth(month);
    saveStatsMonthToStorage(month);
    updateURLWithStatsMonth(searchParams, setSearchParams, month);
  }, [searchParams, setSearchParams]);

  // Sync stats month from URL on mount and when URL changes externally
  // (e.g., browser back/forward navigation)
  useEffect(() => {
    const urlMonth = searchParams.get('month');
    if (urlMonth && isValidStatsMonthId(urlMonth) && urlMonth !== statsMonth) {
      setStatsMonth(urlMonth);
    }
  }, [searchParams, statsMonth]);

  return {
    statsMonth,
    handleStatsMonthChange,
  };
}

export default useStatsMonth;
