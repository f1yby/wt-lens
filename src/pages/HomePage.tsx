import { useState, useMemo, useEffect } from 'react';
import ListPageLayout from '../components/ListPageLayout';
import VehicleTechTree from '../components/VehicleTechTree';
import { loadVehicles } from '../data/vehicles';
import type { Nation, VehicleType, Vehicle } from '../types';
import { BATTLE_RATINGS } from '../types';
import { useGameMode } from '../hooks/useGameMode';
import { useStatsMonthRange } from '../hooks/useStatsMonth';

export default function HomePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNations, setSelectedNations] = useState<Nation[]>([]);
  const [brRange, setBrRange] = useState<[number, number]>([BATTLE_RATINGS[0], BATTLE_RATINGS[BATTLE_RATINGS.length - 1]]);
  const [selectedType, setSelectedType] = useState<VehicleType | 'all'>('all');
  const [showUnreleased, setShowUnreleased] = useState(false);
  const [showGhost, setShowGhost] = useState(false);

  const { gameMode, handleGameModeChange } = useGameMode();
  const { statsMonthRange, handleStatsMonthRangeChange } = useStatsMonthRange();

  // Reload data when month range changes
  useEffect(() => {
    if (!statsMonthRange.startMonth || !statsMonthRange.endMonth) return;
    let cancelled = false;
    loadVehicles(statsMonthRange).then(data => {
      if (!cancelled) {
        setVehicles(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [statsMonthRange]);

  // 计算数据中的实际最大 BR，用于 BR 筛选器
  const availableBRs = useMemo(() => {
    if (vehicles.length === 0) return [];
    const maxBR = Math.max(...vehicles.map(v => v.battleRating));
    return BATTLE_RATINGS.filter(br => br <= maxBR);
  }, [vehicles]);

  // 数据加载完成后，校正 brRange 到实际可用范围
  useEffect(() => {
    if (availableBRs.length > 0) {
      setBrRange([availableBRs[0], availableBRs[availableBRs.length - 1]]);
    }
  }, [availableBRs]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
      const nationMatch = selectedNations.length === 0 || selectedNations.includes(vehicle.nation);
      const vehicleBR = vehicle.br?.[gameMode] ?? vehicle.battleRating;
      const brMatch = vehicleBR >= brRange[0] && vehicleBR <= brRange[1];
      const typeMatch = selectedType === 'all' || vehicle.vehicleType === selectedType;
      const unreleasedMatch = showUnreleased || !vehicle.unreleased;
      const ghostMatch = showGhost || !vehicle.ghost;
      return nationMatch && brMatch && typeMatch && unreleasedMatch && ghostMatch;
    });
  }, [vehicles, selectedNations, brRange, selectedType, showUnreleased, showGhost, gameMode]);

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
      filteredCount={filteredVehicles.length}
      countLabel="个载具"
    >
      <VehicleTechTree vehicles={filteredVehicles} gameMode={gameMode} />
    </ListPageLayout>
  );
}
