import { useState, useMemo, useEffect, useCallback } from 'react';
import ListPageLayout from '../components/ListPageLayout';
import type { TypeOption } from '../components/VehicleFilter';
import ShipTechTree from '../components/ShipTechTree';
import { loadShips } from '../data/ships';
import type { Nation, ShipType, ShipVehicle } from '../types';
import { BATTLE_RATINGS } from '../types';
import { useGameMode } from '../hooks/useGameMode';
import { useStatsMonthRange } from '../hooks/useStatsMonth';
import { useRangeLoader } from '../hooks/useRangeLoader';

const SHIP_TYPES: TypeOption<ShipType>[] = [
  { value: 'all', label: '全部' },
  { value: 'destroyer', label: '驱逐舰' },
  { value: 'torpedo_boat', label: '鱼雷艇' },
  { value: 'submarine_chaser', label: '猎潜艇' },
  { value: 'barge', label: '登陆艇/驳船' },
  { value: 'battleship', label: '战列舰' },
  { value: 'battlecruiser', label: '战列巡洋舰' },
  { value: 'heavy_cruiser', label: '重巡洋舰' },
  { value: 'light_cruiser', label: '轻巡洋舰' },
  { value: 'frigate', label: '护卫舰' },
  { value: 'boat', label: '快艇' },
  { value: 'armored_boat', label: '装甲艇' },
  { value: 'gun_boat', label: '炮艇' },
  { value: 'torpedo_gun_boat', label: '鱼雷炮艇' },
];

export default function ShipPage() {
  const [selectedNations, setSelectedNations] = useState<Nation[]>([]);
  const [brRange, setBrRange] = useState<[number, number]>([BATTLE_RATINGS[0], BATTLE_RATINGS[BATTLE_RATINGS.length - 1]]);
  const [selectedType, setSelectedType] = useState<ShipType | 'all'>('all');
  const [showUnreleased, setShowUnreleased] = useState(false);
  const [showGhost, setShowGhost] = useState(false);

  const { gameMode, handleGameModeChange } = useGameMode();
  const { statsMonthRange, handleStatsMonthRangeChange } = useStatsMonthRange();

  const loader = useCallback(loadShips, []);
  const { data, loading } = useRangeLoader<ShipVehicle[]>(loader, statsMonthRange);
  const ships = data ?? [];

  // 计算舰船数据中的实际最大 BR
  const availableBRs = useMemo(() => {
    if (ships.length === 0) return [];
    const maxBR = Math.max(...ships.map(s => s.battleRating));
    return BATTLE_RATINGS.filter(br => br <= maxBR);
  }, [ships]);

  // 数据加载完成后，校正 brRange 到实际可用范围
  useEffect(() => {
    if (availableBRs.length > 0) {
      setBrRange([availableBRs[0], availableBRs[availableBRs.length - 1]]);
    }
  }, [availableBRs]);

  const filteredShips = useMemo(() => {
    return ships.filter(ship => {
      const nationMatch = selectedNations.length === 0 || selectedNations.includes(ship.nation);
      const brMatch = ship.battleRating >= brRange[0] && ship.battleRating <= brRange[1];
      const typeMatch = selectedType === 'all' || ship.shipType === selectedType;
      const unreleasedMatch = showUnreleased || !ship.unreleased;
      const ghostMatch = showGhost || !ship.ghost;
      return nationMatch && brMatch && typeMatch && unreleasedMatch && ghostMatch;
    });
  }, [ships, selectedNations, brRange, selectedType, showUnreleased, showGhost]);

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
      typeOptions={SHIP_TYPES}
      loading={loading}
      filteredCount={filteredShips.length}
      countLabel="艘舰船"
    >
      <ShipTechTree ships={filteredShips} gameMode={gameMode} />
    </ListPageLayout>
  );
}
