import { describe, it, expect } from 'vitest';
import { getMetricValue, generateVehicleComparisonData, getVehicleBR } from './vehicleComparison';
import type { Vehicle, GameMode } from '../types';

// Mock vehicle factory
function createMockVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'test_vehicle',
    name: 'Test Vehicle',
    localizedName: 'Test Vehicle',
    nation: 'us',
    rank: 5,
    battleRating: 9.0,
    vehicleType: 'medium_tank',
    economicType: 'regular',
    performance: {
      horsepower: 1000,
      weight: 50,
      powerToWeight: 20,
      maxReverseSpeed: 10,
      reloadTime: 8,
      penetration: 400,
      maxSpeed: 60,
      crewCount: 4,
      elevationSpeed: 15,
      traverseSpeed: 24,
      hasStabilizer: true,
      stabilizerType: 'both',
      elevationRange: [-6, 20],
      traverseRange: [-180, 180],
      gunnerThermalResolution: [320, 240],
      commanderThermalResolution: [0, 0],
      gunnerThermalDiagonal: 400,
      commanderThermalDiagonal: 0,
      stabilizerValue: 3,
      elevationRangeValue: 26,
    },
    ...overrides,
  } as Vehicle;
}

describe('getMetricValue', () => {
  it('should return correct powerToWeight value', () => {
    const vehicle = createMockVehicle();
    expect(getMetricValue(vehicle, 'powerToWeight')).toBe(20);
  });

  it('should return 0 for vehicle with empty performance', () => {
    const vehicle = createMockVehicle({
      performance: {
        horsepower: 0,
        weight: 0,
        powerToWeight: 0,
        maxReverseSpeed: 0,
        reloadTime: 0,
        penetration: 0,
        maxSpeed: 0,
        crewCount: 0,
        elevationSpeed: 0,
        traverseSpeed: 0,
        hasStabilizer: false,
        stabilizerType: 'none',
        elevationRange: [0, 0],
        traverseRange: [0, 0],
        gunnerThermalResolution: [0, 0],
        commanderThermalResolution: [0, 0],
        gunnerThermalDiagonal: 0,
        commanderThermalDiagonal: 0,
        stabilizerValue: 0,
        elevationRangeValue: 0,
      },
    });
    expect(getMetricValue(vehicle, 'powerToWeight')).toBe(0);
    expect(getMetricValue(vehicle, 'maxSpeed')).toBe(0);
    expect(getMetricValue(vehicle, 'penetration')).toBe(0);
  });
});

describe('getVehicleBR', () => {
  it('should return mode-specific BR when available', () => {
    const vehicle = createMockVehicle({
      br: { arcade: 8.7, historical: 9.0, simulation: 9.3 } as Record<GameMode, number>,
    });
    expect(getVehicleBR(vehicle, 'historical')).toBe(9.0);
    expect(getVehicleBR(vehicle, 'arcade')).toBe(8.7);
    expect(getVehicleBR(vehicle, 'simulation')).toBe(9.3);
  });

  it('should fall back to battleRating when mode-specific BR not available', () => {
    const vehicle = createMockVehicle();
    expect(getVehicleBR(vehicle, 'historical')).toBe(9.0);
  });
});

describe('generateVehicleComparisonData', () => {
  const gameMode: GameMode = 'historical';

  it('should return null if current vehicle not found', () => {
    const vehicles = [createMockVehicle({ id: 'other' })];
    const result = generateVehicleComparisonData('nonexistent', 'powerToWeight', vehicles, gameMode);
    expect(result).toBeNull();
  });

  it('should return data for current vehicle even with no other vehicles in range', () => {
    const vehicle = createMockVehicle();
    const vehicles = [vehicle];
    const result = generateVehicleComparisonData(vehicle.id, 'powerToWeight', vehicles, gameMode);
    expect(result).not.toBeNull();
    expect(result?.bins.length).toBe(1);
    expect(result?.currentVehicleBin).toBe(0);
    expect(result?.currentVehicleValue).toBe(20);
  });

  it('should include other vehicles within BR range with valid performance data', () => {
    const currentVehicle = createMockVehicle({ id: 'current', battleRating: 9.0 });
    const inRangeVehicle = createMockVehicle({
      id: 'in_range',
      battleRating: 8.7,
      performance: { ...currentVehicle.performance, powerToWeight: 18 },
    });
    const outOfRangeVehicle = createMockVehicle({
      id: 'out_of_range',
      battleRating: 12.0,
    });
    const zeroPerformanceVehicle = createMockVehicle({
      id: 'zero_perf',
      battleRating: 9.0,
      performance: {
        horsepower: 0,
        weight: 0,
        powerToWeight: 0,
        maxReverseSpeed: 0,
        reloadTime: 0,
        penetration: 0,
        maxSpeed: 0,
        crewCount: 0,
        elevationSpeed: 0,
        traverseSpeed: 0,
        hasStabilizer: false,
        stabilizerType: 'none',
        elevationRange: [0, 0],
        traverseRange: [0, 0],
        gunnerThermalResolution: [0, 0],
        commanderThermalResolution: [0, 0],
        gunnerThermalDiagonal: 0,
        commanderThermalDiagonal: 0,
        stabilizerValue: 0,
        elevationRangeValue: 0,
      },
    });

    const vehicles = [currentVehicle, inRangeVehicle, outOfRangeVehicle, zeroPerformanceVehicle];
    const result = generateVehicleComparisonData(currentVehicle.id, 'powerToWeight', vehicles, gameMode, {
      brMin: 8.0,
      brMax: 10.0,
    });

    expect(result).not.toBeNull();
    // Should include current vehicle and in-range vehicle with valid performance
    // Should exclude out-of-range vehicle and zero-performance vehicle
    expect(result?.bins.length).toBe(2);
    const ids = result?.bins.map(b => b.vehicleId);
    expect(ids).toContain('current');
    expect(ids).toContain('in_range');
    expect(ids).not.toContain('out_of_range');
    expect(ids).not.toContain('zero_perf');
  });

  it('should filter by vehicle types when specified', () => {
    const currentVehicle = createMockVehicle({ id: 'current', battleRating: 9.0, vehicleType: 'medium_tank' });
    const tankInRange = createMockVehicle({
      id: 'tank',
      battleRating: 9.0,
      vehicleType: 'medium_tank',
      performance: { ...currentVehicle.performance, powerToWeight: 18 },
    });
    const spaaInRange = createMockVehicle({
      id: 'spaa',
      battleRating: 9.0,
      vehicleType: 'spaa',
      performance: { ...currentVehicle.performance, powerToWeight: 15 },
    });

    const vehicles = [currentVehicle, tankInRange, spaaInRange];
    const result = generateVehicleComparisonData(currentVehicle.id, 'powerToWeight', vehicles, gameMode, {
      brMin: 8.0,
      brMax: 10.0,
      vehicleTypes: ['medium_tank'],
    });

    expect(result).not.toBeNull();
    expect(result?.bins.length).toBe(2); // current + tank
    const types = result?.bins.map(b => vehicles.find(v => v.id === b.vehicleId)?.vehicleType);
    expect(types?.every(t => t === 'medium_tank')).toBe(true);
  });

  it('should always include current vehicle even if it has zero metric value', () => {
    const currentVehicle = createMockVehicle({
      id: 'current',
      performance: {
        horsepower: 0,
        weight: 0,
        powerToWeight: 0, // Zero value
        maxReverseSpeed: 0,
        reloadTime: 0,
        penetration: 0,
        maxSpeed: 0,
        crewCount: 0,
        elevationSpeed: 0,
        traverseSpeed: 0,
        hasStabilizer: false,
        stabilizerType: 'none',
        elevationRange: [0, 0],
        traverseRange: [0, 0],
        gunnerThermalResolution: [0, 0],
        commanderThermalResolution: [0, 0],
        gunnerThermalDiagonal: 0,
        commanderThermalDiagonal: 0,
        stabilizerValue: 0,
        elevationRangeValue: 0,
      },
    });
    const vehicles = [currentVehicle];

    const result = generateVehicleComparisonData(currentVehicle.id, 'powerToWeight', vehicles, gameMode);

    // Should return null because current vehicle has zero metric value
    expect(result).toBeNull();
  });

  it('should mark current vehicle with orange color', () => {
    const currentVehicle = createMockVehicle();
    const vehicles = [currentVehicle];

    const result = generateVehicleComparisonData(currentVehicle.id, 'powerToWeight', vehicles, gameMode);

    expect(result).not.toBeNull();
    const currentBin = result?.bins.find(b => b.isCurrent);
    expect(currentBin?.dotColor).toBe('#f97316'); // Orange
  });
});
