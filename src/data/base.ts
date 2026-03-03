/**
 * Base module for shared data loading utilities.
 * Contains common types and functions used by vehicles, aircraft, and ships data modules.
 */
import type { GameMode, VehicleStats } from '../types';

/**
 * StatShark entry from stats.json / aircraft-stats.json / ship-stats.json
 */
export interface StatSharkEntry {
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

/**
 * Clean vehicle/aircraft/ship name: only remove zero-width spaces.
 * Keep special WT symbols (␗, ▄, etc.) - they are rendered via WTSymbols font.
 */
export function cleanName(name: string): string {
  if (!name) return name;
  return name.replace(/\u200b/g, '');
}

/**
 * Build StatShark stats map grouped by game mode
 * Returns a map of vehicleId -> Record<GameMode, StatSharkEntry>
 */
export function buildStatsMapByMode(stats: StatSharkEntry[]): Map<string, Record<GameMode, StatSharkEntry | undefined>> {
  const statsMap = new Map<string, Record<GameMode, StatSharkEntry | undefined>>();

  for (const entry of stats) {
    const mode = entry.mode as GameMode;
    if (!statsMap.has(entry.id)) {
      statsMap.set(entry.id, { arcade: undefined, historical: undefined, simulation: undefined });
    }
    const modeRecord = statsMap.get(entry.id)!;
    modeRecord[mode] = entry;
  }

  return statsMap;
}

/**
 * Convert StatShark entry to VehicleStats
 */
export function convertToVehicleStats(entry: StatSharkEntry | undefined): VehicleStats | undefined {
  if (!entry) return undefined;
  return {
    battles: entry.battles,
    winRate: entry.win_rate,
    killPerSpawn: entry.avg_kills_per_spawn,
    expPerSpawn: entry.exp_per_spawn,
  };
}
