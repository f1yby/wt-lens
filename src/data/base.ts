/**
 * Base module for shared data loading utilities.
 * Contains common types and functions used by vehicles, aircraft, and ships data modules.
 */
import type { GameMode, VehicleStats, StatsMonthId, StatsMonthRange } from '../types';
import { getDefaultStatsMonth, getDefaultStatsMonthRange, getMonthsInRange, isSingleMonthRange } from '../types';
import { initStatsMonthService, isServiceInitialized } from '../services/statsMonthService';
import { loadPackagedIndex, loadPackagedStatsForRange } from './statsPackaged';

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
  vehicleIds: string[];   // All vehicle IDs that have stats data
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

/**
 * Load stats meta from packaged index (alternative to stats-meta.json).
 * Uses the pre-packaged stats index file.
 */
export async function loadStatsMetaFromPackaged(): Promise<StatsMeta> {
  if (_statsMeta) return _statsMeta;
  if (_statsMetaPromise) return _statsMetaPromise;

  _statsMetaPromise = (async () => {
    const index = await loadPackagedIndex();
    
    // Convert packaged month format to diff_ format
    // 2026-february-march -> diff_2026_february_march
    const months = index.months.map(m => `diff_${m.replace(/-/g, '_')}`);
    const latestMonth = `diff_${index.latestMonth.replace(/-/g, '_')}`;
    
    const meta: StatsMeta = {
      months,
      latestMonth,
      vehicleIds: [], // Not needed for packaged mode
    };
    
    _statsMeta = meta;

    // Initialize stats month service from the month list
    if (!isServiceInitialized()) {
      const stubs: StatSharkEntry[] = months.map(m => ({
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
// On-demand Stats Loading (from stats/{id}.json files)
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
 * Load stats data for the given month range.
 * Always loads from stats/{id}.json for all vehicles listed in stats-meta.
 * @deprecated Use loadPackagedStatsForCategory() instead for better performance.
 */
export async function loadStatsForRange(_range?: StatsMonthRange): Promise<StatSharkEntry[]> {
  // Always ensure meta is loaded first (this initializes statsMonthService)
  const meta = await loadStatsMeta();

  // Load from stats/{id}.json for ALL vehicles listed in meta
  return loadStatsHistoryBatch(meta.vehicleIds);
}

/**
 * Vehicle categories for packaged stats loading
 */
export type VehicleCategory = 'ground' | 'aircraft' | 'helicopter' | 'ship';

/**
 * Load packaged stats for a specific category and game mode.
 * This is the preferred way to load stats data - it loads a single pre-packaged file.
 * 
 * @param range - Month range to load
 * @param category - Vehicle category (ground, aircraft, helicopter, ship)
 * @param mode - Game mode (arcade, historical, simulation)
 */
export async function loadPackagedStatsForCategory(
  range: StatsMonthRange,
  category: VehicleCategory,
  mode: GameMode
): Promise<StatSharkEntry[]> {
  // Ensure meta is loaded first (initializes statsMonthService)
  await loadStatsMetaFromPackaged();
  
  return loadPackagedStatsForRange(range, category, mode);
}

/**
 * Load stats data for specific vehicle IDs only.
 * Much faster than loading all stats when you only need a few vehicles.
 */
export async function loadStatsForVehicles(vehicleIds: string[]): Promise<StatSharkEntry[]> {
  // Ensure meta is loaded first (initializes statsMonthService)
  await loadStatsMeta();
  
  // Load stats for only the requested vehicles
  return loadStatsHistoryBatch(vehicleIds);
}

// ============================================================================
// Backward-compatible shared stats loader
// ============================================================================

/**
 * @deprecated Use loadStatsForRange() instead for new code.
 * 
 * Load shared stats data. Delegates to loadStatsForRange().
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
