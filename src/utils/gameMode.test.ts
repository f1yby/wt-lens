import { describe, it, expect, beforeEach } from 'vitest';
import {
  getGameModeFromURL,
  getGameModeFromStorage,
  saveGameModeToStorage,
  getInitialGameMode,
  formatWinRate,
  formatKPS,
  getWinRateColor,
  getKPSColor,
} from './gameMode';

describe('gameMode utilities', () => {
  describe('getGameModeFromURL', () => {
    it('should return the mode from URL params', () => {
      const params = new URLSearchParams('mode=arcade');
      expect(getGameModeFromURL(params)).toBe('arcade');
    });

    it('should return null for invalid mode', () => {
      const params = new URLSearchParams('mode=invalid');
      expect(getGameModeFromURL(params)).toBeNull();
    });

    it('should return null when mode param is missing', () => {
      const params = new URLSearchParams('');
      expect(getGameModeFromURL(params)).toBeNull();
    });

    it('should accept all valid modes', () => {
      expect(getGameModeFromURL(new URLSearchParams('mode=arcade'))).toBe('arcade');
      expect(getGameModeFromURL(new URLSearchParams('mode=historical'))).toBe('historical');
      expect(getGameModeFromURL(new URLSearchParams('mode=simulation'))).toBe('simulation');
    });
  });

  describe('localStorage functions', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should save and retrieve game mode from storage', () => {
      saveGameModeToStorage('arcade');
      expect(getGameModeFromStorage()).toBe('arcade');
    });

    it('should return null when storage is empty', () => {
      expect(getGameModeFromStorage()).toBeNull();
    });

    it('should handle invalid stored values', () => {
      localStorage.setItem('wt-lens-game-mode', 'invalid');
      expect(getGameModeFromStorage()).toBeNull();
    });
  });

  describe('getInitialGameMode', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should prioritize URL over storage', () => {
      saveGameModeToStorage('arcade');
      const params = new URLSearchParams('mode=simulation');
      expect(getInitialGameMode(params)).toBe('simulation');
    });

    it('should fall back to storage when URL has no mode', () => {
      saveGameModeToStorage('arcade');
      const params = new URLSearchParams('');
      expect(getInitialGameMode(params)).toBe('arcade');
    });

    it('should return default (historical) when no mode is set', () => {
      const params = new URLSearchParams('');
      expect(getInitialGameMode(params)).toBe('historical');
    });
  });

  describe('formatWinRate', () => {
    it('should format win rate with 1 decimal place', () => {
      expect(formatWinRate(50.123)).toBe('50.1%');
      expect(formatWinRate(75)).toBe('75.0%');
    });
  });

  describe('formatKPS', () => {
    it('should format KPS with 2 decimal places', () => {
      expect(formatKPS(1.234)).toBe('1.23');
      expect(formatKPS(2)).toBe('2.00');
    });
  });

  describe('getWinRateColor', () => {
    it('should return green for very good win rate (>=55)', () => {
      expect(getWinRateColor(55)).toBe('#16a34a');
      expect(getWinRateColor(60)).toBe('#16a34a');
    });

    it('should return light green for good win rate (50-55)', () => {
      expect(getWinRateColor(50)).toBe('#65a30d');
      expect(getWinRateColor(54)).toBe('#65a30d');
    });

    it('should return yellow for average win rate (45-50)', () => {
      expect(getWinRateColor(45)).toBe('#ca8a04');
      expect(getWinRateColor(49)).toBe('#ca8a04');
    });

    it('should return red for below average win rate (<45)', () => {
      expect(getWinRateColor(44)).toBe('#dc2626');
      expect(getWinRateColor(30)).toBe('#dc2626');
    });
  });

  describe('getKPSColor', () => {
    it('should return green for very good KPS (>=1.5)', () => {
      expect(getKPSColor(1.5)).toBe('#16a34a');
      expect(getKPSColor(2.0)).toBe('#16a34a');
    });

    it('should return light green for good KPS (1.0-1.5)', () => {
      expect(getKPSColor(1.0)).toBe('#65a30d');
      expect(getKPSColor(1.4)).toBe('#65a30d');
    });

    it('should return yellow for average KPS (0.7-1.0)', () => {
      expect(getKPSColor(0.7)).toBe('#ca8a04');
      expect(getKPSColor(0.9)).toBe('#ca8a04');
    });

    it('should return red for below average KPS (<0.7)', () => {
      expect(getKPSColor(0.6)).toBe('#dc2626');
      expect(getKPSColor(0.3)).toBe('#dc2626');
    });
  });
});
