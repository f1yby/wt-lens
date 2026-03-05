import type { StatsMonthId } from '../types';
import { STATS_MONTHS, DEFAULT_STATS_MONTH, isValidStatsMonthId, getStatsMonthConfig } from '../types';

const STATS_MONTH_STORAGE_KEY = 'wt-lens-stats-month';

/**
 * Get stats month from URL search params
 */
export function getStatsMonthFromURL(searchParams: URLSearchParams): StatsMonthId | null {
  const month = searchParams.get('month');
  if (month && isValidStatsMonthId(month)) {
    return month;
  }
  return null;
}

/**
 * Get stats month from localStorage
 */
export function getStatsMonthFromStorage(): StatsMonthId | null {
  try {
    const stored = localStorage.getItem(STATS_MONTH_STORAGE_KEY);
    if (stored && isValidStatsMonthId(stored)) {
      return stored;
    }
  } catch {
    // localStorage may not be available
  }
  return null;
}

/**
 * Save stats month to localStorage
 */
export function saveStatsMonthToStorage(month: StatsMonthId): void {
  try {
    localStorage.setItem(STATS_MONTH_STORAGE_KEY, month);
  } catch {
    // localStorage may not be available
  }
}

/**
 * Get initial stats month (from URL, storage, or default)
 */
export function getInitialStatsMonth(searchParams: URLSearchParams): StatsMonthId {
  // Priority: URL > localStorage > default
  return getStatsMonthFromURL(searchParams) 
    ?? getStatsMonthFromStorage() 
    ?? DEFAULT_STATS_MONTH;
}

/**
 * Update URL with stats month
 */
export function updateURLWithStatsMonth(
  searchParams: URLSearchParams,
  setSearchParams: (params: URLSearchParams) => void,
  month: StatsMonthId
): void {
  const newParams = new URLSearchParams(searchParams);
  newParams.set('month', month);
  setSearchParams(newParams);
}

/**
 * Get display label for stats month
 */
export function getStatsMonthLabel(monthId: StatsMonthId): string {
  const config = getStatsMonthConfig(monthId);
  return config?.label ?? monthId;
}

/**
 * Get short display label for stats month
 */
export function getStatsMonthShortLabel(monthId: StatsMonthId): string {
  const config = getStatsMonthConfig(monthId);
  return config?.shortLabel ?? monthId;
}

/**
 * Get all available stats months in reverse chronological order (latest first)
 */
export function getStatsMonthsReversed() {
  return [...STATS_MONTHS].reverse();
}
