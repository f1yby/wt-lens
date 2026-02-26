// Vehicle types for Ground RB
export type VehicleType = 'light_tank' | 'medium_tank' | 'heavy_tank' | 'tank_destroyer' | 'spaa';

export type Nation = 
  | 'usa' 
  | 'germany' 
  | 'ussr' 
  | 'britain' 
  | 'japan' 
  | 'china' 
  | 'italy' 
  | 'france' 
  | 'sweden' 
  | 'israel';

export interface Vehicle {
  id: string;
  name: string;
  localizedName: string;
  nation: Nation;
  rank: number;
  battleRating: number;
  vehicleType: VehicleType;
  // Performance metrics from datamine (some fields may be missing)
  performance: {
    horsepower: number;
    weight: number;
    powerToWeight: number;
    maxReverseSpeed: number;
    reloadTime: number;
    penetration: number;
    maxSpeed: number;
    crewCount: number;
    // Gun and turret stats
    elevationSpeed: number;
    traverseSpeed: number;
    hasStabilizer: boolean;
    // Gun limits
    elevationRange: [number, number];
    traverseRange: [number, number];
    // Thermal vision
    gunnerThermalResolution: [number, number];
    commanderThermalResolution: [number, number];
  };
  // Matchmaking stats from StatShark (may be missing if no stats available)
  stats?: {
    battles: number;
    winRate: number;
    avgKills: number;
  };
  // Thumbnail image URL (placeholder)
  imageUrl?: string;
}

export interface MatchupData {
  vehicleId: string;
  encounterRate: number;
  battles: number;
}

export interface VehicleDetail extends Vehicle {
  // Opponents this vehicle frequently meets
  commonOpponents: MatchupData[];
  // Teammate composition
  teammateComposition: {
    nation: Nation;
    percentage: number;
  }[];
}

export interface DistributionData {
  metric: 'powerToWeight' | 'maxReverseSpeed' | 'reloadTime' | 'penetration';
  bins: {
    range: string;
    min?: number;
    max?: number;
    count?: number;
    vehicles?: string[];
    // For scatter chart
    metricValue?: number;
    battles?: number;
    isCurrent?: boolean;
    vehicleId?: string;
  }[];
  currentVehicleBin: number;
  currentVehicleValue: number;
  allValues: {
    vehicleId: string;
    value: number;
  }[];
}

export interface NationConfig {
  id: Nation;
  name: string;
  nameZh: string;
  color: string;
  flagIcon: string;
}

export const NATIONS: NationConfig[] = [
  { id: 'usa', name: 'USA', nameZh: '美国', color: '#3b82f6', flagIcon: '🇺🇸' },
  { id: 'germany', name: 'Germany', nameZh: '德国', color: '#eab308', flagIcon: '🇩🇪' },
  { id: 'ussr', name: 'USSR', nameZh: '苏联', color: '#ef4444', flagIcon: '🇷🇺' },
  { id: 'britain', name: 'Britain', nameZh: '英国', color: '#22c55e', flagIcon: '🇬🇧' },
  { id: 'japan', name: 'Japan', nameZh: '日本', color: '#f97316', flagIcon: '🇯🇵' },
  { id: 'china', name: 'China', nameZh: '中国', color: '#dc2626', flagIcon: '🇨🇳' },
  { id: 'italy', name: 'Italy', nameZh: '意大利', color: '#14b8a6', flagIcon: '🇮🇹' },
  { id: 'france', name: 'France', nameZh: '法国', color: '#6366f1', flagIcon: '🇫🇷' },
  { id: 'sweden', name: 'Sweden', nameZh: '瑞典', color: '#06b6d4', flagIcon: '🇸🇪' },
  { id: 'israel', name: 'Israel', nameZh: '以色列', color: '#84cc16', flagIcon: '🇮🇱' },
];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  light_tank: '轻型坦克',
  medium_tank: '中型坦克',
  heavy_tank: '重型坦克',
  tank_destroyer: '坦克歼击车',
  spaa: '自行防空炮',
};

export const BATTLE_RATINGS = [
  1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7,
  4.0, 4.3, 4.7, 5.0, 5.3, 5.7, 6.0, 6.3, 6.7,
  7.0, 7.3, 7.7, 8.0, 8.3, 8.7, 9.0, 9.3, 9.7,
  10.0, 10.3, 10.7, 11.0, 11.3, 11.7, 12.0, 12.3, 12.7
];
