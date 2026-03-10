import type { AircraftVehicle, AircraftType, VehicleStats, GameMode, StatsMonthRange, EconomyData } from '../types';
import { getDefaultStatsMonthRange, getMonthRangeCacheKey } from '../types';
import { StatSharkEntry, cleanName, buildStatsMapByMonthRange, convertToVehicleStats } from './base';
import { initStatsMonthService, isServiceInitialized } from '../services/statsMonthService';

interface AircraftEntry {
  id: string;
  name: string;
  localizedName: string;
  nation: string;
  rank: number;
  battleRating: number;
  groundBattleRating?: number;
  aircraftType: AircraftType;
  economicType: string;
  imageUrl: string;
  unreleased?: boolean;
  releaseDate?: string;
  ghost?: boolean;
  economy?: EconomyData;
}

// Cache for loaded raw data
let statsData: StatSharkEntry[] | null = null;
let aircraftData: AircraftEntry[] | null = null;
// Cache for merged aircraft by month range (key: startMonth_endMonth)
const aircraftByMonthRange = new Map<string, AircraftVehicle[]>();

/**
 * Load stats data from JSON
 */
async function loadStatsData(): Promise<StatSharkEntry[]> {
  if (statsData) return statsData;
  const response = await fetch('/wt-lens/data/stats.json');
  statsData = await response.json();
  
  // Initialize stats month service with loaded data
  if (!isServiceInitialized()) {
    initStatsMonthService(statsData!);
  }
  
  return statsData!;
}

/**
 * Load aircraft data from JSON
 */
async function loadAircraftData(): Promise<AircraftEntry[]> {
  if (aircraftData) return aircraftData;
  const response = await fetch('/wt-lens/data/aircraft.json');
  aircraftData = await response.json();
  return aircraftData!;
}

/**
 * Build aircraft data map
 */
function buildAircraftMap(aircraft: AircraftEntry[]): Map<string, AircraftEntry> {
  const aircraftMap = new Map<string, AircraftEntry>();
  
  for (const entry of aircraft) {
    aircraftMap.set(entry.id, entry);
  }
  
  return aircraftMap;
}

/**
 * Merge StatShark and aircraft data by vehicle ID
 * @param stats - Array of StatShark entries
 * @param aircraft - Array of aircraft entries
 * @param range - Optional month range filter for stats data
 */
function mergeAircraftData(stats: StatSharkEntry[], aircraft: AircraftEntry[], range?: StatsMonthRange): AircraftVehicle[] {
  const statsMapByMode = buildStatsMapByMonthRange(stats, range);
  const aircraftMap = buildAircraftMap(aircraft);

  // Get all unique aircraft IDs
  const allIds = new Set([...statsMapByMode.keys(), ...aircraftMap.keys()]);

  const aircraftList: AircraftVehicle[] = [];

  for (const id of allIds) {
    const statsByMode = statsMapByMode.get(id);
    const aircraftEntry = aircraftMap.get(id);

    // Skip if no aircraft data (we need basic info)
    if (!aircraftEntry) continue;

    // Build stats by mode record
    const statsByModeRecord: Record<GameMode, VehicleStats | undefined> = {
      arcade: convertToVehicleStats(statsByMode?.arcade),
      historical: convertToVehicleStats(statsByMode?.historical),
      simulation: convertToVehicleStats(statsByMode?.simulation),
    };

    // Use historical mode as default stats for backward compatibility
    const defaultStats = statsByModeRecord.historical;

    const aircraftVehicle: AircraftVehicle = {
      id,
      name: aircraftEntry.name,
      localizedName: cleanName(aircraftEntry.localizedName),
      nation: aircraftEntry.nation as AircraftVehicle['nation'],
      rank: defaultStats ? (statsByMode?.historical?.rank ?? aircraftEntry.rank ?? 1) : (aircraftEntry.rank ?? 1),
      battleRating: defaultStats ? (statsByMode?.historical?.br ?? aircraftEntry.battleRating ?? 1.0) : (aircraftEntry.battleRating ?? 1.0),
      groundBattleRating: aircraftEntry.groundBattleRating,
      aircraftType: aircraftEntry.aircraftType as AircraftType,
      economicType: (aircraftEntry.economicType as AircraftVehicle['economicType']) ?? 'regular',
      // Phase 1: No performance data from datamine
      performance: undefined,
      // Backward compatibility: use historical mode as default
      stats: defaultStats,
      // New: stats broken down by game mode
      statsByMode: statsByModeRecord,
      imageUrl: aircraftEntry.imageUrl,
      unreleased: aircraftEntry.unreleased ?? false,
      releaseDate: aircraftEntry.releaseDate,
      ghost: aircraftEntry.ghost ?? false,
      economy: aircraftEntry.economy,
    };

    aircraftList.push(aircraftVehicle);
  }

  return aircraftList;
}

/**
 * Load all aircraft data (async)
 * @param range - Optional month range filter. Defaults to latest month if not specified.
 */
export async function loadAircraft(range?: StatsMonthRange): Promise<AircraftVehicle[]> {
  // Load stats data first to ensure month service is initialized
  const stats = await loadStatsData();
  
  const targetRange = range ?? getDefaultStatsMonthRange();
  const cacheKey = getMonthRangeCacheKey(targetRange);
  
  // Check if already cached for this month range
  if (aircraftByMonthRange.has(cacheKey)) {
    return aircraftByMonthRange.get(cacheKey)!;
  }

  const aircraft = await loadAircraftData();

  const merged = mergeAircraftData(stats, aircraft, targetRange);
  aircraftByMonthRange.set(cacheKey, merged);
  return merged;
}

/**
 * Get aircraft stats for a specific game mode
 * Returns the stats for the given mode, or falls back to default stats
 */
export function getAircraftStatsByMode(aircraft: AircraftVehicle, mode: GameMode): VehicleStats | undefined {
  // First try to get mode-specific stats
  if (aircraft.statsByMode?.[mode]) {
    return aircraft.statsByMode[mode];
  }
  // Fall back to default stats (historical mode for backward compatibility)
  return aircraft.stats;
}

/**
 * Filter aircraft by various criteria
 */
export function filterAircraft(
  aircraft: AircraftVehicle[],
  options: {
    nations?: string[];
    minBR?: number;
    maxBR?: number;
    aircraftTypes?: AircraftType[];
    economicTypes?: string[];
  }
): AircraftVehicle[] {
  return aircraft.filter(a => {
    // Filter by nation
    if (options.nations?.length && !options.nations.includes(a.nation)) {
      return false;
    }

    // Filter by BR range
    if (options.minBR !== undefined && a.battleRating < options.minBR) {
      return false;
    }
    if (options.maxBR !== undefined && a.battleRating > options.maxBR) {
      return false;
    }

    // Filter by aircraft type
    if (options.aircraftTypes?.length && !options.aircraftTypes.includes(a.aircraftType)) {
      return false;
    }

    // Filter by economic type
    if (options.economicTypes?.length && !options.economicTypes.includes(a.economicType)) {
      return false;
    }

    return true;
  });
}

/**
 * Sort aircraft by BR and then by name
 */
export function sortAircraft(aircraft: AircraftVehicle[]): AircraftVehicle[] {
  return [...aircraft].sort((a, b) => {
    // Sort by BR first
    if (a.battleRating !== b.battleRating) {
      return a.battleRating - b.battleRating;
    }
    // Then by nation
    if (a.nation !== b.nation) {
      return a.nation.localeCompare(b.nation);
    }
    // Finally by localized name
    return a.localizedName.localeCompare(b.localizedName);
  });
}
