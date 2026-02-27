import type { Vehicle, VehicleDetail, DistributionData } from '../types';

// Raw data types from JSON
interface StatSharkEntry {
  id: string;
  name: string;
  mode: 'arcade' | 'historical' | 'simulation';
  battles: number;
  win_rate: number;
  avg_kills_per_spawn: number;
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
    mainGun?: any | null;
    ammunitions?: any[] | null;
    penetrationData?: any | null;
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
      localizedName: datamineEntry.localizedName,
      nation: datamineEntry.nation as any,
      rank: statsEntry?.rank ?? datamineEntry.rank ?? 1,
      battleRating: statsEntry?.br ?? datamineEntry.battle_rating ?? 1.0,
      vehicleType: datamineEntry.vehicle_type as any,
      economicType: (datamineEntry.economic_type as any) ?? 'regular',
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
      },
      stats: statsEntry ? {
        battles: statsEntry.battles,
        winRate: statsEntry.win_rate,
        avgKills: statsEntry.avg_kills_per_spawn,
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

/**
 * Get all vehicles (sync version - returns empty array if not loaded)
 * @deprecated Use loadVehicles() instead
 */
export const allVehicles: Vehicle[] = [];

// Sample subset for development/demo
export const sampleVehicles: Vehicle[] = [];

// Helper functions (async versions)
export async function getVehicleById(id: string): Promise<Vehicle | undefined> {
  const vehicles = await loadVehicles();
  return vehicles.find(v => v.id === id);
}

export async function getVehiclesByNation(nation: string): Promise<Vehicle[]> {
  const vehicles = await loadVehicles();
  return vehicles.filter(v => v.nation === nation);
}

export async function getVehiclesByType(type: string): Promise<Vehicle[]> {
  const vehicles = await loadVehicles();
  return vehicles.filter(v => v.vehicleType === type);
}

export async function getVehiclesByBattleRating(min: number, max: number): Promise<Vehicle[]> {
  const vehicles = await loadVehicles();
  return vehicles.filter(v => v.battleRating >= min && v.battleRating <= max);
}

export const sampleVehicleDetail: VehicleDetail = {
  id: 'ussr_t_34_1942',
  name: 'ussr_t_34_1942',
  localizedName: 'T-34 (1942)',
  nation: 'ussr',
  rank: 3,
  battleRating: 4.0,
  vehicleType: 'medium_tank',
  economicType: 'regular',
  performance: {
    horsepower: 500,
    weight: 30.5,
    powerToWeight: 16.4,
    maxReverseSpeed: 7,
    reloadTime: 6.5,
    penetration: 135,
    maxSpeed: 55,
    crewCount: 4,
    elevationSpeed: 10,
    traverseSpeed: 14,
    hasStabilizer: false,
    stabilizerType: 'none',
    elevationRange: [-5, 30],
    traverseRange: [-180, 180],
    gunnerThermalResolution: [0, 0],
    commanderThermalResolution: [0, 0],
    gunnerThermalDiagonal: 0,
    commanderThermalDiagonal: 0,
    stabilizerValue: 0,
    elevationRangeValue: 35,
  },
  stats: {
    battles: 125000,
    winRate: 52.3,
    avgKills: 1.2,
  },
  imageUrl: 'https://encyclopedia.warthunder.com/images/ussr_t_34_1942.png',
  commonOpponents: [
    { vehicleId: 'germany_panzer_iv_h', encounterRate: 35, battles: 43750 },
    { vehicleId: 'usa_m4a3e8_sherman', encounterRate: 28, battles: 35000 },
    { vehicleId: 'germany_tiger_h1', encounterRate: 15, battles: 18750 },
  ],
  teammateComposition: [
    { nation: 'ussr', percentage: 65 },
    { nation: 'china', percentage: 20 },
    { nation: 'britain', percentage: 15 },
  ],
};

export const sampleDistributions: Record<string, DistributionData> = {
  'ussr_t_34_1942': {
    metric: 'powerToWeight',
    bins: [
      { range: '0-10', min: 0, max: 10, count: 15, vehicles: [] },
      { range: '10-15', min: 10, max: 15, count: 45, vehicles: [] },
      { range: '15-20', min: 15, max: 20, count: 35, vehicles: ['ussr_t_34_1942'] },
      { range: '20-25', min: 20, max: 25, count: 20, vehicles: [] },
      { range: '25-30', min: 25, max: 30, count: 10, vehicles: [] },
    ],
    currentVehicleBin: 2,
    currentVehicleValue: 16.18,
    allValues: [],
  },
};
