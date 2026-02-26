import type { Vehicle, VehicleDetail, DistributionData } from '../types';
import statsData from '../../data/processed/stats.json';
import datamineData from '../../data/processed/datamine.json';

// Raw data types from JSON
interface StatSharkEntry {
  id: string;
  name: string;
  mode: 'arcade' | 'historical' | 'simulation';
  battles: number;
  win_rate: number;
  avg_kills_per_battle: number;
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
  };
  imageUrl: string;
  source: string;
}

// Type assertions for imported JSON
const typedStatsData = statsData as StatSharkEntry[];
const typedDatamineData = datamineData as DatamineEntry[];

/**
 * Build StatShark stats map, only use historical mode (历史模式)
 * 不显示街机/全真数据，保持数据一致性
 */
function buildStatsMap(): Map<string, StatSharkEntry> {
  const statsMap = new Map<string, StatSharkEntry>();

  for (const entry of typedStatsData) {
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
function buildDatamineMap(): Map<string, DatamineEntry> {
  const datamineMap = new Map<string, DatamineEntry>();
  
  for (const entry of typedDatamineData) {
    datamineMap.set(entry.id, entry);
  }
  
  return datamineMap;
}

/**
 * Merge StatShark and Datamine data by vehicle ID
 */
function mergeVehicleData(): Vehicle[] {
  const statsMap = buildStatsMap();
  const datamineMap = buildDatamineMap();
  
  // Get all unique vehicle IDs
  const allIds = new Set([...statsMap.keys(), ...datamineMap.keys()]);
  
  const vehicles: Vehicle[] = [];
  
  for (const id of allIds) {
    const stats = statsMap.get(id);
    const datamine = datamineMap.get(id);
    
    // Skip if no datamine data (we need performance data)
    if (!datamine) continue;
    
    const vehicle: Vehicle = {
      id,
      name: datamine.name,
      localizedName: datamine.localizedName,
      nation: datamine.nation as any,
      rank: stats?.rank ?? datamine.rank ?? 1,
      battleRating: stats?.br ?? datamine.battle_rating ?? 1.0,
      vehicleType: datamine.vehicle_type as any,
      economicType: (datamine.economic_type as any) ?? 'regular',
      performance: {
        horsepower: datamine.performance.horsepower ?? 0,
        weight: datamine.performance.weight ?? 0,
        powerToWeight: datamine.performance.power_to_weight ?? 0,
        maxReverseSpeed: datamine.performance.max_reverse_speed ?? 0,
        reloadTime: datamine.performance.reload_time ?? 0,
        penetration: datamine.performance.penetration ?? 0,
        maxSpeed: datamine.performance.max_speed ?? 0,
        crewCount: datamine.performance.crew_count ?? 0,
        elevationSpeed: datamine.performance.elevation_speed ?? 0,
        traverseSpeed: datamine.performance.traverse_speed ?? 0,
        hasStabilizer: datamine.performance.has_stabilizer ?? false,
        stabilizerType: (datamine.performance.stabilizer_type as 'none' | 'horizontal' | 'vertical' | 'both') ?? 'none',
        elevationRange: (datamine.performance.elevation_range as [number, number]) ?? [0, 0],
        traverseRange: (datamine.performance.traverse_range as [number, number]) ?? [0, 0],
        gunnerThermalResolution: (datamine.performance.gunner_thermal_resolution as [number, number]) ?? [0, 0],
        commanderThermalResolution: (datamine.performance.commander_thermal_resolution as [number, number]) ?? [0, 0],
        // Calculated metrics
        gunnerThermalDiagonal: datamine.performance.gunner_thermal_diagonal ?? 0,
        commanderThermalDiagonal: datamine.performance.commander_thermal_diagonal ?? 0,
        stabilizerValue: datamine.performance.stabilizer_value ?? 0,
        elevationRangeValue: datamine.performance.elevation_range_value ?? 0,
      },
      stats: stats ? {
        battles: stats.battles,
        winRate: stats.win_rate,
        avgKills: stats.avg_kills_per_battle,
      } : undefined,
      imageUrl: datamine.imageUrl,
    };
    
    vehicles.push(vehicle);
  }
  
  return vehicles;
}

// Export merged vehicle data
export const allVehicles: Vehicle[] = mergeVehicleData();

// Sample subset for development/demo
export const sampleVehicles: Vehicle[] = allVehicles.slice(0, 8);

// Helper functions
export function getVehicleById(id: string): Vehicle | undefined {
  return allVehicles.find(v => v.id === id);
}

export function getVehiclesByNation(nation: string): Vehicle[] {
  return allVehicles.filter(v => v.nation === nation);
}

export function getVehiclesByType(type: string): Vehicle[] {
  return allVehicles.filter(v => v.vehicleType === type);
}

export function getVehiclesByBattleRating(min: number, max: number): Vehicle[] {
  return allVehicles.filter(v => v.battleRating >= min && v.battleRating <= max);
}

export const sampleVehicleDetail: VehicleDetail = {
  ...sampleVehicles[0],
  economicType: 'regular',
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
