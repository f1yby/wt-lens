import type { Vehicle, Ammunition, MainGun, PenetrationData } from '../types';

/**
 * Clean vehicle name: only remove zero-width spaces.
 * Keep special WT symbols (␗, ▄, etc.) - they are rendered via WTSymbols font.
 */
function cleanVehicleName(name: string): string {
  if (!name) return name;
  return name.replace(/\u200b/g, '');
}

// Raw data types from JSON
interface StatSharkEntry {
  id: string;
  name: string;
  mode: 'arcade' | 'historical' | 'simulation';
  battles: number;
  win_rate: number;
  avg_kills_per_spawn: number;
  exp_per_spawn?: number;
  rank?: number;
  br?: number;
}

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
}

// Cache for loaded data
let statsData: StatSharkEntry[] | null = null;
let datamineData: DatamineEntry[] | null = null;
let mergedVehicles: Vehicle[] | null = null;

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
 * Build StatShark stats map, only use historical mode (历史模式)
 */
function buildStatsMap(stats: StatSharkEntry[]): Map<string, StatSharkEntry> {
  const statsMap = new Map<string, StatSharkEntry>();

  for (const entry of stats) {
    // 只使用历史模式数据 (StatShark uses 'historical' not 'realistic')
    if (entry.mode === 'historical') {
      statsMap.set(entry.id, entry);
    }
  }

  return statsMap;
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
 */
function mergeVehicleData(stats: StatSharkEntry[], datamine: DatamineEntry[]): Vehicle[] {
  const statsMap = buildStatsMap(stats);
  const datamineMap = buildDatamineMap(datamine);
  
  // Get all unique vehicle IDs
  const allIds = new Set([...statsMap.keys(), ...datamineMap.keys()]);
  
  const vehicles: Vehicle[] = [];
  
  for (const id of allIds) {
    const statsEntry = statsMap.get(id);
    const datamineEntry = datamineMap.get(id);
    
    // Skip if no datamine data (we need performance data)
    if (!datamineEntry) continue;
    
    const vehicle: Vehicle = {
      id,
      name: datamineEntry.name,
      localizedName: cleanVehicleName(datamineEntry.localizedName),
      nation: datamineEntry.nation as Vehicle['nation'],
      rank: statsEntry?.rank ?? datamineEntry.rank ?? 1,
      battleRating: statsEntry?.br ?? datamineEntry.battle_rating ?? 1.0,
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
      stats: statsEntry ? {
        battles: statsEntry.battles,
        winRate: statsEntry.win_rate,
        killPerSpawn: statsEntry.avg_kills_per_spawn,
        expPerSpawn: statsEntry.exp_per_spawn,
      } : undefined,
      imageUrl: datamineEntry.imageUrl,
    };
    
    vehicles.push(vehicle);
  }
  
  return vehicles;
}

/**
 * Load all vehicles data (async)
 */
export async function loadVehicles(): Promise<Vehicle[]> {
  if (mergedVehicles) return mergedVehicles;
  
  const [stats, datamine] = await Promise.all([
    loadStatsData(),
    loadDatamineData(),
  ]);
  
  mergedVehicles = mergeVehicleData(stats, datamine);
  return mergedVehicles;
}

