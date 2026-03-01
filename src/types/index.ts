// Vehicle types for Ground RB
export type VehicleType = 'light_tank' | 'medium_tank' | 'heavy_tank' | 'tank_destroyer' | 'spaa';

// Economic types for vehicles
export type EconomicType = 'regular' | 'clan' | 'premium';

// Ammunition types
export type AmmoType = 'apds_fs' | 'apds_fs_long' | 'heat' | 'heat_fs' | 'he' | 'apcbc' | 'ap' | 'apcr' | 'hesh' | 'atgm' | 'other';

// Penetrator materials
export type PenetratorMaterial = 'tungsten' | 'depletedUranium' | 'steel';

/** Ammunition data with penetration info */
export interface Ammunition {
  name: string;
  localizedName?: string;
  type: AmmoType;
  caliber: number;           // damageCaliber in mm
  mass: number;              // kg
  muzzleVelocity: number;    // m/s
  // Lanz-Odermatt parameters (if available)
  lanzOdermatt?: {
    workingLength: number;   // mm
    density: number;         // kg/m³
    material: PenetratorMaterial;
    Cx?: number;             // drag coefficient
  };
  // Direct armorpower data (for non-APFSDS or older rounds)
  armorPower?: number;       // mm @ 0° (direct value from datamine)
  armorPowerTable?: {        // Distance-based penetration table
    distance: number;        // meters
    penetration: number;     // mm
  }[];
  // Calculated penetration
  penetration0m?: number;    // mm @ 0° NATO @ 0m
  penetration500m?: number;  // mm @ 0° NATO @ 500m
}

/** Available metric types for vehicle performance comparison */
export type MetricType = 
  | 'powerToWeight' 
  | 'maxSpeed' 
  | 'maxReverseSpeed' 
  | 'reloadTime' 
  | 'penetration' 
  | 'traverseSpeed' 
  | 'elevationSpeed' 
  | 'elevationMin' 
  | 'gunnerThermal' 
  | 'commanderThermal' 
  | 'stabilizer'
  | 'expPerSpawn';

export const ECONOMIC_TYPE_COLORS: Record<EconomicType, string> = {
  regular: '#3b82f6',  // Blue - 普通载具
  clan: '#22c55e',     // Green - 联队载具
  premium: '#f59e0b',  // Amber/Gold - 金币载具
};

export const ECONOMIC_TYPE_GRADIENTS: Record<EconomicType, string> = {
  regular: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)',  // Blue gradient
  clan: 'linear-gradient(135deg, #86efac 0%, #22c55e 100%)',     // Green gradient
  premium: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',  // Gold gradient
};

export const ECONOMIC_TYPE_LABELS: Record<EconomicType, string> = {
  regular: '普通载具',
  clan: '联队载具',
  premium: '金币载具',
};

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

/** Main gun information */
export interface MainGun {
  name: string;
  caliber: number;           // mm
  reloadTime?: number;       // seconds
  ammoCount?: number;        // total ammo capacity
  autoLoader?: boolean;      // true = auto-loader, false = manual loader
  reloadTimes?: {            // reload times for different crew skill levels
    base: number;            // whiteboard crew
    expert: number;          // expert crew (+10%)
    ace: number;             // ace crew (+25%)
  };
  // Autocannon-specific fields
  rateOfFire?: number;       // rounds per minute (from shotFreq)
  beltReloadTime?: number;   // belt/magazine reload time in seconds (ace value)
}

/** Penetration data at different angles */
export interface PenetrationData {
  at0m: {
    angle0: number;    // mm @ 0°
    angle30?: number;  // mm @ 30°
    angle60?: number;  // mm @ 60°
  };
  at500m?: {
    angle0: number;
    angle30?: number;
    angle60?: number;
  };
  at1000m?: {
    angle0: number;
    angle30?: number;
    angle60?: number;
  };
}

export interface Vehicle {
  id: string;
  name: string;
  localizedName: string;
  nation: Nation;
  rank: number;
  battleRating: number;
  vehicleType: VehicleType;
  economicType: EconomicType;
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
    stabilizerType: 'none' | 'horizontal' | 'vertical' | 'both';
    // Gun limits
    elevationRange: [number, number];
    traverseRange: [number, number];
    // Thermal vision
    gunnerThermalResolution: [number, number];
    commanderThermalResolution: [number, number];
    // Calculated metrics for charts
    gunnerThermalDiagonal?: number;
    commanderThermalDiagonal?: number;
    stabilizerValue?: number;
    elevationRangeValue?: number;
    // Main gun and ammunition data (new)
    mainGun?: MainGun;
    ammunitions?: Ammunition[];
    penetrationData?: PenetrationData;
    autoLoader?: boolean;      // true = auto-loader (fixed reload time)
  };
  // Matchmaking stats from StatShark (may be missing if no stats available)
  stats?: {
    battles: number;
    winRate: number;
    killPerSpawn: number;  // 每次重生击杀数 (Kills per spawn)
    expPerSpawn?: number;  // 每次重生获取的经验 (RP per spawn)
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
  metric: MetricType;
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
  flagImage: string;
}

export const NATIONS: NationConfig[] = [
  { id: 'usa', name: 'USA', nameZh: '美国', color: '#3b82f6', flagIcon: '🇺🇸', flagImage: '/wt-lens/images/flags/unit_tooltip/country_usa.webp' },
  { id: 'germany', name: 'Germany', nameZh: '德国', color: '#eab308', flagIcon: '🇩🇪', flagImage: '/wt-lens/images/flags/unit_tooltip/country_germany.webp' },
  { id: 'ussr', name: 'USSR', nameZh: '苏联', color: '#ef4444', flagIcon: '🇷🇺', flagImage: '/wt-lens/images/flags/unit_tooltip/country_ussr.webp' },
  { id: 'britain', name: 'Britain', nameZh: '英国', color: '#22c55e', flagIcon: '🇬🇧', flagImage: '/wt-lens/images/flags/unit_tooltip/country_britain.webp' },
  { id: 'japan', name: 'Japan', nameZh: '日本', color: '#f97316', flagIcon: '🇯🇵', flagImage: '/wt-lens/images/flags/unit_tooltip/country_japan.webp' },
  { id: 'china', name: 'China', nameZh: '中国', color: '#dc2626', flagIcon: '🇨🇳', flagImage: '/wt-lens/images/flags/unit_tooltip/country_china.webp' },
  { id: 'italy', name: 'Italy', nameZh: '意大利', color: '#14b8a6', flagIcon: '🇮🇹', flagImage: '/wt-lens/images/flags/unit_tooltip/country_italy.webp' },
  { id: 'france', name: 'France', nameZh: '法国', color: '#6366f1', flagIcon: '🇫🇷', flagImage: '/wt-lens/images/flags/unit_tooltip/country_france.webp' },
  { id: 'sweden', name: 'Sweden', nameZh: '瑞典', color: '#06b6d4', flagIcon: '🇸🇪', flagImage: '/wt-lens/images/flags/unit_tooltip/country_sweden.webp' },
  { id: 'israel', name: 'Israel', nameZh: '以色列', color: '#84cc16', flagIcon: '🇮🇱', flagImage: '/wt-lens/images/flags/unit_tooltip/country_israel.webp' },
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
