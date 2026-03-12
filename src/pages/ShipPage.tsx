import { useState, useMemo, useEffect } from 'react';
import ListPageLayout from '../components/ListPageLayout';
import type { TypeOption } from '../components/VehicleFilter';
import ShipTechTree from '../components/ShipTechTree';
import { loadShips } from '../data/ships';
import type { Nation, ShipType, ShipVehicle } from '../types';
import { BATTLE_RATINGS } from '../types';
import { useGameMode } from '../hooks/useGameMode';
import { useStatsMonthRange } from '../hooks/useStatsMonth';

const SHIP_TYPES: TypeOption<ShipType>[] = [
  { value: 'all', label: '全部' },
  { value: 'destroyer', label: '驱逐舰' },
  { value: 'cruiser', label: '巡洋舰' },
  { value: 'torpedo_boat', label: '鱼雷艇' },
  { value: 'submarine_chaser', label: '猎潜艇' },
  { value: 'barge', label: '登陆艇/驳船' },
  { value: 'ship', label: '通用舰船' },
];

export default function ShipPage() {
  const [ships, setShips] = useState<ShipVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNations, setSelectedNations] = useState<Nation[]>([]);
  const [brRange, setBrRange] = useState<[number, number]>([BATTLE_RATINGS[0], BATTLE_RATINGS[BATTLE_RATINGS.length - 1]]);
  const [selectedType, setSelectedType] = useState<ShipType | 'all'>('all');
  const [showUnreleased, setShowUnreleased] = useState(false);
  const [showGhost, setShowGhost] = useState(false);

  const { gameMode, handleGameModeChange } = useGameMode();
  const { statsMonthRange, handleStatsMonthRangeChange } = useStatsMonthRange();

  // Reload data when month range changes
  useEffect(() => {
    setLoading(true);
    loadShips(statsMonthRange).then(data => {
      setShips(data);
      setLoading(false);
    });
  }, [statsMonthRange]);

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
