import type { AircraftVehicle, AircraftType, VehicleStats, GameMode, StatsMonthRange, EconomyData, AircraftWeapons } from '../types';
import { getDefaultStatsMonthRange, getMonthRangeCacheKey } from '../types';
import { StatSharkEntry, cleanName, buildStatsMapByMonthRange, convertToVehicleStats, loadStatsForRange, loadPackagedStatsForCategory, VehicleCategory } from './base';

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
  // economy is NOT included in the index — load via loadAircraftDetail()
}

/** Detail entry loaded from aircrafts/{id}.json */
export interface AircraftDetailEntry {
  id: string;
  economy?: EconomyData;
  weapons?: AircraftWeapons;
}

// Cache for loaded raw data
let aircraftData: AircraftEntry[] | null = null;
// Cache for merged aircraft by month range (key: startMonth_endMonth)
const aircraftByMonthRange = new Map<string, AircraftVehicle[]>();
// Cache for individual aircraft detail data
const aircraftDetailCache = new Map<string, AircraftDetailEntry>();

/**
 * Load aircraft data from aircraft-index.json (lightweight, no economy).
 */
async function loadAircraftData(): Promise<AircraftEntry[]> {
  if (aircraftData) return aircraftData;
  const response = await fetch('/wt-lens/data/aircraft-index.json');
  if (!response.ok) {
    throw new Error(`Failed to load aircraft index: ${response.status}`);
  }
  aircraftData = await response.json();
  return aircraftData!;
}

/**
 * Load individual aircraft detail (economy data) from aircrafts/{id}.json
 */
export async function loadAircraftDetail(aircraftId: string): Promise<AircraftDetailEntry | null> {
  if (aircraftDetailCache.has(aircraftId)) {
    return aircraftDetailCache.get(aircraftId)!;
  }
  
  try {
    const response = await fetch(`/wt-lens/data/aircrafts/${aircraftId}.json`);
    if (!response.ok) {
      console.warn(`Failed to load aircraft detail for ${aircraftId}: ${response.status}`);
      return null;
    }
    const detail: AircraftDetailEntry = await response.json();
    aircraftDetailCache.set(aircraftId, detail);
    return detail;
  } catch (error) {
    console.warn(`Failed to load detail for ${aircraftId}:`, error);
    return null;
  }
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
      // economy is loaded on demand via loadAircraftDetail()
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
  // Load stats (this also ensures statsMonthService is initialized via loadStatsMeta)
  const stats = await loadStatsForRange(range);

  // Re-resolve range AFTER service is initialized
  const resolvedRange = (range && range.startMonth && range.endMonth)
    ? range
    : getDefaultStatsMonthRange();
  const cacheKey = getMonthRangeCacheKey(resolvedRange);
  
  // Check if already cached for this month range
  if (aircraftByMonthRange.has(cacheKey)) {
    return aircraftByMonthRange.get(cacheKey)!;
  }

  const aircraft = await loadAircraftData();

  const merged = mergeAircraftData(stats, aircraft, resolvedRange);
  aircraftByMonthRange.set(cacheKey, merged);
  return merged;
}

/**
 * Load aircraft with packaged stats (faster than loadAircraft).
 * Loads stats from pre-packaged files organized by month, category, and mode.
 * 
 * @param range - Month range to load
 * @param mode - Game mode to load (arcade, historical, simulation)
 * @param isHelicopter - If true, loads helicopter stats; otherwise loads fixed-wing aircraft
 */
export async function loadAircraftWithPackagedStats(
  range: StatsMonthRange,
  mode: GameMode,
  isHelicopter: boolean = false
): Promise<AircraftVehicle[]> {
  const resolvedRange = (range && range.startMonth && range.endMonth)
    ? range
    : getDefaultStatsMonthRange();
  
  const cacheKey = `${getMonthRangeCacheKey(resolvedRange)}-${mode}-${isHelicopter ? 'heli' : 'fixed'}`;
  
  if (aircraftByMonthRange.has(cacheKey)) {
    return aircraftByMonthRange.get(cacheKey)!;
  }

  // Load packaged stats
  const category: VehicleCategory = isHelicopter ? 'helicopter' : 'aircraft';
  const stats = await loadPackagedStatsForCategory(resolvedRange, category, mode);

  const aircraft = await loadAircraftData();
  
  // Filter by aircraft type
  const filteredAircraft = isHelicopter
    ? aircraft.filter(a => a.aircraftType === 'helicopter')
    : aircraft.filter(a => a.aircraftType !== 'helicopter');

  // Build stats map
  const statsMap = new Map<string, StatSharkEntry>();
  for (const entry of stats) {
    statsMap.set(entry.id, entry);
  }

  // Merge stats into aircraft
  const merged: AircraftVehicle[] = filteredAircraft.map(aircraftEntry => {
    const entry = statsMap.get(aircraftEntry.id);
    
    const vehicleStats = entry ? convertToVehicleStats(entry) : undefined;
    const statsByModeRecord: Record<GameMode, VehicleStats | undefined> = {
      arcade: mode === 'arcade' ? vehicleStats : undefined,
      historical: mode === 'historical' ? vehicleStats : undefined,
      simulation: mode === 'simulation' ? vehicleStats : undefined,
    };

    return {
      id: aircraftEntry.id,
      name: aircraftEntry.name,
      localizedName: cleanName(aircraftEntry.localizedName),
      nation: aircraftEntry.nation as AircraftVehicle['nation'],
      rank: entry?.rank ?? aircraftEntry.rank ?? 1,
      battleRating: entry?.br ?? aircraftEntry.battleRating ?? 1.0,
      groundBattleRating: aircraftEntry.groundBattleRating,
      aircraftType: aircraftEntry.aircraftType as AircraftType,
      economicType: (aircraftEntry.economicType as AircraftVehicle['economicType']) ?? 'regular',
      performance: undefined,
      stats: vehicleStats,
      statsByMode: statsByModeRecord,
      imageUrl: aircraftEntry.imageUrl,
      unreleased: aircraftEntry.unreleased ?? false,
      releaseDate: aircraftEntry.releaseDate,
      ghost: aircraftEntry.ghost ?? false,
    };
  });

  aircraftByMonthRange.set(cacheKey, merged);
  return merged;
}

// Cache for light aircraft list (no stats)
let lightAircraftCache: AircraftVehicle[] | null = null;

/**
 * Load lightweight aircraft list without stats.
 * Used for detail pages to reduce initial load time.
 */
export async function loadAircraftLight(): Promise<AircraftVehicle[]> {
  if (lightAircraftCache) return lightAircraftCache;
  
  const aircraft = await loadAircraftData();
  
  const vehicles: AircraftVehicle[] = aircraft.map(entry => ({
    id: entry.id,
    name: entry.name,
    localizedName: cleanName(entry.localizedName),
    nation: entry.nation as AircraftVehicle['nation'],
    rank: entry.rank ?? 1,
    battleRating: entry.battleRating ?? 1.0,
    groundBattleRating: entry.groundBattleRating,
    aircraftType: entry.aircraftType as AircraftType,
    economicType: (entry.economicType as AircraftVehicle['economicType']) ?? 'regular',
    performance: undefined,
    stats: undefined,
    statsByMode: undefined,
    imageUrl: entry.imageUrl,
    unreleased: entry.unreleased ?? false,
    releaseDate: entry.releaseDate,
    ghost: entry.ghost ?? false,
  }));
  
  lightAircraftCache = vehicles;
  return vehicles;
}

/**
 * Merge packaged stats into existing aircraft array for specific IDs.
 * Used for detail pages to load stats on demand.
 */
export async function mergePackagedStatsForAircraft(
  aircraft: AircraftVehicle[],
  vehicleIds: string[],
  range: StatsMonthRange,
  mode: GameMode,
): Promise<AircraftVehicle[]> {
  if (vehicleIds.length === 0) return aircraft;
  
  const resolvedRange = (range && range.startMonth && range.endMonth)
    ? range
    : getDefaultStatsMonthRange();
  
  // Load packaged stats (need both fixed-wing and helicopter for potential mixed requests)
  const statsPromises: Promise<StatSharkEntry[]>[] = [];
  const categories: VehicleCategory[] = ['aircraft', 'helicopter'];
  
  for (const category of categories) {
    statsPromises.push(loadPackagedStatsForCategory(resolvedRange, category, mode));
  }
  
  const statsArrays = await Promise.all(statsPromises);
  const allStats = statsArrays.flat();
  
  // Build stats map
  const statsMap = new Map<string, StatSharkEntry>();
  for (const entry of allStats) {
    statsMap.set(entry.id, entry);
  }
  
  // Merge stats into aircraft (only for requested IDs)
  return aircraft.map(a => {
    if (!vehicleIds.includes(a.id)) return a;
    
    const entry = statsMap.get(a.id);
    if (!entry) return a;
    
    const vehicleStats = convertToVehicleStats(entry);
    const statsByModeRecord: Record<GameMode, VehicleStats | undefined> = {
      arcade: mode === 'arcade' ? vehicleStats : undefined,
      historical: mode === 'historical' ? vehicleStats : undefined,
      simulation: mode === 'simulation' ? vehicleStats : undefined,
    };
    
    return {
      ...a,
      stats: vehicleStats,
      statsByMode: statsByModeRecord,
    };
  });
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
