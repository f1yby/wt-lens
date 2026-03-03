import { describe, it, expect } from 'vitest';
import {
  cleanName,
  buildStatsMapByMode,
  convertToVehicleStats,
  type StatSharkEntry,
} from './base';

describe('data/base utilities', () => {
  describe('cleanName', () => {
    it('should remove zero-width spaces', () => {
      const nameWithZWS = 'Test\u200bName\u200b123';
      expect(cleanName(nameWithZWS)).toBe('TestName123');
    });

    it('should preserve special WT symbols', () => {
      const nameWithSymbol = '␗M1A2 SEP';
      expect(cleanName(nameWithSymbol)).toBe('␗M1A2 SEP');
    });

    it('should handle empty string', () => {
      expect(cleanName('')).toBe('');
    });

    it('should handle null/undefined gracefully', () => {
      expect(cleanName(null as unknown as string)).toBeFalsy();
      expect(cleanName(undefined as unknown as string)).toBeFalsy();
    });

    it('should preserve regular characters', () => {
      expect(cleanName('Leopard 2A7V')).toBe('Leopard 2A7V');
    });
  });

  describe('buildStatsMapByMode', () => {
    const sampleStats: StatSharkEntry[] = [
      {
        id: 'us_m1_abrams',
        name: 'M1 Abrams',
        mode: 'arcade',
        battles: 10000,
        win_rate: 52.5,
        avg_kills_per_spawn: 1.2,
        exp_per_spawn: 1500,
      },
      {
        id: 'us_m1_abrams',
        name: 'M1 Abrams',
        mode: 'historical',
        battles: 25000,
        win_rate: 48.3,
        avg_kills_per_spawn: 0.95,
        exp_per_spawn: 2000,
      },
      {
        id: 'germ_leopard_2a6',
        name: 'Leopard 2A6',
        mode: 'historical',
        battles: 30000,
        win_rate: 55.0,
        avg_kills_per_spawn: 1.5,
      },
    ];

    it('should group stats by vehicle ID and mode', () => {
      const map = buildStatsMapByMode(sampleStats);
      
      expect(map.size).toBe(2); // Two unique vehicles
      
      const m1Stats = map.get('us_m1_abrams');
      expect(m1Stats?.arcade).toBeDefined();
      expect(m1Stats?.historical).toBeDefined();
      expect(m1Stats?.simulation).toBeUndefined();
    });

    it('should preserve all stats data', () => {
      const map = buildStatsMapByMode(sampleStats);
      
      const m1Arcade = map.get('us_m1_abrams')?.arcade;
      expect(m1Arcade?.battles).toBe(10000);
      expect(m1Arcade?.win_rate).toBe(52.5);
      expect(m1Arcade?.avg_kills_per_spawn).toBe(1.2);
    });

    it('should handle empty input', () => {
      const map = buildStatsMapByMode([]);
      expect(map.size).toBe(0);
    });
  });

  describe('convertToVehicleStats', () => {
    it('should convert StatSharkEntry to VehicleStats', () => {
      const entry: StatSharkEntry = {
        id: 'test',
        name: 'Test',
        mode: 'historical',
        battles: 5000,
        win_rate: 51.2,
        avg_kills_per_spawn: 1.1,
        exp_per_spawn: 1800,
      };

      const stats = convertToVehicleStats(entry);
      
      expect(stats).toBeDefined();
      expect(stats?.battles).toBe(5000);
      expect(stats?.winRate).toBe(51.2);
      expect(stats?.killPerSpawn).toBe(1.1);
      expect(stats?.expPerSpawn).toBe(1800);
    });

    it('should return undefined for undefined input', () => {
      expect(convertToVehicleStats(undefined)).toBeUndefined();
    });

    it('should handle missing optional fields', () => {
      const entry: StatSharkEntry = {
        id: 'test',
        name: 'Test',
        mode: 'arcade',
        battles: 1000,
        win_rate: 50.0,
        avg_kills_per_spawn: 1.0,
        // no exp_per_spawn
      };

      const stats = convertToVehicleStats(entry);
      expect(stats?.expPerSpawn).toBeUndefined();
    });
  });
});
