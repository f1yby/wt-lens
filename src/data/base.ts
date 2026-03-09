/**
 * Base module for shared data loading utilities.
 * Contains common types and functions used by vehicles, aircraft, and ships data modules.
 */
import type { GameMode, VehicleStats, StatsMonthId, StatsMonthRange } from '../types';
import { getDefaultStatsMonth, getDefaultStatsMonthRange, getMonthsInRange, isSingleMonthRange } from '../types';

/**
 * StatShark entry from stats.json / aircraft-stats.json / ship-stats.json
 */
export interface StatSharkEntry {
  id: string;
  name: string;
  mode: 'arcade' | 'historical' | 'simulation';
  battles: number;
  win_rate: number;
  avg_kills_per_spawn: number;
  exp_per_spawn?: number;
  rank?: number;
  br?: number;
  month?: string; // 月份标识，如 "diff_2025_febuary_march"
}

/**
 * Clean vehicle/aircraft/ship name: only remove zero-width spaces.
 * Keep special WT symbols (␗, ▄, etc.) - they are rendered via WTSymbols font.
 */
export function cleanName(name: string): string {
  if (!name) return name;
  return name.replace(/\u200b/g, '');
}

/**
 * Build StatShark stats map grouped by game mode
 * Returns a map of vehicleId -> Record<GameMode, StatSharkEntry>
 * @param stats - Array of StatShark entries
 * @param month - Optional month filter. If provided, only entries with matching month are included.
 *                If not provided, defaults to the latest month.
 */
export function buildStatsMapByMode(
  stats: StatSharkEntry[], 
  month?: StatsMonthId
): Map<string, Record<GameMode, StatSharkEntry | undefined>> {
  const statsMap = new Map<string, Record<GameMode, StatSharkEntry | undefined>>();
  
  // Use default month if not specified
  const targetMonth = month ?? getDefaultStatsMonth();

  for (const entry of stats) {
    // Filter by month if entry has month field
    if (entry.month && entry.month !== targetMonth) {
      continue;
    }
    
    const mode = entry.mode as GameMode;
    if (!statsMap.has(entry.id)) {
      statsMap.set(entry.id, { arcade: undefined, historical: undefined, simulation: undefined });
    }
    const modeRecord = statsMap.get(entry.id)!;
    modeRecord[mode] = entry;
  }

  return statsMap;
}

/**
 * Convert StatShark entry to VehicleStats
 */
export function convertToVehicleStats(entry: StatSharkEntry | undefined): VehicleStats | undefined {
  if (!entry) return undefined;
  return {
    battles: entry.battles,
    winRate: entry.win_rate,
    killPerSpawn: entry.avg_kills_per_spawn,
    expPerSpawn: entry.exp_per_spawn,
  };
}

// ============================================================================
// Month Range Aggregation Functions
// ============================================================================

/**
 * Aggregate multiple StatShark entries into one using weighted average
 * Weight = battles count
 */
function aggregateStatSharkEntries(entries: StatSharkEntry[]): StatSharkEntry | undefined {
  if (entries.length === 0) return undefined;
  if (entries.length === 1) return entries[0];
  
  // Sum battles
  const totalBattles = entries.reduce((sum, e) => sum + e.battles, 0);
  if (totalBattles === 0) return undefined;
  
  // Weighted average for win_rate and avg_kills_per_spawn
  const weightedWinRate = entries.reduce((sum, e) => sum + e.win_rate * e.battles, 0) / totalBattles;
  const weightedKillsPerSpawn = entries.reduce((sum, e) => sum + e.avg_kills_per_spawn * e.battles, 0) / totalBattles;
  
  // Weighted average for exp_per_spawn (only if all entries have it)
  let weightedExpPerSpawn: number | undefined;
  const entriesWithExp = entries.filter(e => e.exp_per_spawn !== undefined);
  if (entriesWithExp.length === entries.length) {
    const totalBattlesWithExp = entriesWithExp.reduce((sum, e) => sum + e.battles, 0);
    if (totalBattlesWithExp > 0) {
      weightedExpPerSpawn = entriesWithExp.reduce((sum, e) => sum + (e.exp_per_spawn ?? 0) * e.battles, 0) / totalBattlesWithExp;
    }
  }
  
  // Use first entry as base, override with aggregated values
  const base = entries[0];
  return {
    ...base,
    battles: totalBattles,
    win_rate: weightedWinRate,
    avg_kills_per_spawn: weightedKillsPerSpawn,
    exp_per_spawn: weightedExpPerSpawn,
    // Use the last month's rank/br if available
    rank: entries[entries.length - 1].rank ?? base.rank,
    br: entries[entries.length - 1].br ?? base.br,
  };
}

/**
 * Build StatShark stats map grouped by game mode with month range aggregation
 * Returns a map of vehicleId -> Record<GameMode, StatSharkEntry>
 * @param stats - Array of StatShark entries
 * @param range - Month range to aggregate. If single month, behaves like buildStatsMapByMode.
 */
export function buildStatsMapByMonthRange(
  stats: StatSharkEntry[], 
  range?: StatsMonthRange
): Map<string, Record<GameMode, StatSharkEntry | undefined>> {
  const targetRange = range ?? getDefaultStatsMonthRange();
  
  // Optimization: if single month range, use simpler logic
  if (isSingleMonthRange(targetRange)) {
    return buildStatsMapByMode(stats, targetRange.startMonth);
  }
  
  // Get all months in range
  const monthsInRange = new Set(getMonthsInRange(targetRange));
  
  // Group entries by (vehicleId, mode, month)
  // vehicleId -> mode -> month -> entry
  const groupedEntries = new Map<string, Map<GameMode, Map<string, StatSharkEntry>>>();
  
  for (const entry of stats) {
    // Filter by month range
    if (!entry.month || !monthsInRange.has(entry.month as StatsMonthId)) {
      continue;
    }
    
    const mode = entry.mode as GameMode;
    
    if (!groupedEntries.has(entry.id)) {
      groupedEntries.set(entry.id, new Map());
    }
    const modeMap = groupedEntries.get(entry.id)!;
    
    if (!modeMap.has(mode)) {
      modeMap.set(mode, new Map());
    }
    const monthMap = modeMap.get(mode)!;
    
    monthMap.set(entry.month, entry);
  }
  
  // Aggregate entries for each (vehicleId, mode)
  const statsMap = new Map<string, Record<GameMode, StatSharkEntry | undefined>>();
  
  for (const [vehicleId, modeMap] of groupedEntries) {
    const modeRecord: Record<GameMode, StatSharkEntry | undefined> = {
      arcade: undefined,
      historical: undefined,
      simulation: undefined,
    };
    
    for (const [mode, monthMap] of modeMap) {
      const entries = Array.from(monthMap.values());
      modeRecord[mode] = aggregateStatSharkEntries(entries);
    }
    
    statsMap.set(vehicleId, modeRecord);
  }
  
  return statsMap;
}
