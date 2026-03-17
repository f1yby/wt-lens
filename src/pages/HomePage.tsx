import { useState, useMemo, useEffect, useRef } from 'react';
import ListPageLayout from '../components/ListPageLayout';
import VehicleTechTree from '../components/VehicleTechTree';
import { loadVehiclesLight, mergePackagedStatsIntoVehicles } from '../data/vehicles';
import type { Nation, VehicleType, Vehicle } from '../types';
import { BATTLE_RATINGS } from '../types';
import { useGameMode } from '../hooks/useGameMode';
import { useStatsMonthRange } from '../hooks/useStatsMonth';

export default function HomePage() {
  const [selectedNations, setSelectedNations] = useState<Nation[]>([]);
  const [brRange, setBrRange] = useState<[number, number]>([BATTLE_RATINGS[0], BATTLE_RATINGS[BATTLE_RATINGS.length - 1]]);
  const [selectedType, setSelectedType] = useState<VehicleType | 'all'>('all');
  const [showUnreleased, setShowUnreleased] = useState(false);
  const [showGhost, setShowGhost] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);

  const { gameMode, handleGameModeChange } = useGameMode();
  const { statsMonthRange, handleStatsMonthRangeChange } = useStatsMonthRange();
  
  // Track last loaded params to avoid duplicate loads
  const lastLoadRef = useRef<string | null>(null);

  // Step 1: Load vehicle list immediately (fast, no stats)
  useEffect(() => {
    setLoading(true);
    loadVehiclesLight()
      .then(setVehicles)
      .finally(() => setLoading(false));
  }, []);

  // Step 2: Load stats on demand when month range or game mode changes
  useEffect(() => {
    if (vehicles.length === 0 || !statsMonthRange.startMonth || !statsMonthRange.endMonth) return;
    
    // Skip if same params as last load
    const loadKey = `${statsMonthRange.startMonth}-${statsMonthRange.endMonth}-${gameMode}`;
    if (lastLoadRef.current === loadKey) return;
    
    setLoadingStats(true);
    mergePackagedStatsIntoVehicles(vehicles, statsMonthRange, gameMode)
      .then(setVehicles)
      .then(() => {
        lastLoadRef.current = loadKey;
      })
      .finally(() => setLoadingStats(false));
  }, [statsMonthRange, gameMode, vehicles.length]);

  const safeVehicles = vehicles ?? [];

  // 计算数据中的实际最大 BR，用于 BR 筛选器
  const availableBRs = useMemo(() => {
    if (safeVehicles.length === 0) return [];
    const maxBR = Math.max(...safeVehicles.map(v => v.battleRating));
    return BATTLE_RATINGS.filter(br => br <= maxBR);
  }, [safeVehicles]);

  // 数据加载完成后，校正 brRange 到实际可用范围
  useEffect(() => {
    if (availableBRs.length > 0) {
      setBrRange([availableBRs[0], availableBRs[availableBRs.length - 1]]);
    }
  }, [availableBRs]);

  const filteredVehicles = useMemo(() => {
    return safeVehicles.filter(vehicle => {
      const nationMatch = selectedNations.length === 0 || selectedNations.includes(vehicle.nation);
      const vehicleBR = vehicle.br?.[gameMode] ?? vehicle.battleRating;
      const brMatch = vehicleBR >= brRange[0] && vehicleBR <= brRange[1];
      const typeMatch = selectedType === 'all' || vehicle.vehicleType === selectedType;
      const unreleasedMatch = showUnreleased || !vehicle.unreleased;
      const ghostMatch = showGhost || !vehicle.ghost;
      return nationMatch && brMatch && typeMatch && unreleasedMatch && ghostMatch;
    });
  }, [safeVehicles, selectedNations, brRange, selectedType, showUnreleased, showGhost, gameMode]);

  return (
    <ListPageLayout
      gameMode={gameMode}
      onGameModeChange={handleGameModeChange}
      selectedNations={selectedNations}
      onNationsChange={setSelectedNations}
      brRange={brRange}
      onBrRangeChange={setBrRange}
      selectedType={selectedType}
      onTypeChange={setSelectedType}
      showUnreleased={showUnreleased}
      onShowUnreleasedChange={setShowUnreleased}
      showGhost={showGhost}
      onShowGhostChange={setShowGhost}
      availableBRs={availableBRs}
      statsMonthRange={statsMonthRange}
      onStatsMonthRangeChange={handleStatsMonthRangeChange}
      loading={loading}
      loadingStats={loadingStats}
      filteredCount={filteredVehicles.length}
      countLabel="个载具"
    >
      <VehicleTechTree vehicles={filteredVehicles} gameMode={gameMode} />
    </ListPageLayout>
  );
}
