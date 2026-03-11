/**
 * Base module for shared data loading utilities.
 * Contains common types and functions used by vehicles, aircraft, and ships data modules.
 */
import type { GameMode, VehicleStats, StatsMonthId, StatsMonthRange } from '../types';
import { getDefaultStatsMonth, getDefaultStatsMonthRange, getMonthsInRange, isSingleMonthRange } from '../types';
import { initStatsMonthService, isServiceInitialized } from '../services/statsMonthService';

/**
 * StatShark entry from stats data files
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
 * Stats meta from stats-meta.json (~1KB)
 */
interface StatsMeta {
  months: string[];       // Sorted month IDs (earliest → latest)
  latestMonth: string;    // The latest available month ID
}

// ============================================================================
// Stats Meta Loading (lightweight, for month service initialization)
// ============================================================================

let _statsMeta: StatsMeta | null = null;
let _statsMetaPromise: Promise<StatsMeta> | null = null;

/**
 * Load stats meta data (month list) from stats-meta.json (~1KB).
 * Initializes the statsMonthService so month pickers work immediately.
 */
export async function loadStatsMeta(): Promise<StatsMeta> {
  if (_statsMeta) return _statsMeta;
  if (_statsMetaPromise) return _statsMetaPromise;

  _statsMetaPromise = (async () => {
    const response = await fetch('/wt-lens/data/stats-meta.json');
    const meta: StatsMeta = await response.json();
    _statsMeta = meta;

    // Initialize stats month service from the month list
    // We create minimal StatSharkEntry stubs just to extract month IDs
    if (!isServiceInitialized()) {
      const stubs: StatSharkEntry[] = meta.months.map(m => ({
        id: '__meta__',
        name: '__meta__',
        mode: 'historical' as const,
        battles: 0,
        win_rate: 0,
        avg_kills_per_spawn: 0,
        month: m,
      }));
      initStatsMonthService(stubs);
    }

    return meta;
  })();

  return _statsMetaPromise;
}

// ============================================================================
// Stats Index Loading (latest month summary, for default list rendering)
// ============================================================================

let _statsIndexData: StatSharkEntry[] | null = null;
let _statsIndexPromise: Promise<StatSharkEntry[]> | null = null;

/**
 * Load stats-index.json (latest month stats for all vehicles).
 * Returns data in StatSharkEntry format for compatibility with existing merge logic.
 */
export async function loadStatsIndex(): Promise<StatSharkEntry[]> {
  if (_statsIndexData) return _statsIndexData;
  if (_statsIndexPromise) return _statsIndexPromise;

  // Ensure meta is loaded first (for month service)
  const metaPromise = loadStatsMeta();

  _statsIndexPromise = (async () => {
    const meta = await metaPromise;

    const response = await fetch('/wt-lens/data/stats-index.json');
    const rawData: Array<Record<string, unknown>> = await response.json();

    // Convert stats-index.json (snake_case, no month) → StatSharkEntry format
    _statsIndexData = rawData.map(entry => ({
      id: entry.id as string,
      name: entry.id as string,
      mode: entry.mode as StatSharkEntry['mode'],
      battles: entry.battles as number,
      win_rate: entry.win_rate as number,
      avg_kills_per_spawn: entry.avg_kills_per_spawn as number,
      exp_per_spawn: entry.exp_per_spawn as number | undefined,
      month: meta.latestMonth, // Tag with latest month for compatibility
    }));

    return _statsIndexData!;
  })();

  return _statsIndexPromise;
}

// ============================================================================
// On-demand Stats Loading (for month range aggregation)
// ============================================================================

/** Cache: vehicleId → StatsHistoryEntry[] (all months) */
const _vehicleStatsCache = new Map<string, StatSharkEntry[]>();

/**
 * Load stats history for a batch of vehicle IDs from stats/{id}.json.
 * Fetches are parallelized with concurrency control.
 * Returns all fetched entries as a flat StatSharkEntry[].
 */
async function loadStatsHistoryBatch(vehicleIds: string[]): Promise<StatSharkEntry[]> {
  const uncachedIds = vehicleIds.filter(id => !_vehicleStatsCache.has(id));

  if (uncachedIds.length > 0) {
    // Parallel fetch with batching (50 concurrent)
    const BATCH_SIZE = 50;
    for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
      const batch = uncachedIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (id) => {
          const resp = await fetch(`/wt-lens/data/stats/${id}.json`);
          if (!resp.ok) return { id, entries: [] as StatSharkEntry[] };
          const entries: StatSharkEntry[] = await resp.json();
          return { id, entries };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          _vehicleStatsCache.set(result.value.id, result.value.entries);
        }
      }
    }
  }

  // Collect all entries for requested IDs
  const allEntries: StatSharkEntry[] = [];
  for (const id of vehicleIds) {
    const cached = _vehicleStatsCache.get(id);
    if (cached) {
      allEntries.push(...cached);
    }
  }
  return allEntries;
}

/**
 * Load stats data appropriate for the given month range.
 * - Default / single latest month → uses stats-index.json (fast, already loaded)
 * - Multi-month range → fetches stats/{id}.json for all vehicles that have index data
 */
export async function loadStatsForRange(range?: StatsMonthRange): Promise<StatSharkEntry[]> {
  const meta = await loadStatsMeta();
  const targetRange = range ?? getDefaultStatsMonthRange();

  // If single month and it's the latest → use stats-index (fast path)
  if (isSingleMonthRange(targetRange) && targetRange.startMonth === meta.latestMonth) {
    return loadStatsIndex();
  }

  // Need historical data: load from stats/{id}.json for ALL vehicles
  // First get the vehicle IDs from stats-index (they represent all vehicles with stats)
  const indexData = await loadStatsIndex();
  const vehicleIds = [...new Set(indexData.map(e => e.id))];

  return loadStatsHistoryBatch(vehicleIds);
}

// ============================================================================
// Backward-compatible shared stats loader
// ============================================================================

/**
 * @deprecated Use loadStatsForRange() instead for new code.
 * 
 * Load shared stats data. For backward compatibility, this loads the stats-index
 * (latest month) by default. Pass a range to load historical data.
 */
export async function loadSharedStatsData(range?: StatsMonthRange): Promise<StatSharkEntry[]> {
  return loadStatsForRange(range);
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
