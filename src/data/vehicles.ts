import type { Vehicle, Ammunition, MainGun, PenetrationData, GameMode, VehicleStats, StatsMonthRange } from '../types';
import { DEFAULT_STATS_MONTH_RANGE, getMonthRangeCacheKey } from '../types';
import { StatSharkEntry, cleanName, buildStatsMapByMonthRange, convertToVehicleStats } from './base';

// Raw data types from JSON
interface DatamineEntry {
  id: string;
  name: string;
  localizedName: string;
  nation: string;
  rank: number;
  battle_rating: number;
  vehicle_type: string;
  economic_type: string;
  performance: {
    horsepower?: number | null;
    weight?: number | null;
    power_to_weight?: number | null;
    max_reverse_speed?: number | null;
    reload_time?: number | null;
    penetration?: number | null;
    max_speed?: number | null;
    crew_count?: number | null;
    elevation_speed?: number | null;
    traverse_speed?: number | null;
    has_stabilizer?: boolean | null;
    stabilizer_type?: string | null;
    elevation_range?: number[] | null;
    traverse_range?: number[] | null;
    gunner_thermal_resolution?: number[] | null;
    commander_thermal_resolution?: number[] | null;
    // Calculated metrics
    gunner_thermal_diagonal?: number | null;
    commander_thermal_diagonal?: number | null;
    stabilizer_value?: number | null;
    elevation_range_value?: number | null;
    // Ammunition data
    mainGun?: MainGun | null;
    ammunitions?: Ammunition[] | null;
    penetrationData?: PenetrationData | null;
    autoLoader?: boolean | null;
  };
  imageUrl: string;
  source: string;
  unreleased?: boolean;
  releaseDate?: string;
}

// Cache for loaded raw data
let statsData: StatSharkEntry[] | null = null;
let datamineData: DatamineEntry[] | null = null;
// Cache for merged vehicles by month range (key: startMonth_endMonth)
const vehiclesByMonthRange = new Map<string, Vehicle[]>();

/**
 * Load stats data from JSON
 */
async function loadStatsData(): Promise<StatSharkEntry[]> {
  if (statsData) return statsData;
  const response = await fetch('/wt-lens/data/stats.json');
  statsData = await response.json();
  return statsData!;
}

/**
 * Load datamine data from JSON
 */
async function loadDatamineData(): Promise<DatamineEntry[]> {
  if (datamineData) return datamineData;
  const response = await fetch('/wt-lens/data/datamine.json');
  datamineData = await response.json();
  return datamineData!;
}

/**
 * Build Datamine performance map
 */
function buildDatamineMap(datamine: DatamineEntry[]): Map<string, DatamineEntry> {
  const datamineMap = new Map<string, DatamineEntry>();
  
  for (const entry of datamine) {
    datamineMap.set(entry.id, entry);
  }
  
  return datamineMap;
}

/**
 * Merge StatShark and Datamine data by vehicle ID
 * @param stats - Array of StatShark entries
 * @param datamine - Array of datamine entries
 * @param range - Optional month range filter for stats data
 */
function mergeVehicleData(stats: StatSharkEntry[], datamine: DatamineEntry[], range?: StatsMonthRange): Vehicle[] {
  const statsMapByMode = buildStatsMapByMonthRange(stats, range);
  const datamineMap = buildDatamineMap(datamine);

  // Get all unique vehicle IDs
  const allIds = new Set([...statsMapByMode.keys(), ...datamineMap.keys()]);

  const vehicles: Vehicle[] = [];

  for (const id of allIds) {
    const statsByMode = statsMapByMode.get(id);
    const datamineEntry = datamineMap.get(id);

    // Skip if no datamine data (we need performance data)
    if (!datamineEntry) continue;

    // Build stats by mode record
    const statsByModeRecord: Record<GameMode, VehicleStats | undefined> = {
      arcade: convertToVehicleStats(statsByMode?.arcade),
      historical: convertToVehicleStats(statsByMode?.historical),
      simulation: convertToVehicleStats(statsByMode?.simulation),
    };

    // Use historical mode as default stats for backward compatibility
    const defaultStats = statsByModeRecord.historical;

    const vehicle: Vehicle = {
      id,
      name: datamineEntry.name,
      localizedName: cleanName(datamineEntry.localizedName),
      nation: datamineEntry.nation as Vehicle['nation'],
      rank: defaultStats ? (statsByMode?.historical?.rank ?? datamineEntry.rank ?? 1) : (datamineEntry.rank ?? 1),
      battleRating: defaultStats ? (statsByMode?.historical?.br ?? datamineEntry.battle_rating ?? 1.0) : (datamineEntry.battle_rating ?? 1.0),
      vehicleType: datamineEntry.vehicle_type as Vehicle['vehicleType'],
      economicType: (datamineEntry.economic_type as Vehicle['economicType']) ?? 'regular',
      performance: {
        horsepower: datamineEntry.performance.horsepower ?? 0,
        weight: datamineEntry.performance.weight ?? 0,
        powerToWeight: datamineEntry.performance.power_to_weight ?? 0,
        maxReverseSpeed: datamineEntry.performance.max_reverse_speed ?? 0,
        reloadTime: datamineEntry.performance.reload_time ?? 0,
        penetration: datamineEntry.performance.penetration ?? 0,
        maxSpeed: datamineEntry.performance.max_speed ?? 0,
        crewCount: datamineEntry.performance.crew_count ?? 0,
        elevationSpeed: datamineEntry.performance.elevation_speed ?? 0,
        traverseSpeed: datamineEntry.performance.traverse_speed ?? 0,
        hasStabilizer: datamineEntry.performance.has_stabilizer ?? false,
        stabilizerType: (datamineEntry.performance.stabilizer_type as 'none' | 'horizontal' | 'vertical' | 'both') ?? 'none',
        elevationRange: (datamineEntry.performance.elevation_range as [number, number]) ?? [0, 0],
        traverseRange: (datamineEntry.performance.traverse_range as [number, number]) ?? [0, 0],
        gunnerThermalResolution: (datamineEntry.performance.gunner_thermal_resolution as [number, number]) ?? [0, 0],
        commanderThermalResolution: (datamineEntry.performance.commander_thermal_resolution as [number, number]) ?? [0, 0],
        // Calculated metrics
        gunnerThermalDiagonal: datamineEntry.performance.gunner_thermal_diagonal ?? 0,
        commanderThermalDiagonal: datamineEntry.performance.commander_thermal_diagonal ?? 0,
        stabilizerValue: datamineEntry.performance.stabilizer_value ?? 0,
        elevationRangeValue: datamineEntry.performance.elevation_range_value ?? 0,
        // Ammunition data
        mainGun: datamineEntry.performance.mainGun ?? undefined,
        ammunitions: datamineEntry.performance.ammunitions ?? undefined,
        penetrationData: datamineEntry.performance.penetrationData ?? undefined,
        autoLoader: datamineEntry.performance.autoLoader ?? undefined,
      },
      // Backward compatibility: use historical mode as default
      stats: defaultStats,
      // New: stats broken down by game mode
      statsByMode: statsByModeRecord,
      imageUrl: datamineEntry.imageUrl,
      unreleased: datamineEntry.unreleased ?? false,
      releaseDate: datamineEntry.releaseDate,
    };

    vehicles.push(vehicle);
  }

  return vehicles;
}

/**
 * Load all vehicles data (async)
 * @param range - Optional month range filter. Defaults to latest month if not specified.
 */
export async function loadVehicles(range?: StatsMonthRange): Promise<Vehicle[]> {
  const targetRange = range ?? DEFAULT_STATS_MONTH_RANGE;
  const cacheKey = getMonthRangeCacheKey(targetRange);
  
  // Check if already cached for this month range
  if (vehiclesByMonthRange.has(cacheKey)) {
    return vehiclesByMonthRange.get(cacheKey)!;
  }

  const [stats, datamine] = await Promise.all([
    loadStatsData(),
    loadDatamineData(),
  ]);

  const vehicles = mergeVehicleData(stats, datamine, targetRange);
  vehiclesByMonthRange.set(cacheKey, vehicles);
  return vehicles;
}

/**
 * Get vehicle stats for a specific game mode
 * Returns the stats for the given mode, or falls back to default stats
 */
export function getVehicleStatsByMode(vehicle: Vehicle, mode: GameMode): VehicleStats | undefined {
  // First try to get mode-specific stats
  if (vehicle.statsByMode?.[mode]) {
    return vehicle.statsByMode[mode];
  }
  // Fall back to default stats (historical mode for backward compatibility)
  return vehicle.stats;
}

