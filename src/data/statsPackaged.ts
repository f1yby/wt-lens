/**
 * Stats Packaged Data Loader
 * 
 * Loads pre-packaged stats data organized by:
 *   - Month: 2026-02, 2025-12, etc.
 *   - Category: ground, aircraft, helicopter, ship
 *   - Mode: arcade, historical, simulation
 * 
 * File format: {month}-{category}-{mode}.json
 * Example: 2026-02-ground-historical.json
 */

import type { StatSharkEntry } from './base';
import type { StatsMonthId, StatsMonthRange, GameMode } from '../types';
import { getMonthsInRange, isSingleMonthRange } from '../types';

// Types
export type VehicleCategory = 'ground' | 'aircraft' | 'helicopter' | 'ship';

export interface PackagedStatsIndex {
  months: string[];
  latestMonth: string;
  categories: VehicleCategory[];
  modes: GameMode[];
}

// Cache
let _index: PackagedStatsIndex | null = null;
let _indexPromise: Promise<PackagedStatsIndex> | null = null;

// Cache: "{month}-{category}-{mode}" -> StatSharkEntry[]
const _packagedCache = new Map<string, StatSharkEntry[]>();

/**
 * Convert StatsMonthId to packaged file month format
 * diff_2026_february_march -> 2026-february-march
 */
export function monthIdToPackaged(monthId: StatsMonthId): string {
  if (monthId.startsWith('diff_')) {
    return monthId.slice(5).replace(/_/g, '-');
  }
  return monthId;
}

/**
 * Load the packaged stats index
 */
export async function loadPackagedIndex(): Promise<PackagedStatsIndex> {
  if (_index) return _index;
  if (_indexPromise) return _indexPromise;

  _indexPromise = (async () => {
    const response = await fetch('/wt-lens/data/stats-packaged/index.json');
    if (!response.ok) {
      throw new Error(`Failed to load packaged index: ${response.status}`);
    }
    const index: PackagedStatsIndex = await response.json();
    _index = index;
    return index;
  })();

  return _indexPromise;
}

/**
 * Load packaged stats for a specific month, category, and mode
 */
export async function loadPackagedStats(
  month: string,
  category: VehicleCategory,
  mode: GameMode
): Promise<StatSharkEntry[]> {
  const cacheKey = `${month}-${category}-${mode}`;
  
  if (_packagedCache.has(cacheKey)) {
    return _packagedCache.get(cacheKey)!;
  }

  const response = await fetch(`/wt-lens/data/stats-packaged/${cacheKey}.json`);
  if (!response.ok) {
    if (response.status === 404) {
      // File doesn't exist, return empty array
      return [];
    }
    throw new Error(`Failed to load packaged stats: ${response.status}`);
  }

  const entries: StatSharkEntry[] = await response.json();
  _packagedCache.set(cacheKey, entries);
  return entries;
}

/**
 * Load packaged stats for a month range and category.
 * Aggregates data from multiple months if needed.
 */
export async function loadPackagedStatsForRange(
  range: StatsMonthRange,
  category: VehicleCategory,
  mode: GameMode
): Promise<StatSharkEntry[]> {
  // Single month: just load one file
  if (isSingleMonthRange(range)) {
    const month = monthIdToPackaged(range.startMonth);
    return loadPackagedStats(month, category, mode);
  }

  // Multiple months: load and aggregate
  const monthsInRange = getMonthsInRange(range);
  const monthStrings = monthsInRange.map(m => monthIdToPackaged(m));

  // Load all months in parallel
  const results = await Promise.all(
    monthStrings.map(m => loadPackagedStats(m, category, mode))
  );

  // Flatten all entries
  return results.flat();
}

/**
 * Get the latest month from packaged index
 */
export async function getLatestPackagedMonth(): Promise<string> {
  const index = await loadPackagedIndex();
  return index.latestMonth;
}

/**
 * Get all available months from packaged index
 */
export async function getAvailablePackagedMonths(): Promise<string[]> {
  const index = await loadPackagedIndex();
  return index.months;
}

/**
 * Clear the packaged stats cache
 */
export function clearPackagedStatsCache(): void {
  _packagedCache.clear();
}
