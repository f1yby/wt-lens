import type { ShipVehicle, ShipType, VehicleStats, GameMode, StatsMonthRange, EconomyData } from '../types';
import { getDefaultStatsMonthRange, getMonthRangeCacheKey } from '../types';
import { StatSharkEntry, cleanName, buildStatsMapByMonthRange, convertToVehicleStats, loadStatsForRange, loadPackagedStatsForCategory, VehicleCategory } from './base';

interface ShipEntry {
  id: string;
  name: string;
  localizedName: string;
  nation: string;
  rank: number;
  battleRating: number;
  shipType: ShipType;
  economicType: string;
  imageUrl: string;
  unreleased?: boolean;
  releaseDate?: string;
  ghost?: boolean;
  // economy is NOT included in the index — load via loadShipDetail()
}

/** Detail entry loaded from ships/{id}.json */
export interface ShipDetailEntry {
  id: string;
  economy?: EconomyData;
}

// Cache for loaded raw data
let shipsData: ShipEntry[] | null = null;
// Cache for merged ships by month range (key: startMonth_endMonth)
const shipsByMonthRange = new Map<string, ShipVehicle[]>();
// Cache for individual ship detail data
const shipDetailCache = new Map<string, ShipDetailEntry>();

/**
 * Load ship data from ships-index.json (lightweight, no economy).
 */
async function loadShipsData(): Promise<ShipEntry[]> {
  if (shipsData) return shipsData;
  const response = await fetch('/wt-lens/data/ships-index.json');
  if (!response.ok) {
    throw new Error(`Failed to load ships index: ${response.status}`);
  }
  shipsData = await response.json();
  return shipsData!;
}

/**
 * Load individual ship detail (economy data) from ships/{id}.json
 */
export async function loadShipDetail(shipId: string): Promise<ShipDetailEntry | null> {
  if (shipDetailCache.has(shipId)) {
    return shipDetailCache.get(shipId)!;
  }
  
  try {
    const response = await fetch(`/wt-lens/data/ships/${shipId}.json`);
    if (!response.ok) {
      console.warn(`Failed to load ship detail for ${shipId}: ${response.status}`);
      return null;
    }
    const detail: ShipDetailEntry = await response.json();
    shipDetailCache.set(shipId, detail);
    return detail;
  } catch (error) {
    console.warn(`Failed to load detail for ${shipId}:`, error);
    return null;
  }
}

/**
 * Build ship data map
 */
function buildShipsMap(ships: ShipEntry[]): Map<string, ShipEntry> {
  const shipsMap = new Map<string, ShipEntry>();
  
  for (const entry of ships) {
    shipsMap.set(entry.id, entry);
  }
  
  return shipsMap;
}

/**
 * Merge StatShark and ship data by vehicle ID
 * @param stats - Array of StatShark entries
 * @param ships - Array of ship entries
 * @param range - Optional month range filter for stats data
 */
function mergeShipsData(stats: StatSharkEntry[], ships: ShipEntry[], range?: StatsMonthRange): ShipVehicle[] {
  const statsMapByMode = buildStatsMapByMonthRange(stats, range);
  const shipsMap = buildShipsMap(ships);

  // Get all unique ship IDs
  const allIds = new Set([...statsMapByMode.keys(), ...shipsMap.keys()]);

  const shipsList: ShipVehicle[] = [];

  for (const id of allIds) {
    const statsByMode = statsMapByMode.get(id);
    const shipEntry = shipsMap.get(id);

    // Skip if no ship data (we need basic info)
    if (!shipEntry) continue;

    // Build stats by mode record
    const statsByModeRecord: Record<GameMode, VehicleStats | undefined> = {
      arcade: convertToVehicleStats(statsByMode?.arcade),
      historical: convertToVehicleStats(statsByMode?.historical),
      simulation: convertToVehicleStats(statsByMode?.simulation),
    };

    // Use historical mode as default stats for backward compatibility
    const defaultStats = statsByModeRecord.historical;

    const shipVehicle: ShipVehicle = {
      id,
      name: shipEntry.name,
      localizedName: cleanName(shipEntry.localizedName),
      nation: shipEntry.nation as ShipVehicle['nation'],
      rank: defaultStats ? (statsByMode?.historical?.rank ?? shipEntry.rank ?? 1) : (shipEntry.rank ?? 1),
      battleRating: defaultStats ? (statsByMode?.historical?.br ?? shipEntry.battleRating ?? 1.0) : (shipEntry.battleRating ?? 1.0),
      shipType: shipEntry.shipType as ShipType,
      economicType: (shipEntry.economicType as ShipVehicle['economicType']) ?? 'regular',
      // Phase 1: No performance data from datamine
      performance: undefined,
      // Backward compatibility: use historical mode as default
      stats: defaultStats,
      // New: stats broken down by game mode
      statsByMode: statsByModeRecord,
      imageUrl: shipEntry.imageUrl,
      unreleased: shipEntry.unreleased ?? false,
      releaseDate: shipEntry.releaseDate,
      ghost: shipEntry.ghost ?? false,
      // economy is loaded on demand via loadShipDetail()
    };

    shipsList.push(shipVehicle);
  }

  return shipsList;
}

/**
 * Load all ship data (async)
 * @param range - Optional month range filter. Defaults to latest month if not specified.
 */
export async function loadShips(range?: StatsMonthRange): Promise<ShipVehicle[]> {
  // Load stats (this also ensures statsMonthService is initialized via loadStatsMeta)
  const stats = await loadStatsForRange(range);

  // Re-resolve range AFTER service is initialized
  const resolvedRange = (range && range.startMonth && range.endMonth)
    ? range
    : getDefaultStatsMonthRange();
  const cacheKey = getMonthRangeCacheKey(resolvedRange);
  
  // Check if already cached for this month range
  if (shipsByMonthRange.has(cacheKey)) {
    return shipsByMonthRange.get(cacheKey)!;
  }

  const ships = await loadShipsData();

  const merged = mergeShipsData(stats, ships, resolvedRange);
  shipsByMonthRange.set(cacheKey, merged);
  return merged;
}

/**
 * Load ships with packaged stats (faster than loadShips).
 * Loads stats from pre-packaged files organized by month, category, and mode.
 * 
 * @param range - Month range to load
 * @param mode - Game mode to load (arcade, historical, simulation)
 */
export async function loadShipsWithPackagedStats(
  range: StatsMonthRange,
  mode: GameMode
): Promise<ShipVehicle[]> {
  const resolvedRange = (range && range.startMonth && range.endMonth)
    ? range
    : getDefaultStatsMonthRange();
  
  const cacheKey = `${getMonthRangeCacheKey(resolvedRange)}-${mode}`;
  
  if (shipsByMonthRange.has(cacheKey)) {
    return shipsByMonthRange.get(cacheKey)!;
  }

  // Load packaged stats
  const stats = await loadPackagedStatsForCategory(resolvedRange, 'ship' as VehicleCategory, mode);

  const ships = await loadShipsData();
  
  // Build stats map
  const statsMap = new Map<string, StatSharkEntry>();
  for (const entry of stats) {
    statsMap.set(entry.id, entry);
  }

  // Merge stats into ships
  const merged: ShipVehicle[] = ships.map(shipEntry => {
    const entry = statsMap.get(shipEntry.id);
    
    const vehicleStats = entry ? convertToVehicleStats(entry) : undefined;
    const statsByModeRecord: Record<GameMode, VehicleStats | undefined> = {
      arcade: mode === 'arcade' ? vehicleStats : undefined,
      historical: mode === 'historical' ? vehicleStats : undefined,
      simulation: mode === 'simulation' ? vehicleStats : undefined,
    };

    return {
      id: shipEntry.id,
      name: shipEntry.name,
      localizedName: cleanName(shipEntry.localizedName),
      nation: shipEntry.nation as ShipVehicle['nation'],
      rank: entry?.rank ?? shipEntry.rank ?? 1,
      battleRating: entry?.br ?? shipEntry.battleRating ?? 1.0,
      shipType: shipEntry.shipType as ShipType,
      economicType: (shipEntry.economicType as ShipVehicle['economicType']) ?? 'regular',
      performance: undefined,
      stats: vehicleStats,
      statsByMode: statsByModeRecord,
      imageUrl: shipEntry.imageUrl,
      unreleased: shipEntry.unreleased ?? false,
      releaseDate: shipEntry.releaseDate,
      ghost: shipEntry.ghost ?? false,
    };
  });

  shipsByMonthRange.set(cacheKey, merged);
  return merged;
}

/**
 * Get ship stats for a specific game mode
 * Returns the stats for the given mode, or falls back to default stats
 */
export function getShipStatsByMode(ship: ShipVehicle, mode: GameMode): VehicleStats | undefined {
  // First try to get mode-specific stats
  if (ship.statsByMode?.[mode]) {
    return ship.statsByMode[mode];
  }
  // Fall back to default stats (historical mode for backward compatibility)
  return ship.stats;
}

/**
 * Filter ships by various criteria
 */
export function filterShips(
  ships: ShipVehicle[],
  options: {
    nations?: string[];
    minBR?: number;
    maxBR?: number;
    shipTypes?: ShipType[];
    economicTypes?: string[];
  }
): ShipVehicle[] {
  return ships.filter(s => {
    // Filter by nation
    if (options.nations?.length && !options.nations.includes(s.nation)) {
      return false;
    }

    // Filter by BR range
    if (options.minBR !== undefined && s.battleRating < options.minBR) {
      return false;
    }
    if (options.maxBR !== undefined && s.battleRating > options.maxBR) {
      return false;
    }

    // Filter by ship type
    if (options.shipTypes?.length && !options.shipTypes.includes(s.shipType)) {
      return false;
    }

    // Filter by economic type
    if (options.economicTypes?.length && !options.economicTypes.includes(s.economicType)) {
      return false;
    }

    return true;
  });
}

/**
 * Sort ships by BR and then by name
 */
export function sortShips(ships: ShipVehicle[]): ShipVehicle[] {
  return [...ships].sort((a, b) => {
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
