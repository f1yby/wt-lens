/**
 * Vehicle comparison utilities for generating chart data.
 */
import type { Vehicle, MetricType, VehicleType, GameMode, DistributionData } from '../types';
import { getVehicleStatsByMode } from '../data/vehicles';
import { getBRGradientColor } from './chart';

/** Filter options for comparison charts */
export interface ComparisonFilter {
  vehicleTypes?: VehicleType[];
  brMin?: number;
  brMax?: number;
}

/** Gets the numeric value for a given metric from vehicle performance data */
export function getMetricValue(vehicle: Vehicle, metric: MetricType): number {
  const { performance } = vehicle;
  
  switch (metric) {
    case 'powerToWeight': return performance.powerToWeight;
    case 'maxReverseSpeed': return performance.maxReverseSpeed;
    case 'reloadTime': return performance.reloadTime;
    case 'penetration': return performance.penetration;
    case 'maxSpeed': return performance.maxSpeed;
    case 'traverseSpeed': return performance.traverseSpeed;
    case 'elevationSpeed': return performance.elevationSpeed;
    case 'elevationMin': return performance.elevationRange[0] ?? 0;
    case 'gunnerThermal': return performance.gunnerThermalDiagonal ?? 0;
    case 'commanderThermal': return performance.commanderThermalDiagonal ?? 0;
    case 'stabilizer': return performance.stabilizerValue ?? 0;
    default: return 0;
  }
}

/** Get vehicle BR for the current game mode */
export function getVehicleBR(vehicle: Vehicle, gameMode: GameMode): number {
  return vehicle.br?.[gameMode] ?? vehicle.battleRating;
}

/** Generates scatter data for vehicle comparison charts */
export function generateVehicleComparisonData(
  vehicleId: string,
  metric: MetricType,
  allVehicles: Vehicle[],
  gameMode: GameMode,
  filter?: ComparisonFilter
): DistributionData | null {
  const vehicle = allVehicles.find(v => v.id === vehicleId);
  if (!vehicle) return null;

  const targetBR = getVehicleBR(vehicle, gameMode);
  const brMin = filter?.brMin ?? (targetBR - 1.0);
  const brMax = filter?.brMax ?? (targetBR + 1.0);

  const value = getMetricValue(vehicle, metric);

  // Filter vehicles within BR range with valid metric (always include current vehicle)
  const filteredVehicles = allVehicles.filter(v => {
    // Always include current vehicle regardless of filters
    if (v.id === vehicleId) {
      return getMetricValue(v, metric) > 0;
    }
    const metricValue = getMetricValue(v, metric);
    if (metricValue <= 0) return false;
    const vBR = getVehicleBR(v, gameMode);
    if (vBR < brMin || vBR > brMax) return false;
    if (filter?.vehicleTypes && filter.vehicleTypes.length > 0 && !filter.vehicleTypes.includes(v.vehicleType)) return false;
    return true;
  });

  if (filteredVehicles.length === 0) return null;

  const lowerSpan = Math.max(targetBR - brMin, 0.1);
  const upperSpan = Math.max(brMax - targetBR, 0.1);

  const bins = filteredVehicles.map((v) => {
    const vBR = getVehicleBR(v, gameMode);
    const brDiff = parseFloat((vBR - targetBR).toFixed(2));
    const isCurrent = v.id === vehicleId;

    return {
      range: v.localizedName,
      metricValue: getMetricValue(v, metric),
      battles: v.stats?.battles ?? 0,
      isCurrent,
      vehicleId: v.id,
      brDiff,
      dotColor: isCurrent ? '#f97316' : getBRGradientColor(brDiff, lowerSpan, upperSpan),
    };
  });

  const currentVehicleBin = bins.findIndex(b => b.isCurrent);

  return {
    metric,
    bins,
    currentVehicleBin: Math.max(0, currentVehicleBin),
    currentVehicleValue: value,
    allValues: filteredVehicles.map(v => ({
      vehicleId: v.id,
      value: getMetricValue(v, metric),
    })),
  };
}

/** Stats metric types for comparison */
export type StatsMetricType = 'killPerSpawn' | 'winRate' | 'expPerSpawn';

/** Gets the numeric value for a given stats metric for a specific game mode */
export function getStatsMetricValue(vehicle: Vehicle, metric: StatsMetricType, gameMode: GameMode): number {
  const stats = getVehicleStatsByMode(vehicle, gameMode);
  if (!stats) return 0;

  switch (metric) {
    case 'killPerSpawn': return stats.killPerSpawn;
    case 'winRate': return stats.winRate;
    case 'expPerSpawn': return stats.expPerSpawn ?? 0;
    default: return 0;
  }
}

/** Generates scatter data for stats comparison charts (KR, winRate) */
export function generateStatsComparisonData(
  vehicleId: string,
  metric: StatsMetricType,
  allVehicles: Vehicle[],
  gameMode: GameMode,
  filter?: ComparisonFilter,
): DistributionData | null {
  const vehicle = allVehicles.find(v => v.id === vehicleId);
  if (!vehicle) return null;

  const targetBR = getVehicleBR(vehicle, gameMode);
  const brMin = filter?.brMin ?? (targetBR - 1.0);
  const brMax = filter?.brMax ?? (targetBR + 1.0);

  const value = getStatsMetricValue(vehicle, metric, gameMode);

  // Filter vehicles within BR range with valid stats data (always include current vehicle)
  const filteredVehicles = allVehicles.filter(v => {
    const vStats = getVehicleStatsByMode(v, gameMode);
    // Always include current vehicle regardless of filters
    if (v.id === vehicleId) {
      return vStats && vStats.battles > 0 && getStatsMetricValue(v, metric, gameMode) > 0;
    }
    const metricValue = getStatsMetricValue(v, metric, gameMode);
    const vBR = getVehicleBR(v, gameMode);
    if (vBR < brMin || vBR > brMax) return false;
    if (!vStats || vStats.battles <= 0 || metricValue <= 0) return false;
    if (filter?.vehicleTypes && filter.vehicleTypes.length > 0 && !filter.vehicleTypes.includes(v.vehicleType)) return false;
    return true;
  });

  if (filteredVehicles.length === 0) return null;

  const lowerSpan = Math.max(targetBR - brMin, 0.1);
  const upperSpan = Math.max(brMax - targetBR, 0.1);

  const bins = filteredVehicles.map((v) => {
    const vStats = getVehicleStatsByMode(v, gameMode);
    const vBR = getVehicleBR(v, gameMode);
    const brDiff = parseFloat((vBR - targetBR).toFixed(2));
    const isCurrent = v.id === vehicleId;

    return {
      range: v.localizedName,
      metricValue: getStatsMetricValue(v, metric, gameMode),
      battles: vStats?.battles ?? 0,
      isCurrent,
      vehicleId: v.id,
      brDiff,
      dotColor: isCurrent ? '#f97316' : getBRGradientColor(brDiff, lowerSpan, upperSpan),
    };
  });

  const currentVehicleBin = bins.findIndex(b => b.isCurrent);

  return {
    metric: metric as MetricType, // Cast for compatibility with DistributionChart
    bins,
    currentVehicleBin: Math.max(0, currentVehicleBin),
    currentVehicleValue: value,
    allValues: filteredVehicles.map(v => ({
      vehicleId: v.id,
      value: getStatsMetricValue(v, metric, gameMode),
    })),
  };
}
