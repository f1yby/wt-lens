import type { GameMode } from '../types';
import { GAME_MODES, DEFAULT_GAME_MODE } from '../types';

const GAME_MODE_STORAGE_KEY = 'wt-lens-game-mode';

/**
 * Get game mode from URL search params
 */
export function getGameModeFromURL(searchParams: URLSearchParams): GameMode | null {
  const mode = searchParams.get('mode');
  if (mode && GAME_MODES.some(m => m.id === mode)) {
    return mode as GameMode;
  }
  return null;
}

/**
 * Get game mode from localStorage
 */
export function getGameModeFromStorage(): GameMode | null {
  try {
    const stored = localStorage.getItem(GAME_MODE_STORAGE_KEY);
    if (stored && GAME_MODES.some(m => m.id === stored)) {
      return stored as GameMode;
    }
  } catch {
    // localStorage may not be available
  }
  return null;
}

/**
 * Save game mode to localStorage
 */
export function saveGameModeToStorage(mode: GameMode): void {
  try {
    localStorage.setItem(GAME_MODE_STORAGE_KEY, mode);
  } catch {
    // localStorage may not be available
  }
}

/**
 * Get initial game mode (from URL, storage, or default)
 */
export function getInitialGameMode(searchParams: URLSearchParams): GameMode {
  // Priority: URL > localStorage > default
  return getGameModeFromURL(searchParams) 
    ?? getGameModeFromStorage() 
    ?? DEFAULT_GAME_MODE;
}

/**
 * Update URL with game mode
 */
export function updateURLWithGameMode(
  searchParams: URLSearchParams,
  setSearchParams: (params: URLSearchParams) => void,
  mode: GameMode
): void {
  const newParams = new URLSearchParams(searchParams);
  newParams.set('mode', mode);
  setSearchParams(newParams);
}

/**
 * Format win rate for display
 */
export function formatWinRate(winRate: number): string {
  return `${winRate.toFixed(1)}%`;
}

/**
 * Format KPS (kills per spawn) for display
 */
export function formatKPS(kps: number): string {
  return kps.toFixed(2);
}

/**
 * Get color based on win rate
 */
export function getWinRateColor(winRate: number): string {
  if (winRate >= 55) return '#16a34a'; // Green - very good
  if (winRate >= 50) return '#65a30d'; // Light green - good
  if (winRate >= 45) return '#ca8a04'; // Yellow - average
  return '#dc2626'; // Red - below average
}

/**
 * Get color based on KPS
 */
export function getKPSColor(kps: number): string {
  if (kps >= 1.5) return '#16a34a'; // Green - very good
  if (kps >= 1.0) return '#65a30d'; // Light green - good
  if (kps >= 0.7) return '#ca8a04'; // Yellow - average
  return '#dc2626'; // Red - below average
}
