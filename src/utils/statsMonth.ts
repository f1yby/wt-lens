import type { StatsMonthId, StatsMonthRange } from '../types';
import { 
  STATS_MONTHS, 
  DEFAULT_STATS_MONTH, 
  DEFAULT_STATS_MONTH_RANGE,
  isValidStatsMonthId, 
  getStatsMonthConfig,
  isValidMonthRange,
} from '../types';

const STATS_MONTH_STORAGE_KEY = 'wt-lens-stats-month';
const STATS_MONTH_RANGE_STORAGE_KEY = 'wt-lens-stats-month-range';

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

// ============================================================================
// Month Range Functions
// ============================================================================

/**
 * Get stats month range from URL search params
 * Supports both new format (?monthStart=xxx&monthEnd=xxx) and legacy format (?month=xxx)
 */
export function getStatsMonthRangeFromURL(searchParams: URLSearchParams): StatsMonthRange | null {
  const monthStart = searchParams.get('monthStart');
  const monthEnd = searchParams.get('monthEnd');
  
  // New format: monthStart + monthEnd
  if (monthStart && monthEnd && isValidStatsMonthId(monthStart) && isValidStatsMonthId(monthEnd)) {
    const range: StatsMonthRange = { startMonth: monthStart, endMonth: monthEnd };
    if (isValidMonthRange(range)) {
      return range;
    }
  }
  
  // Legacy format: single month -> convert to range
  const legacyMonth = searchParams.get('month');
  if (legacyMonth && isValidStatsMonthId(legacyMonth)) {
    return { startMonth: legacyMonth, endMonth: legacyMonth };
  }
  
  return null;
}

/**
 * Get stats month range from localStorage
 */
export function getStatsMonthRangeFromStorage(): StatsMonthRange | null {
  try {
    // Try new format first
    const stored = localStorage.getItem(STATS_MONTH_RANGE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (
        parsed.startMonth && 
        parsed.endMonth && 
        isValidStatsMonthId(parsed.startMonth) && 
        isValidStatsMonthId(parsed.endMonth)
      ) {
        const range: StatsMonthRange = { startMonth: parsed.startMonth, endMonth: parsed.endMonth };
        if (isValidMonthRange(range)) {
          return range;
        }
      }
    }
    
    // Fallback to legacy single month format
    const legacyStored = localStorage.getItem(STATS_MONTH_STORAGE_KEY);
    if (legacyStored && isValidStatsMonthId(legacyStored)) {
      return { startMonth: legacyStored, endMonth: legacyStored };
    }
  } catch {
    // localStorage may not be available or JSON parse error
  }
  return null;
}

/**
 * Save stats month range to localStorage
 */
export function saveStatsMonthRangeToStorage(range: StatsMonthRange): void {
  try {
    localStorage.setItem(STATS_MONTH_RANGE_STORAGE_KEY, JSON.stringify(range));
    // Also update legacy key for backward compatibility
    localStorage.setItem(STATS_MONTH_STORAGE_KEY, range.endMonth);
  } catch {
    // localStorage may not be available
  }
}

/**
 * Get initial stats month range (from URL, storage, or default)
 */
export function getInitialStatsMonthRange(searchParams: URLSearchParams): StatsMonthRange {
  // Priority: URL > localStorage > default
  return getStatsMonthRangeFromURL(searchParams) 
    ?? getStatsMonthRangeFromStorage() 
    ?? DEFAULT_STATS_MONTH_RANGE;
}

/**
 * Update URL with stats month range
 */
export function updateURLWithStatsMonthRange(
  searchParams: URLSearchParams,
  setSearchParams: (params: URLSearchParams) => void,
  range: StatsMonthRange
): void {
  const newParams = new URLSearchParams(searchParams);
  
  // Remove legacy month param if exists
  newParams.delete('month');
  
  // Set new range params
  newParams.set('monthStart', range.startMonth);
  newParams.set('monthEnd', range.endMonth);
  
  setSearchParams(newParams);
}
