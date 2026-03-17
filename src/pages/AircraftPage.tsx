import { useState, useMemo, useEffect, useCallback } from 'react';
import ListPageLayout from '../components/ListPageLayout';
import type { TypeOption } from '../components/VehicleFilter';
import AircraftTechTree from '../components/AircraftTechTree';
import { loadAircraftWithPackagedStats } from '../data/aircraft';
import type { Nation, AircraftType, AircraftVehicle, GameMode, StatsMonthRange } from '../types';
import { BATTLE_RATINGS } from '../types';
import { useGameMode } from '../hooks/useGameMode';
import { useStatsMonthRange } from '../hooks/useStatsMonth';
import { usePackagedLoader } from '../hooks/usePackagedLoader';

const AIRCRAFT_TYPES: TypeOption<AircraftType>[] = [
  { value: 'all', label: '全部' },
  { value: 'fighter', label: '战斗机' },
  { value: 'bomber', label: '轰炸机' },
  { value: 'assault', label: '攻击机' },
];

export default function AircraftPage() {
  const [selectedNations, setSelectedNations] = useState<Nation[]>([]);
  const [brRange, setBrRange] = useState<[number, number]>([BATTLE_RATINGS[0], BATTLE_RATINGS[BATTLE_RATINGS.length - 1]]);
  const [selectedType, setSelectedType] = useState<AircraftType | 'all'>('all');
  const [showUnreleased, setShowUnreleased] = useState(false);
  const [showGhost, setShowGhost] = useState(false);
  const [useGroundBR, setUseGroundBR] = useState(false);

  const { gameMode, handleGameModeChange } = useGameMode();
  const { statsMonthRange, handleStatsMonthRangeChange } = useStatsMonthRange();

  // Loader for packaged stats (fixed-wing aircraft)
  const loader = useCallback(
    (range: StatsMonthRange, mode: GameMode) => loadAircraftWithPackagedStats(range, mode, false),
    []
  );
  const { data, loading } = usePackagedLoader<AircraftVehicle[]>(loader, statsMonthRange, gameMode);
  const aircraft = data ?? [];

  // 计算数据中的实际最大 BR（排除直升机），根据当前 BR 模式动态生成
  const availableBRs = useMemo(() => {
    const planes = aircraft.filter(ac => ac.aircraftType !== 'helicopter');
    if (planes.length === 0) return [];
    const maxBR = Math.max(...planes.map(ac => {
      return useGroundBR ? (ac.groundBattleRating ?? ac.battleRating) : ac.battleRating;
    }));
    return BATTLE_RATINGS.filter(br => br <= maxBR);
  }, [aircraft, useGroundBR]);

  // 数据加载完成或切换 BR 模式后，校正 brRange 到实际可用范围
  useEffect(() => {
    if (availableBRs.length > 0) {
      setBrRange([availableBRs[0], availableBRs[availableBRs.length - 1]]);
    }
  }, [availableBRs]);

  const filteredAircraft = useMemo(() => {
    return aircraft.filter(ac => {
      if (ac.aircraftType === 'helicopter') return false;
      const nationMatch = selectedNations.length === 0 || selectedNations.includes(ac.nation);
      const effectiveBR = useGroundBR ? (ac.groundBattleRating ?? ac.battleRating) : ac.battleRating;
      const brMatch = effectiveBR >= brRange[0] && effectiveBR <= brRange[1];
      const typeMatch = selectedType === 'all' || ac.aircraftType === selectedType;
      const unreleasedMatch = showUnreleased || !ac.unreleased;
      const ghostMatch = showGhost || !ac.ghost;
      return nationMatch && brMatch && typeMatch && unreleasedMatch && ghostMatch;
    });
  }, [aircraft, selectedNations, brRange, selectedType, showUnreleased, showGhost, useGroundBR]);

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
      typeOptions={AIRCRAFT_TYPES}
      showGroundBRToggle
      useGroundBR={useGroundBR}
      onUseGroundBRChange={setUseGroundBR}
      loading={loading}
      filteredCount={filteredAircraft.length}
      countLabel="架飞机"
    >
      <AircraftTechTree aircraft={filteredAircraft} gameMode={gameMode} useGroundBR={useGroundBR} />
    </ListPageLayout>
  );
}
