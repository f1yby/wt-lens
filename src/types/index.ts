// Vehicle types for Ground RB
export type GroundVehicleType = 'light_tank' | 'medium_tank' | 'heavy_tank' | 'tank_destroyer' | 'spaa';

// Aircraft types for Air RB
export type AircraftType = 'fighter' | 'bomber' | 'assault' | 'helicopter';

// Ship types for Naval RB
export type ShipType = 'destroyer' | 'cruiser' | 'torpedo_boat' | 'submarine_chaser' | 'barge' | 'ship';

// Combined vehicle type (for backward compatibility)
export type VehicleType = GroundVehicleType | AircraftType | ShipType;

// Economic types for vehicles
export type EconomicType = 'regular' | 'clan' | 'premium';

// Game modes for War Thunder
export type GameMode = 'arcade' | 'historical' | 'simulation';

// Vehicle statistics from StatShark
export interface VehicleStats {
  battles: number;
  winRate: number;
  killPerSpawn: number;  // 每次重生击杀数 (Kills per spawn)
  expPerSpawn?: number;  // 每次重生获取的经验 (RP per spawn)
}

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
  vehicleType: GroundVehicleType;
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
  // For backward compatibility - represents the default mode (historical)
  stats?: VehicleStats;
  // Stats broken down by game mode (arcade/historical/simulation)
  statsByMode?: Record<GameMode, VehicleStats | undefined>;
  // Thumbnail image URL (placeholder)
  imageUrl?: string;
  // Whether this vehicle is unreleased (not yet in live server)
  unreleased?: boolean;
  // Release date from datamine (YYYY-MM-DD format)
  releaseDate?: string;
}

/** Aircraft vehicle data (Phase 1: StatShark only, no performance data) */
export interface AircraftVehicle {
  id: string;
  name: string;
  localizedName: string;
  nation: Nation;
  rank: number;
  battleRating: number;
  aircraftType: AircraftType;
  economicType: EconomicType;
  // Phase 1: No performance data from datamine
  // Phase 2: Will add aircraft-specific performance (speed, climb rate, etc.)
  performance?: {
    // Placeholder for future aircraft performance data
    maxSpeed?: number;
    climbRate?: number;
    turnTime?: number;
    maxAltitude?: number;
  };
  // Matchmaking stats from StatShark
  stats?: VehicleStats;
  statsByMode?: Record<GameMode, VehicleStats | undefined>;
  imageUrl?: string;
  unreleased?: boolean;
  releaseDate?: string;
}

/** Ship vehicle data (Phase 1: StatShark only, no performance data) */
export interface ShipVehicle {
  id: string;
  name: string;
  localizedName: string;
  nation: Nation;
  rank: number;
  battleRating: number;
  shipType: ShipType;
  economicType: EconomicType;
  // Phase 1: No performance data from datamine
  // Phase 2: Will add ship-specific performance (displacement, max speed, etc.)
  performance?: {
    // Placeholder for future ship performance data
    displacement?: number;  // 排水量 (tons)
    maxSpeed?: number;      // 最大航速 (km/h)
    crewSize?: number;      // 船员数量
  };
  // Matchmaking stats from StatShark
  stats?: VehicleStats;
  statsByMode?: Record<GameMode, VehicleStats | undefined>;
  imageUrl?: string;
  unreleased?: boolean;
  releaseDate?: string;
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

export const VEHICLE_TYPE_LABELS: Record<GroundVehicleType, string> = {
  light_tank: '轻型坦克',
  medium_tank: '中型坦克',
  heavy_tank: '重型坦克',
  tank_destroyer: '坦克歼击车',
  spaa: '自行防空炮',
};

export const AIRCRAFT_TYPE_LABELS: Record<AircraftType, string> = {
  fighter: '战斗机',
  bomber: '轰炸机',
  assault: '攻击机',
  helicopter: '直升机',
};

export const SHIP_TYPE_LABELS: Record<ShipType, string> = {
  destroyer: '驱逐舰',
  cruiser: '巡洋舰',
  torpedo_boat: '鱼雷艇',
  submarine_chaser: '猎潜艇',
  barge: '登陆艇/驳船',
  ship: '通用舰船',
};

export const BATTLE_RATINGS = [
  1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7,
  4.0, 4.3, 4.7, 5.0, 5.3, 5.7, 6.0, 6.3, 6.7,
  7.0, 7.3, 7.7, 8.0, 8.3, 8.7, 9.0, 9.3, 9.7,
  10.0, 10.3, 10.7, 11.0, 11.3, 11.7, 12.0, 12.3, 12.7
];

/** Game mode configuration */
export interface GameModeConfig {
  id: GameMode;
  name: string;
  nameZh: string;
  color: string;
  gradient: string;
}

export const GAME_MODES: GameModeConfig[] = [
  { 
    id: 'arcade', 
    name: 'Arcade', 
    nameZh: '街机', 
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)'
  },
  { 
    id: 'historical', 
    name: 'Realistic', 
    nameZh: '历史', 
    color: '#16a34a',
    gradient: 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)'
  },
  { 
    id: 'simulation', 
    name: 'Simulator', 
    nameZh: '全真', 
    color: '#dc2626',
    gradient: 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)'
  },
];

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  arcade: '街机模式',
  historical: '历史模式',
  simulation: '全真模式',
};

/** Default game mode */
export const DEFAULT_GAME_MODE: GameMode = 'historical';

// ============================================================================
// Stats Month Types (for historical data filtering)
// ============================================================================

/** 统计数据月份 ID */
export type StatsMonthId = 
  | 'diff_2025_febuary_march'
  | 'diff_2025_march_april'
  | 'diff_2025_april_may'
  | 'diff_2025_may_june'
  | 'diff_2025_june_july'
  | 'diff_2025_july_august'
  | 'diff_2025_august_september'
  | 'diff_2025_september_october'
  | 'diff_2025_october_november'
  | 'diff_2025_november_december'
  | 'diff_2025_december_january'
  | 'diff_2026_january_february';

/** 月份配置 */
export interface StatsMonthConfig {
  id: StatsMonthId;
  label: string;      // 如 "2025年2-3月"
  shortLabel: string; // 如 "2-3月"
}

/** 所有可用的统计数据月份配置（按时间从早到晚排序） */
export const STATS_MONTHS: StatsMonthConfig[] = [
  { id: 'diff_2025_febuary_march', label: '2025年2月', shortLabel: '25年2月' },
  { id: 'diff_2025_march_april', label: '2025年3月', shortLabel: '25年3月' },
  { id: 'diff_2025_april_may', label: '2025年4月', shortLabel: '25年4月' },
  { id: 'diff_2025_may_june', label: '2025年5月', shortLabel: '25年5月' },
  { id: 'diff_2025_june_july', label: '2025年6月', shortLabel: '25年6月' },
  { id: 'diff_2025_july_august', label: '2025年7月', shortLabel: '25年7月' },
  { id: 'diff_2025_august_september', label: '2025年8月', shortLabel: '25年8月' },
  { id: 'diff_2025_september_october', label: '2025年9月', shortLabel: '25年9月' },
  { id: 'diff_2025_october_november', label: '2025年10月', shortLabel: '25年10月' },
  { id: 'diff_2025_november_december', label: '2025年11月', shortLabel: '25年11月' },
  { id: 'diff_2025_december_january', label: '2025年12月', shortLabel: '25年12月' },
  { id: 'diff_2026_january_february', label: '2026年1月', shortLabel: '26年1月' },
];

/** 默认统计数据月份（最新月份） */
export const DEFAULT_STATS_MONTH: StatsMonthId = 'diff_2026_january_february';

/** 根据月份ID获取配置 */
export const getStatsMonthConfig = (monthId: StatsMonthId): StatsMonthConfig | undefined => 
  STATS_MONTHS.find(m => m.id === monthId);

/** 验证月份ID是否有效 */
export const isValidStatsMonthId = (value: string): value is StatsMonthId =>
  STATS_MONTHS.some(m => m.id === value);
