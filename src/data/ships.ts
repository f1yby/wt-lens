import type { ShipVehicle, ShipType, VehicleStats, GameMode, StatsMonthRange, EconomyData } from '../types';
import { getDefaultStatsMonthRange, getMonthRangeCacheKey } from '../types';
import { StatSharkEntry, cleanName, buildStatsMapByMonthRange, convertToVehicleStats } from './base';
import { initStatsMonthService, isServiceInitialized } from '../services/statsMonthService';

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
  economy?: EconomyData;
}

// Cache for loaded raw data
let statsData: StatSharkEntry[] | null = null;
let shipsData: ShipEntry[] | null = null;
// Cache for merged ships by month range (key: startMonth_endMonth)
const shipsByMonthRange = new Map<string, ShipVehicle[]>();

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
 * Load ship data from JSON
 */
async function loadShipsData(): Promise<ShipEntry[]> {
  if (shipsData) return shipsData;
  const response = await fetch('/wt-lens/data/ships.json');
  shipsData = await response.json();
  return shipsData!;
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
      economy: shipEntry.economy,
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
  // Load stats data first to ensure month service is initialized
  const stats = await loadStatsData();
  
  const targetRange = range ?? getDefaultStatsMonthRange();
  const cacheKey = getMonthRangeCacheKey(targetRange);
  
  // Check if already cached for this month range
  if (shipsByMonthRange.has(cacheKey)) {
    return shipsByMonthRange.get(cacheKey)!;
  }

  const ships = await loadShipsData();

  const merged = mergeShipsData(stats, ships, targetRange);
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
