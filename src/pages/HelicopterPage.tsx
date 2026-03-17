import { useState, useMemo, useEffect, useCallback } from 'react';
import ListPageLayout from '../components/ListPageLayout';
import AircraftTechTree from '../components/AircraftTechTree';
import { loadAircraftWithPackagedStats } from '../data/aircraft';
import type { Nation, AircraftVehicle, GameMode, StatsMonthRange } from '../types';
import { BATTLE_RATINGS } from '../types';
import { useGameMode } from '../hooks/useGameMode';
import { useStatsMonthRange } from '../hooks/useStatsMonth';
import { usePackagedLoader } from '../hooks/usePackagedLoader';

export default function HelicopterPage() {
  const [selectedNations, setSelectedNations] = useState<Nation[]>([]);
  const [brRange, setBrRange] = useState<[number, number]>([BATTLE_RATINGS[0], BATTLE_RATINGS[BATTLE_RATINGS.length - 1]]);
  const [showUnreleased, setShowUnreleased] = useState(false);
  const [showGhost, setShowGhost] = useState(false);
  const [useGroundBR, setUseGroundBR] = useState(false);

  const { gameMode, handleGameModeChange } = useGameMode();
  const { statsMonthRange, handleStatsMonthRangeChange } = useStatsMonthRange();

  // Loader for packaged stats (helicopters)
  const loader = useCallback(
    (range: StatsMonthRange, mode: GameMode) => loadAircraftWithPackagedStats(range, mode, true),
    []
  );
  const { data, loading } = usePackagedLoader<AircraftVehicle[]>(loader, statsMonthRange, gameMode);
  const aircraft = data ?? [];

  // 计算直升机数据中的实际最大 BR，根据当前 BR 模式动态生成
  const availableBRs = useMemo(() => {
    const helicopters = aircraft.filter(ac => ac.aircraftType === 'helicopter');
    if (helicopters.length === 0) return [];
    const maxBR = Math.max(...helicopters.map(ac => {
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

  const filteredHelicopters = useMemo(() => {
    return aircraft.filter(ac => {
      if (ac.aircraftType !== 'helicopter') return false;
      const nationMatch = selectedNations.length === 0 || selectedNations.includes(ac.nation);
      const effectiveBR = useGroundBR ? (ac.groundBattleRating ?? ac.battleRating) : ac.battleRating;
      const brMatch = effectiveBR >= brRange[0] && effectiveBR <= brRange[1];
      const unreleasedMatch = showUnreleased || !ac.unreleased;
      const ghostMatch = showGhost || !ac.ghost;
      return nationMatch && brMatch && unreleasedMatch && ghostMatch;
    });
  }, [aircraft, selectedNations, brRange, showUnreleased, showGhost, useGroundBR]);

  return (
    <ListPageLayout
      gameMode={gameMode}
      onGameModeChange={handleGameModeChange}
      selectedNations={selectedNations}
      onNationsChange={setSelectedNations}
      brRange={brRange}
      onBrRangeChange={setBrRange}
      selectedType={'all' as string}
      onTypeChange={() => {}}
      showUnreleased={showUnreleased}
      onShowUnreleasedChange={setShowUnreleased}
      showGhost={showGhost}
      onShowGhostChange={setShowGhost}
      availableBRs={availableBRs}
      statsMonthRange={statsMonthRange}
      onStatsMonthRangeChange={handleStatsMonthRangeChange}
      typeOptions={[]}
      showGroundBRToggle
      useGroundBR={useGroundBR}
      onUseGroundBRChange={setUseGroundBR}
      loading={loading}
      filteredCount={filteredHelicopters.length}
      countLabel="架直升机"
    >
      <AircraftTechTree aircraft={filteredHelicopters} gameMode={gameMode} useGroundBR={useGroundBR} />
    </ListPageLayout>
  );
}
