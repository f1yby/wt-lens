import { useState, useMemo, useEffect } from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import Navbar from '../components/Navbar';
import VehicleFilter from '../components/VehicleFilter';
import VehicleTechTree from '../components/VehicleTechTree';
import GameModeSelector from '../components/GameModeSelector';
import MonthRangeSelector from '../components/MonthSelector';
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

  // Use custom hooks for game mode and stats month management
  const { gameMode, handleGameModeChange } = useGameMode();
  const { statsMonthRange, handleStatsMonthRangeChange } = useStatsMonthRange();

  // Reload data when month range changes
  useEffect(() => {
    setLoading(true);
    loadVehicles(statsMonthRange).then(data => {
      setVehicles(data);
      setLoading(false);
    });
  }, [statsMonthRange]);

  // 计算数据中的实际最大 BR，用于 BR 筛选器
  const availableBRs = useMemo(() => {
    if (vehicles.length === 0) return BATTLE_RATINGS;
    const maxBR = Math.max(...vehicles.map(v => v.battleRating));
    return BATTLE_RATINGS.filter(br => br <= maxBR);
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
      // 未选择任何国家 = 显示所有国家
      const nationMatch = selectedNations.length === 0 || selectedNations.includes(vehicle.nation);
      const brMatch = vehicle.battleRating >= brRange[0] && vehicle.battleRating <= brRange[1];
      const typeMatch = selectedType === 'all' || vehicle.vehicleType === selectedType;
      const unreleasedMatch = showUnreleased || !vehicle.unreleased;
      return nationMatch && brMatch && typeMatch && unreleasedMatch;
    });
  }, [vehicles, selectedNations, brRange, selectedType, showUnreleased]);

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
          availableBRs={availableBRs}
        />
        <MonthRangeSelector
          currentRange={statsMonthRange}
          onRangeChange={handleStatsMonthRangeChange}
        />

        {/* Results Count */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: '#737373' }}>
            {loading ? '加载中...' : `显示 ${filteredVehicles.length} 个载具`}
          </Typography>
        </Box>

        {/* Tech Tree Grid */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <VehicleTechTree vehicles={filteredVehicles} gameMode={gameMode} />
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
