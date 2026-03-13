/**
 * Vehicle detail page configuration
 * Provides type-specific settings for the generic DetailPage component
 */
import type { GameMode, Nation, DistributionData, MetricType, EconomyData } from '../types';

/** Base vehicle interface shared by all vehicle types */
export interface BaseVehicle {
  id: string;
  name: string;
  localizedName: string;
  nation: Nation;
  rank: number;
  battleRating: number;
  br?: Record<GameMode, number>;
  economicType: string;
  releaseDate?: string;
  unreleased?: boolean;
}

/** Stats data returned by getStats function */
export interface VehicleStats {
  battles: number;
  winRate: number;
  killPerSpawn: number;
  expPerSpawn?: number;
}

/** Configuration for a vehicle type's detail page */
export interface VehicleDetailConfig<V extends BaseVehicle, T extends string = string> {
  /** Display name for error messages */
  vehicleTypeName: string;
  
  /** Route path for list page */
  listPath: string;
  
  /** Route prefix for navigation */
  navPrefix: string;
  
  /** Load all vehicles of this type */
  loadVehicles: () => Promise<V[]>;
  
  /** Load detailed data for a single vehicle */
  loadDetail?: (id: string) => Promise<{ performance?: unknown; economy?: EconomyData } | null>;
  
  /** Get stats for a specific game mode */
  getStats: (vehicle: V, gameMode: GameMode) => VehicleStats | null;
  
  /** Get BR for a specific game mode */
  getBR: (vehicle: V, gameMode: GameMode) => number;
  
  /** Get image path for a vehicle */
  getImagePath: (id: string) => string;
  
  /** All available types for filtering */
  allTypes: T[];
  
  /** Type labels for display */
  typeLabels: Record<T, string>;
  
  /** Get type from vehicle */
  getType: (vehicle: V) => T;
  
  /** Generate stats comparison data */
  generateStatsComparison: (
    vehicleId: string,
    metric: 'killPerSpawn' | 'winRate' | 'expPerSpawn',
    allVehicles: V[],
    gameMode: GameMode,
    filter: { types: T[]; brMin: number; brMax: number }
  ) => DistributionData | null;
  
  /** Whether to show month range selector */
  showMonthRangeSelector?: boolean;
  
  /** Additional performance charts to show (for ground vehicles) */
  performanceCharts?: {
    metric: MetricType;
    title: string;
    unit: string;
  }[];
  
  /** Render additional sections after economy (like mobility, armaments) */
  renderAdditionalSections?: (vehicle: V, gameMode: GameMode, onNavigate: (url: string) => void) => React.ReactNode;
  
  /** Render performance stats bar in header (for ground vehicles) */
  renderHeaderStats?: (vehicle: V, gameMode: GameMode) => React.ReactNode;
}
