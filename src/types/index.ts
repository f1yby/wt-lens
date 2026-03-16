// Vehicle types for Ground RB
export type GroundVehicleType = 'light_tank' | 'medium_tank' | 'heavy_tank' | 'tank_destroyer' | 'spaa';

// Aircraft types for Air RB
export type AircraftType = 'fighter' | 'bomber' | 'assault' | 'helicopter';

// Ship types for Naval RB
export type ShipType =
  | 'destroyer'
  | 'torpedo_boat'
  | 'submarine_chaser'
  | 'barge'
  | 'battleship'
  | 'battlecruiser'
  | 'heavy_cruiser'
  | 'light_cruiser'
  | 'frigate'
  | 'boat'
  | 'armored_boat'
  | 'gun_boat'
  | 'torpedo_gun_boat';

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

// Ammunition types – raw bulletType values from datamine (56+ variants)
// Using string to accommodate all known and future bullet types
export type AmmoType = string;

/** Economy data from wpcost.blkx */
export interface EconomyData {
  // Research & Purchase
  researchCost?: number;         // reqExp (RP needed to research)
  purchaseCost?: number;         // value (SL needed to purchase)
  purchaseCostGold?: number;     // costGold (GE for premium vehicles)
  
  // Crew Training
  crewTraining?: number;         // trainCost (SL)
  expertTraining?: number;       // train2Cost (SL)
  aceTrainingGE?: number;        // train3Cost_gold (GE)
  aceTrainingRP?: number;        // train3Cost_exp (RP)
  
  // Repair cost: { arcade: [base, spaded], realistic: [...], simulator: [...] }
  repairCost?: Record<'arcade' | 'realistic' | 'simulator', [number, number]>;
  
  // Reward multipliers
  rewardMultiplier?: Record<'arcade' | 'realistic' | 'simulator', number>;
  expMultiplier?: number;        // expMul
  
  // Free repairs (premium/gift vehicles only)
  freeRepairs?: number;
}

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
  // Jacob de Marre parameters (for AP/APC/APBC/APCBC/APHE/APHEBC/APCR)
  deMarre?: {
    fullCaliber: number;     // full bore caliber (mm) — NOT damageCaliber
    isApcbc: boolean;        // true → K_apcbc=1.0 (APC/APCBC), false → 0.9
    explosiveMass: number;   // kg (raw, for knap calculation)
    Cx?: number;             // drag coefficient
    // APCR-specific fields
    isApcr?: boolean;
    coreCaliber?: number;    // mm (damageCaliber for APCR)
    coreMass?: number;       // kg (damageMass for APCR)
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
  // Explosive filler (for HE, HEAT, APHE, etc.)
  explosiveMassKg?: number;  // raw explosive mass in kg
  explosiveType?: string;    // e.g. 'a_ix_2', 'tnt', 'comp_b'
  tntEquivalent?: number;    // TNT equivalent mass in kg
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

// ============================================================================
// Split Data Types (for optimized loading)
// ============================================================================

/**
 * 载具索引条目（用于列表展示，轻量级）
 * 
 * 对应 vehicles-index.json 中的条目结构
 */
export interface VehicleIndexEntry {
  id: string;
  name: string;
  localizedName: string;
  nation: Nation;
  rank: number;
  /** Main battle rating (realistic mode) */
  battleRating: number;
  /** Battle rating for each game mode */
  br?: Record<GameMode, number>;
  vehicleType: GroundVehicleType;
  economicType: EconomicType;
  imageUrl?: string;
  unreleased?: boolean;
  releaseDate?: string;
  ghost?: boolean;
  /** Lightweight performance summary for comparison charts (snake_case) */
  perf?: {
    power_to_weight?: number;
    max_speed?: number;
    max_reverse_speed?: number;
    reload_time?: number;
    penetration?: number;
    traverse_speed?: number;
    elevation_speed?: number;
    gunner_thermal_diagonal?: number;
    commander_thermal_diagonal?: number;
    stabilizer_value?: number;
    elevation_range_value?: number;
  };
}

/**
 * 载具详情数据（按需加载，包含重数据）
 * 
 * 对应 vehicles/{id}.json 文件结构
 */
export interface VehicleDetailEntry {
  id: string;
  performance: Vehicle['performance'];
  economy?: EconomyData;
}

/**
 * 统计数据索引条目（最新月份的汇总数据）
 * 
 * 对应 stats-index.json 中的条目结构
 */
export interface StatsIndexEntry {
  id: string;
  mode: GameMode;
  battles: number;
  winRate: number;
  avgKillsPerSpawn: number;
  expPerSpawn: number;
}

/**
 * 单车统计历史数据条目
 * 
 * 对应 stats/{id}.json 文件中的条目结构
 */
export interface StatsHistoryEntry {
  id: string;
  mode: string;  // 'arcade' | 'realistic' | 'simulator'
  battles: number;
  win_rate: number;
  avg_kills_per_spawn: number;
  exp_per_spawn: number;
  month: string;  // e.g., 'diff_2026_february_march'
}

// ============================================================================
// Main Vehicle Types
// ============================================================================

export interface Vehicle {
  id: string;
  name: string;
  localizedName: string;
  nation: Nation;
  rank: number;
  battleRating: number;
  /** Battle rating for each game mode (arcade/historical/simulation) */
  br?: Record<GameMode, number>;
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

    // ---- Extended fields (Detailed Performance) ----

    // Engine details
    engineManufacturer?: string;     // e.g. "honeywell"
    engineModel?: string;            // e.g. "agt_1500"
    engineType?: string;             // e.g. "gasturbine", "carburetor", "diesel"
    engineMaxRpm?: number;           // max RPM

    // Transmission details
    transmissionManufacturer?: string; // e.g. "allison"
    transmissionModel?: string;        // e.g. "x_1100_3b"
    transmissionType?: string;         // e.g. "auto", "manual"
    forwardGears?: number;             // number of forward gears
    reverseGears?: number;             // number of reverse gears
    forwardGearSpeeds?: number[];      // per-gear speed (km/h), index 0 = 1st gear (slowest)
    reverseGearSpeeds?: number[];      // per-gear speed (km/h), index 0 = 1st reverse (slowest)
    steerType?: string;                // e.g. "clutch_braking", "differential"

    // Mass details
    emptyWeight?: number;              // tons (empty mass)

    // Track details
    trackWidth?: number;               // meters

    // Secondary weapons (machine guns, ATGMs, etc.)
    secondaryWeapons?: {
      trigger: string;
      name: string;
      caliber: number;        // mm
      ammo: number;
      // Extended fields (extracted from weapon files)
      bulletType?: string;    // e.g. 'atgm_tandem_tank', 'ap_i_t'
      reloadTime?: number;    // seconds
      rateOfFire?: number;    // rounds per minute
      penetration?: number;   // mm (cumulativeDamage.armorPower for HEAT/ATGM)
      maxDistance?: number;    // meters (max range, rockets/missiles)
      maxSpeed?: number;      // m/s (end speed for rockets/missiles)
      guidanceType?: string;  // e.g. 'optical', 'laser', 'saclos'
      explosiveMass?: number; // kg
      explosiveType?: string; // e.g. 'lx14', 'tnt'
    }[];

    // Main gun ammo capacity
    mainGunAmmo?: number;              // total ammo count

    // Optics: driver night vision
    driverNvResolution?: [number, number];  // [width, height]

    // Smoke systems
    hasSmokeGrenades?: boolean;
    hasEss?: boolean;                  // engine smoke screen

    // Laser rangefinder
    hasLaserRangefinder?: boolean;
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
  // Whether this vehicle is a "ghost" (in datamine but no stats data and no wiki page)
  ghost?: boolean;
  // Release date from datamine (YYYY-MM-DD format)
  releaseDate?: string;
  // Economy data from wpcost (repair cost, research cost, reward multipliers, etc.)
  economy?: EconomyData;
}

/** Aircraft vehicle data (Phase 1: StatShark only, no performance data) */
export interface AircraftVehicle {
  id: string;
  name: string;
  localizedName: string;
  nation: Nation;
  rank: number;
  battleRating: number;
  /** Battle rating for each game mode (arcade/historical/simulation) */
  br?: Record<GameMode, number>;
  /** Ground combined battle BR (陆空联合 BR), only present when different from air BR */
  groundBattleRating?: number;
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
  ghost?: boolean;
  releaseDate?: string;
  // Economy data from wpcost
  economy?: EconomyData;
  /** Aircraft weapons and payloads (fixed weapons + bomb/rocket presets) */
  weapons?: AircraftWeapons;
}

/** Single bullet performance data in an aircraft belt */
export interface AircraftBulletData {
  /** Bullet type identifier (e.g., 'ap_i', 'he_i', 't_ball') */
  type: string;
  /** Localized bullet name (from units_weaponry.csv) */
  localizedName?: string;
  /** Mass in kg */
  mass?: number;
  /** Muzzle velocity in m/s */
  speed?: number;
  /** Penetration at 0m (mm) - extracted from armorpower */
  penetration?: number;
  /** Explosive mass in kg (for HE/HEI shells) */
  explosiveMass?: number;
  /** Explosive type (e.g., 'tetryl', 'tnt', 'petn') */
  explosiveType?: string;
  /** TNT equivalent in kg */
  tntEquivalent?: number;
  /** Hit power multiplier (damage coefficient) */
  hitPowerMult?: number;
  /** Fire chance multiplier */
  fireChance?: number;
}

/** Aircraft weapons data */
export interface AircraftWeapons {
  /** Fixed weapons (machine guns, cannons) */
  fixed_weapons?: Array<{
    name: string;
    localizedName?: string;
    count: number;
    bullets: number;
    /** Caliber in mm */
    caliber?: number;
    /** Fire rate in rounds/min */
    fireRate?: number;
    /** Available belt types with bullet sequences and detailed bullet data */
    belts?: Array<{
      key: string;
      name: string;
      /** Bullet types in the belt (e.g., ['t_ball', 'ap_ball', 'i_ball']) */
      bullets: string[];
      /** Detailed bullet performance data (indexed by position in bullets array) */
      bulletsData?: AircraftBulletData[];
    }>;
  }>;
  /** Payload presets (bombs, rockets, missiles) */
  payloads?: Array<{
    name: string;
    weapons: Array<{
      trigger: string;
      name: string;
      localizedName?: string;
      count: number;
    }>;
  }>;
}

/** Ship vehicle data (Phase 1: StatShark only, no performance data) */
export interface ShipVehicle {
  id: string;
  name: string;
  localizedName: string;
  nation: Nation;
  rank: number;
  battleRating: number;
  /** Battle rating for each game mode (arcade/historical/simulation) */
  br?: Record<GameMode, number>;
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
  ghost?: boolean;
  releaseDate?: string;
  // Economy data from wpcost
  economy?: EconomyData;
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
    isSameNation?: boolean;
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
  torpedo_boat: '鱼雷艇',
  submarine_chaser: '猎潜艇',
  barge: '登陆艇/驳船',
  battleship: '战列舰',
  battlecruiser: '战列巡洋舰',
  heavy_cruiser: '重巡洋舰',
  light_cruiser: '轻巡洋舰',
  frigate: '护卫舰',
  boat: '快艇',
  armored_boat: '装甲艇',
  gun_boat: '炮艇',
  torpedo_gun_boat: '鱼雷炮艇',
};

/**
 * 生成 War Thunder 标准 BR 序列
 * BR 遵循固定模式: [整数, +0.3, +0.7] 循环
 * 例如: 1.0 -> 1.3 -> 1.7 -> 2.0 -> 2.3 -> 2.7 -> ...
 * @param maxBR 最大 BR 值（包含）
 * @returns 从 1.0 到 maxBR 的所有标准 BR 值数组
 */
export function generateBRSequence(maxBR: number): number[] {
  const brs: number[] = [];
  const offsets = [0, 0.3, 0.7];
  for (let base = 1; base <= Math.ceil(maxBR); base++) {
    for (const offset of offsets) {
      const br = +(base + offset).toFixed(1);
      if (br <= maxBR) brs.push(br);
    }
  }
  return brs;
}

/** 标准 BR 序列（预生成到 16.0 以适应未来更新） */
export const BATTLE_RATINGS = generateBRSequence(16.0);

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

// 月份配置现在从 statsMonthService 动态获取
// 导入动态月份服务
import {
  getAvailableMonths,
  getDefaultMonthId,
  isValidMonthId,
  getMonthConfig,
  getMonthIndex,
} from '../services/statsMonthService';

/**
 * 统计数据月份 ID
 * 
 * 注意：这里使用 string 类型而非联合类型，因为月份列表是动态从数据中提取的。
 * 运行时验证通过 isValidStatsMonthId() 函数进行。
 */
export type StatsMonthId = string;

/** 月份配置（兼容旧接口） */
export interface StatsMonthConfig {
  id: StatsMonthId;
  label: string;      // 如 "2025年2月"
  shortLabel: string; // 如 "25年2月"
}

/**
 * 获取所有可用的统计数据月份配置（按时间从早到晚排序）
 * 
 * 注意：这是一个函数而非常量，因为月份列表是动态加载的。
 * 在数据加载完成后调用此函数获取最新的月份列表。
 */
export const getStatsMonths = (): StatsMonthConfig[] => {
  const months = getAvailableMonths();
  // 转换为兼容旧接口的格式
  return months.map(m => ({
    id: m.id,
    label: m.label,
    shortLabel: m.shortLabel,
  }));
};

/**
 * @deprecated 使用 getStatsMonths() 函数代替
 * 保留此常量仅为向后兼容，但它可能为空数组（在数据加载前）
 */
export const STATS_MONTHS: StatsMonthConfig[] = [];

/**
 * 获取默认统计数据月份（最新月份）
 * 
 * 注意：在数据加载完成前可能返回空字符串
 */
export const getDefaultStatsMonth = (): StatsMonthId => getDefaultMonthId();

/**
 * @deprecated 使用 getDefaultStatsMonth() 函数代替
 * 保留此常量仅为初始化时使用
 */
export const DEFAULT_STATS_MONTH: StatsMonthId = '';

/** 根据月份ID获取配置 */
export const getStatsMonthConfig = (monthId: StatsMonthId): StatsMonthConfig | undefined => {
  const config = getMonthConfig(monthId);
  if (!config) return undefined;
  return {
    id: config.id,
    label: config.label,
    shortLabel: config.shortLabel,
  };
};

/** 验证月份ID是否有效 */
export const isValidStatsMonthId = (value: string): value is StatsMonthId =>
  isValidMonthId(value);

/** 获取月份在列表中的索引 */
export const getStatsMonthIndex = (monthId: StatsMonthId): number =>
  getMonthIndex(monthId);

// ============================================================================
// Stats Month Range Types (for date range filtering)
// ============================================================================

/** 统计数据月份范围 */
export interface StatsMonthRange {
  startMonth: StatsMonthId;
  endMonth: StatsMonthId;
}

/**
 * 获取默认统计数据月份范围（最新月份，单月模式）
 * 
 * 注意：在数据加载完成前可能返回空字符串
 */
export const getDefaultStatsMonthRange = (): StatsMonthRange => {
  const defaultMonth = getDefaultStatsMonth();
  return {
    startMonth: defaultMonth,
    endMonth: defaultMonth,
  };
};

/**
 * @deprecated 使用 getDefaultStatsMonthRange() 函数代替
 * 保留此常量仅为初始化时使用
 */
export const DEFAULT_STATS_MONTH_RANGE: StatsMonthRange = {
  startMonth: '',
  endMonth: '',
};

/** 验证月份范围是否有效（endMonth 不早于 startMonth） */
export const isValidMonthRange = (range: StatsMonthRange): boolean => {
  const startIndex = getStatsMonthIndex(range.startMonth);
  const endIndex = getStatsMonthIndex(range.endMonth);
  return startIndex >= 0 && endIndex >= 0 && startIndex <= endIndex;
};

/** 获取范围内的所有月份 ID（按时间顺序） */
export const getMonthsInRange = (range: StatsMonthRange): StatsMonthId[] => {
  const startIndex = getStatsMonthIndex(range.startMonth);
  const endIndex = getStatsMonthIndex(range.endMonth);
  
  if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) {
    return [];
  }
  
  const months = getStatsMonths();
  return months.slice(startIndex, endIndex + 1).map(m => m.id);
};

/** 生成范围的缓存键 */
export const getMonthRangeCacheKey = (range: StatsMonthRange): string =>
  `${range.startMonth}_${range.endMonth}`;

/** 判断范围是否为单月模式 */
export const isSingleMonthRange = (range: StatsMonthRange): boolean =>
  range.startMonth === range.endMonth;

/** 获取月份范围的显示标签 */
export const getMonthRangeLabel = (range: StatsMonthRange): string => {
  const startConfig = getStatsMonthConfig(range.startMonth);
  const endConfig = getStatsMonthConfig(range.endMonth);
  
  if (!startConfig || !endConfig) return '';
  
  if (range.startMonth === range.endMonth) {
    return startConfig.shortLabel;
  }
  
  return `${startConfig.shortLabel} ~ ${endConfig.shortLabel}`;
};
