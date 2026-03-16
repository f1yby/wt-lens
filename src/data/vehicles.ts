import type { Vehicle, Ammunition, MainGun, PenetrationData, GameMode, VehicleStats, StatsMonthRange, EconomyData, VehicleIndexEntry, VehicleDetailEntry, StatsHistoryEntry } from '../types';
import { getDefaultStatsMonthRange, getMonthRangeCacheKey } from '../types';
import { StatSharkEntry, cleanName, buildStatsMapByMonthRange, convertToVehicleStats, loadStatsForRange, loadStatsForVehicles } from './base';

// Raw data types from JSON
interface DatamineEntry {
  id: string;
  name: string;
  localizedName: string;
  nation: string;
  rank: number;
  battle_rating: number;
  br?: Record<GameMode, number>;
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
    // Extended fields
    engine_manufacturer?: string | null;
    engine_model?: string | null;
    engine_type?: string | null;
    engine_max_rpm?: number | null;
    transmission_manufacturer?: string | null;
    transmission_model?: string | null;
    transmission_type?: string | null;
    forward_gears?: number | null;
    reverse_gears?: number | null;
    forward_gear_speeds?: number[] | null;
    reverse_gear_speeds?: number[] | null;
    steer_type?: string | null;
    empty_weight?: number | null;
    track_width?: number | null;
    secondary_weapons?: {
      trigger: string;
      name: string;
      caliber: number;
      ammo: number;
      bulletType?: string;
      reloadTime?: number;
      rateOfFire?: number;
      penetration?: number;
      maxDistance?: number;
      maxSpeed?: number;
      guidanceType?: string;
      explosiveMass?: number;
      explosiveType?: string;
    }[] | null;
    main_gun_ammo?: number | null;
    driver_nv_resolution?: number[] | null;
    has_smoke_grenades?: boolean | null;
    has_ess?: boolean | null;
    has_laser_rangefinder?: boolean | null;
  };
  imageUrl: string;
  source: string;
  unreleased?: boolean;
  releaseDate?: string;
  ghost?: boolean;
  economy?: EconomyData;
}

// Cache for loaded raw data
let datamineData: DatamineEntry[] | null = null;
// Cache for merged vehicles by month range (key: startMonth_endMonth)
const vehiclesByMonthRange = new Map<string, Vehicle[]>();

// ============================================================
// Split Data Caches (for optimized loading)
// ============================================================
let vehicleIndexData: VehicleIndexEntry[] | null = null;
const vehicleDetailCache = new Map<string, VehicleDetailEntry>();
const vehicleStatsHistoryCache = new Map<string, StatsHistoryEntry[]>();

/**
 * Load datamine data with performance.
 * This is needed for comparison charts that require performance data from all vehicles.
 */
async function loadDatamineData(): Promise<DatamineEntry[]> {
  if (datamineData) return datamineData;

  const index = await loadVehicleIndex();

  // Try to load performance summary file first (faster)
  try {
    const response = await fetch('/wt-lens/data/vehicles-performance.json');
    if (response.ok) {
      const performanceData: Array<{ id: string; performance: DatamineEntry['performance'] }> = await response.json();
      const performanceMap = new Map(performanceData.map(p => [p.id, p.performance]));

      datamineData = index.map(entry => ({
        id: entry.id,
        name: entry.name,
        localizedName: entry.localizedName,
        nation: entry.nation,
        rank: entry.rank,
        battle_rating: entry.battleRating,
        br: entry.br,
        vehicle_type: entry.vehicleType,
        economic_type: entry.economicType,
        performance: performanceMap.get(entry.id) ?? {},
        imageUrl: entry.imageUrl ?? '',
        source: 'split_index',
        unreleased: entry.unreleased,
        releaseDate: entry.releaseDate,
        ghost: entry.ghost,
      }));

      return datamineData!;
    }
  } catch {
    // Fall through to load individual files
  }

  // Fallback: load individual detail files
  const detailPromises = index.map(async entry => {
    try {
      const response = await fetch(`/wt-lens/data/vehicles/${entry.id}.json`);
      if (!response.ok) return { id: entry.id, performance: {} };
      const detail = await response.json();
      return { id: entry.id, performance: detail.performance ?? {} };
    } catch {
      return { id: entry.id, performance: {} };
    }
  });

  const details = await Promise.all(detailPromises);
  const detailMap = new Map(details.map(d => [d.id, d.performance]));

  datamineData = index.map(entry => ({
    id: entry.id,
    name: entry.name,
    localizedName: entry.localizedName,
    nation: entry.nation,
    rank: entry.rank,
    battle_rating: entry.battleRating,
    br: entry.br,
    vehicle_type: entry.vehicleType,
    economic_type: entry.economicType,
    performance: detailMap.get(entry.id) ?? {},
    imageUrl: entry.imageUrl ?? '',
    source: 'split_index',
    unreleased: entry.unreleased,
    releaseDate: entry.releaseDate,
    ghost: entry.ghost,
  }));

  return datamineData!;
}

// ============================================================
// Split Mode Loading Functions
// ============================================================

/**
 * Load vehicle index (lightweight, for list rendering)
 */
export async function loadVehicleIndex(): Promise<VehicleIndexEntry[]> {
  if (vehicleIndexData) return vehicleIndexData;
  
  const response = await fetch('/wt-lens/data/vehicles-index.json');
  if (!response.ok) {
    throw new Error(`Failed to load vehicle index: ${response.status}`);
  }
  const rawData: Array<Record<string, unknown>> = await response.json();
  // Map snake_case JSON fields to camelCase VehicleIndexEntry
  vehicleIndexData = rawData.map(entry => ({
    id: entry.id as string,
    name: entry.name as string,
    localizedName: entry.localizedName as string,
    nation: entry.nation as VehicleIndexEntry['nation'],
    rank: entry.rank as number,
    battleRating: (entry.battleRating ?? entry.battle_rating) as number,
    br: entry.br as VehicleIndexEntry['br'],
    vehicleType: (entry.vehicleType ?? entry.vehicle_type) as VehicleIndexEntry['vehicleType'],
    economicType: (entry.economicType ?? entry.economic_type) as VehicleIndexEntry['economicType'],
    imageUrl: entry.imageUrl as string | undefined,
    unreleased: entry.unreleased as boolean | undefined,
    releaseDate: entry.releaseDate as string | undefined,
    ghost: entry.ghost as boolean | undefined,
  }));
  return vehicleIndexData;
}

/**
 * Convert raw snake_case performance data to camelCase Vehicle['performance']
 */
function convertPerformance(raw: DatamineEntry['performance']): Vehicle['performance'] {
  return {
    horsepower: raw.horsepower ?? 0,
    weight: raw.weight ?? 0,
    powerToWeight: raw.power_to_weight ?? 0,
    maxReverseSpeed: raw.max_reverse_speed ?? 0,
    reloadTime: raw.reload_time ?? 0,
    penetration: raw.penetration ?? 0,
    maxSpeed: raw.max_speed ?? 0,
    crewCount: raw.crew_count ?? 0,
    elevationSpeed: raw.elevation_speed ?? 0,
    traverseSpeed: raw.traverse_speed ?? 0,
    hasStabilizer: raw.has_stabilizer ?? false,
    stabilizerType: (raw.stabilizer_type as 'none' | 'horizontal' | 'vertical' | 'both') ?? 'none',
    elevationRange: (raw.elevation_range as [number, number]) ?? [0, 0],
    traverseRange: (raw.traverse_range as [number, number]) ?? [0, 0],
    gunnerThermalResolution: (raw.gunner_thermal_resolution as [number, number]) ?? [0, 0],
    commanderThermalResolution: (raw.commander_thermal_resolution as [number, number]) ?? [0, 0],
    gunnerThermalDiagonal: raw.gunner_thermal_diagonal ?? 0,
    commanderThermalDiagonal: raw.commander_thermal_diagonal ?? 0,
    stabilizerValue: raw.stabilizer_value ?? 0,
    elevationRangeValue: raw.elevation_range_value ?? 0,
    mainGun: raw.mainGun ?? undefined,
    ammunitions: raw.ammunitions ?? undefined,
    penetrationData: raw.penetrationData ?? undefined,
    autoLoader: raw.autoLoader ?? undefined,
    engineManufacturer: raw.engine_manufacturer ?? undefined,
    engineModel: raw.engine_model ?? undefined,
    engineType: raw.engine_type ?? undefined,
    engineMaxRpm: raw.engine_max_rpm ?? undefined,
    transmissionManufacturer: raw.transmission_manufacturer ?? undefined,
    transmissionModel: raw.transmission_model ?? undefined,
    transmissionType: raw.transmission_type ?? undefined,
    forwardGears: raw.forward_gears ?? undefined,
    reverseGears: raw.reverse_gears ?? undefined,
    forwardGearSpeeds: raw.forward_gear_speeds ?? undefined,
    reverseGearSpeeds: raw.reverse_gear_speeds ?? undefined,
    steerType: raw.steer_type ?? undefined,
    emptyWeight: raw.empty_weight ?? undefined,
    trackWidth: raw.track_width ?? undefined,
    secondaryWeapons: raw.secondary_weapons ?? undefined,
    mainGunAmmo: raw.main_gun_ammo ?? undefined,
    driverNvResolution: raw.driver_nv_resolution as [number, number] ?? undefined,
    hasSmokeGrenades: raw.has_smoke_grenades ?? undefined,
    hasEss: raw.has_ess ?? undefined,
    hasLaserRangefinder: raw.has_laser_rangefinder ?? undefined,
  };
}

/**
 * Load individual vehicle detail (performance + economy)
 */
export async function loadVehicleDetail(vehicleId: string): Promise<VehicleDetailEntry | null> {
  // Check cache first
  if (vehicleDetailCache.has(vehicleId)) {
    return vehicleDetailCache.get(vehicleId)!;
  }
  
  try {
    const response = await fetch(`/wt-lens/data/vehicles/${vehicleId}.json`);
    if (!response.ok) {
      console.warn(`Failed to load vehicle detail for ${vehicleId}: ${response.status}`);
      return null;
    }
    const raw = await response.json();
    // Convert snake_case performance fields to camelCase
    const detail: VehicleDetailEntry = {
      id: raw.id,
      performance: convertPerformance(raw.performance ?? {}),
      economy: raw.economy,
    };
    vehicleDetailCache.set(vehicleId, detail);
    return detail;
  } catch (error) {
    console.warn(`Failed to load detail for ${vehicleId}:`, error);
    return null;
  }
}

/**
 * Load individual vehicle stats history (all months)
 */
export async function loadVehicleStatsHistory(vehicleId: string): Promise<StatsHistoryEntry[]> {
  // Check cache first
  if (vehicleStatsHistoryCache.has(vehicleId)) {
    return vehicleStatsHistoryCache.get(vehicleId)!;
  }
  
  try {
    const response = await fetch(`/wt-lens/data/stats/${vehicleId}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load stats history: ${response.status}`);
    }
    const history: StatsHistoryEntry[] = await response.json();
    vehicleStatsHistoryCache.set(vehicleId, history);
    return history;
  } catch (error) {
    console.warn(`Failed to load stats history for ${vehicleId}:`, error);
    return [];
  }
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
      br: datamineEntry.br,
      vehicleType: datamineEntry.vehicle_type as Vehicle['vehicleType'],
      economicType: (datamineEntry.economic_type as Vehicle['economicType']) ?? 'regular',
      performance: convertPerformance(datamineEntry.performance),
      // Backward compatibility: use historical mode as default
      stats: defaultStats,
      // New: stats broken down by game mode
      statsByMode: statsByModeRecord,
      imageUrl: datamineEntry.imageUrl,
      unreleased: datamineEntry.unreleased ?? false,
      releaseDate: datamineEntry.releaseDate,
      ghost: datamineEntry.ghost ?? false,
      economy: datamineEntry.economy,
    };

    vehicles.push(vehicle);
  }

  return vehicles;
}

// Cache for light vehicles (without stats/performance) - shared across month ranges
let lightVehiclesCache: Vehicle[] | null = null;

/**
 * Load vehicles without stats or performance data (fast, for initial render).
 * Returns vehicles with basic info only - optimized for list pages like HomePage.
 * This does NOT load detail files, keeping initial load fast.
 */
export async function loadVehiclesLight(): Promise<Vehicle[]> {
  if (lightVehiclesCache) return lightVehiclesCache;
  
  const index = await loadVehicleIndex();
  
  // Build vehicles without stats or performance (just basic info from index)
  const vehicles: Vehicle[] = index.map(entry => ({
    id: entry.id,
    name: entry.name,
    localizedName: cleanName(entry.localizedName),
    nation: entry.nation as Vehicle['nation'],
    rank: entry.rank ?? 1,
    battleRating: entry.battleRating ?? 1.0,
    br: entry.br,
    vehicleType: entry.vehicleType as Vehicle['vehicleType'],
    economicType: (entry.economicType as Vehicle['economicType']) ?? 'regular',
    // Performance is empty for light load - use loadVehicleDetail() for individual vehicles
    performance: convertPerformance({}),
    stats: undefined,
    statsByMode: undefined,
    imageUrl: entry.imageUrl ?? '',
    unreleased: entry.unreleased ?? false,
    releaseDate: entry.releaseDate,
    ghost: entry.ghost ?? false,
    economy: undefined,
  }));
  
  lightVehiclesCache = vehicles;
  return vehicles;
}

/**
 * Load stats data and merge into existing vehicles array.
 * Returns a new vehicles array with stats populated.
 */
export async function mergeStatsIntoVehicles(
  vehicles: Vehicle[],
  range?: StatsMonthRange
): Promise<Vehicle[]> {
  // Load stats (this also initializes statsMonthService)
  const stats = await loadStatsForRange(range);

  const resolvedRange = (range && range.startMonth && range.endMonth)
    ? range
    : getDefaultStatsMonthRange();

  const statsMapByMode = buildStatsMapByMonthRange(stats, resolvedRange);

  // Merge stats into vehicles
  return vehicles.map(vehicle => {
    const statsByMode = statsMapByMode.get(vehicle.id);

    if (!statsByMode) return vehicle;

    const statsByModeRecord: Record<GameMode, VehicleStats | undefined> = {
      arcade: convertToVehicleStats(statsByMode.arcade),
      historical: convertToVehicleStats(statsByMode.historical),
      simulation: convertToVehicleStats(statsByMode.simulation),
    };

    return {
      ...vehicle,
      stats: statsByModeRecord.historical,
      statsByMode: statsByModeRecord,
    };
  });
}

/**
 * Load stats for specific vehicles only and merge into existing vehicles array.
 * Much faster than mergeStatsIntoVehicles when you only need a few vehicles' stats.
 */
export async function mergeStatsForVehicles(
  vehicles: Vehicle[],
  vehicleIds: string[],
  range?: StatsMonthRange
): Promise<Vehicle[]> {
  if (vehicleIds.length === 0) return vehicles;

  // Load stats only for requested vehicles
  const stats = await loadStatsForVehicles(vehicleIds);

  const resolvedRange = (range && range.startMonth && range.endMonth)
    ? range
    : getDefaultStatsMonthRange();

  const statsMapByMode = buildStatsMapByMonthRange(stats, resolvedRange);

  // Merge stats into vehicles (only for requested IDs)
  return vehicles.map(vehicle => {
    const statsByMode = statsMapByMode.get(vehicle.id);
    if (!statsByMode) return vehicle;

    const statsByModeRecord: Record<GameMode, VehicleStats | undefined> = {
      arcade: convertToVehicleStats(statsByMode.arcade),
      historical: convertToVehicleStats(statsByMode.historical),
      simulation: convertToVehicleStats(statsByMode.simulation),
    };

    return {
      ...vehicle,
      stats: statsByModeRecord.historical,
      statsByMode: statsByModeRecord,
    };
  });
}

/**
 * Load all vehicles data (async)
 * @param range - Optional month range filter. Defaults to latest month if not specified.
 */
export async function loadVehicles(range?: StatsMonthRange): Promise<Vehicle[]> {
  // Load stats (this also ensures statsMonthService is initialized via loadStatsMeta)
  const stats = await loadStatsForRange(range);

  // Re-resolve range AFTER service is initialized — the caller may have passed
  // empty strings when the month service wasn't ready yet.
  const resolvedRange = (range && range.startMonth && range.endMonth)
    ? range
    : getDefaultStatsMonthRange();
  const cacheKey = getMonthRangeCacheKey(resolvedRange);
  
  // Check if already cached for this month range
  if (vehiclesByMonthRange.has(cacheKey)) {
    return vehiclesByMonthRange.get(cacheKey)!;
  }

  const datamine = await loadDatamineData();

  const vehicles = mergeVehicleData(stats, datamine, resolvedRange);
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

