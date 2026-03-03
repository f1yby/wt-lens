import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { GameMode } from '../types';
import {
  getInitialGameMode,
  saveGameModeToStorage,
  updateURLWithGameMode,
} from '../utils/gameMode';

/**
 * Return type for useGameMode hook
 */
export interface UseGameModeReturn {
  /** Current game mode (arcade | historical | simulation) */
  gameMode: GameMode;
  /** Handler to change game mode - updates state, localStorage, and URL */
  handleGameModeChange: (mode: GameMode) => void;
}

/**
 * Custom hook for managing game mode state with URL sync and localStorage persistence.
 * 
 * Features:
 * - Initializes from URL params > localStorage > default (historical)
 * - Syncs changes to both URL and localStorage
 * - Responds to external URL changes (e.g., browser back/forward)
 * 
 * @example
 * ```tsx
 * function MyPage() {
 *   const { gameMode, handleGameModeChange } = useGameMode();
 *   
 *   return (
 *     <GameModeSelector
 *       currentMode={gameMode}
 *       onModeChange={handleGameModeChange}
 *     />
 *   );
 * }
 * ```
 */
export function useGameMode(): UseGameModeReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize game mode from URL or storage
  const [gameMode, setGameMode] = useState<GameMode>(() =>
    getInitialGameMode(searchParams)
  );

  // Handle game mode change - memoized to prevent unnecessary re-renders
  const handleGameModeChange = useCallback((mode: GameMode) => {
    setGameMode(mode);
    saveGameModeToStorage(mode);
    updateURLWithGameMode(searchParams, setSearchParams, mode);
  }, [searchParams, setSearchParams]);

  // Sync game mode from URL on mount and when URL changes externally
  // (e.g., browser back/forward navigation)
  useEffect(() => {
    const urlMode = searchParams.get('mode') as GameMode | null;
    if (urlMode && urlMode !== gameMode) {
      setGameMode(urlMode);
    }
  }, [searchParams, gameMode]);

  return {
    gameMode,
    handleGameModeChange,
  };
}

export default useGameMode;
