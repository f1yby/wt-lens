import { useState, useMemo, useEffect } from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import Navbar from '../components/Navbar';
import VehicleFilter from '../components/VehicleFilter';
import type { TypeOption } from '../components/VehicleFilter';
import ShipTechTree from '../components/ShipTechTree';
import GameModeSelector from '../components/GameModeSelector';
import MonthRangeSelector from '../components/MonthSelector';
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

  // Use custom hooks for game mode and stats month management
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
    if (ships.length === 0) return BATTLE_RATINGS;
    const maxBR = Math.max(...ships.map(s => s.battleRating));
    return BATTLE_RATINGS.filter(br => br <= maxBR);
  }, [ships]);

  const filteredShips = useMemo(() => {
    return ships.filter(ship => {
      const nationMatch = selectedNations.length === 0 || selectedNations.includes(ship.nation);
      const brMatch = ship.battleRating >= brRange[0] && ship.battleRating <= brRange[1];
      const typeMatch = selectedType === 'all' || ship.shipType === selectedType;
      const unreleasedMatch = showUnreleased || !ship.unreleased;
      return nationMatch && brMatch && typeMatch && unreleasedMatch;
    });
  }, [ships, selectedNations, brRange, selectedType, showUnreleased]);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Navbar />

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ pt: 12, pb: 4 }}>
        {/* Mode Selector */}
        <GameModeSelector
          currentMode={gameMode}
          onModeChange={handleGameModeChange}
        />

        <VehicleFilter
          selectedNations={selectedNations}
          onNationsChange={setSelectedNations}
          brRange={brRange}
          onBrRangeChange={setBrRange}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          showUnreleased={showUnreleased}
          onShowUnreleasedChange={setShowUnreleased}
          typeOptions={SHIP_TYPES}
          availableBRs={availableBRs}
        />
        <MonthRangeSelector
          currentRange={statsMonthRange}
          onRangeChange={handleStatsMonthRangeChange}
        />

        {/* Results Count */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: '#737373' }}>
            {loading ? '加载中...' : `显示 ${filteredShips.length} 艘舰船`}
          </Typography>
        </Box>

        {/* Ship Tech Tree Grid */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <ShipTechTree ships={filteredShips} gameMode={gameMode} />
        )}
      </Container>

      {/* Footer */}
      <Box sx={{ borderTop: '1px solid #262626', py: 3, mt: 4 }}>
        <Container maxWidth="xl">
          <Typography variant="caption" sx={{ color: '#525252', textAlign: 'center', display: 'block' }}>
            数据来源: StatShark API & War Thunder Datamine | 仅供学习交流使用
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
