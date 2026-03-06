import { useState, useMemo, useEffect } from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import Navbar from '../components/Navbar';
import VehicleFilter from '../components/VehicleFilter';
import AircraftTechTree from '../components/AircraftTechTree';
import GameModeSelector from '../components/GameModeSelector';
import MonthRangeSelector from '../components/MonthSelector';
import { loadAircraft } from '../data/aircraft';
import type { Nation, AircraftVehicle } from '../types';
import { BATTLE_RATINGS } from '../types';
import { useGameMode } from '../hooks/useGameMode';
import { useStatsMonthRange } from '../hooks/useStatsMonth';

export default function HelicopterPage() {
  const [aircraft, setAircraft] = useState<AircraftVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNations, setSelectedNations] = useState<Nation[]>([]);
  const [brRange, setBrRange] = useState<[number, number]>([BATTLE_RATINGS[0], BATTLE_RATINGS[BATTLE_RATINGS.length - 1]]);
  const [showUnreleased, setShowUnreleased] = useState(false);
  const [useGroundBR, setUseGroundBR] = useState(false);

  // 切换联合作战 BR 时重置 brRange
  const handleUseGroundBRChange = (value: boolean) => {
    setUseGroundBR(value);
    setBrRange([BATTLE_RATINGS[0], BATTLE_RATINGS[BATTLE_RATINGS.length - 1]]);
  };

  // Use custom hooks for game mode and stats month management
  const { gameMode, handleGameModeChange } = useGameMode();
  const { statsMonthRange, handleStatsMonthRangeChange } = useStatsMonthRange();

  // Reload data when month range changes
  useEffect(() => {
    setLoading(true);
    loadAircraft(statsMonthRange).then(data => {
      setAircraft(data);
      setLoading(false);
    });
  }, [statsMonthRange]);

  // 计算直升机数据中的实际最大 BR，根据当前 BR 模式动态生成
  const availableBRs = useMemo(() => {
    const helicopters = aircraft.filter(ac => ac.aircraftType === 'helicopter');
    if (helicopters.length === 0) return BATTLE_RATINGS;
    const maxBR = Math.max(...helicopters.map(ac => {
      return useGroundBR ? (ac.groundBattleRating ?? ac.battleRating) : ac.battleRating;
    }));
    return BATTLE_RATINGS.filter(br => br <= maxBR);
  }, [aircraft, useGroundBR]);

  const filteredHelicopters = useMemo(() => {
    return aircraft.filter(ac => {
      if (ac.aircraftType !== 'helicopter') return false;
      const nationMatch = selectedNations.length === 0 || selectedNations.includes(ac.nation);
      const effectiveBR = useGroundBR ? (ac.groundBattleRating ?? ac.battleRating) : ac.battleRating;
      const brMatch = effectiveBR >= brRange[0] && effectiveBR <= brRange[1];
      const unreleasedMatch = showUnreleased || !ac.unreleased;
      return nationMatch && brMatch && unreleasedMatch;
    });
  }, [aircraft, selectedNations, brRange, showUnreleased, useGroundBR]);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Navbar />

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
          selectedType={'all' as string}
          onTypeChange={() => {}}
          showUnreleased={showUnreleased}
          onShowUnreleasedChange={setShowUnreleased}
          typeOptions={[]}
          showGroundBRToggle
          useGroundBR={useGroundBR}
          onUseGroundBRChange={handleUseGroundBRChange}
          availableBRs={availableBRs}
          extraControls={
            <MonthRangeSelector
              currentRange={statsMonthRange}
              onRangeChange={handleStatsMonthRangeChange}
            />
          }
        />

        {/* Results Count */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: '#737373' }}>
            {loading ? '加载中...' : `显示 ${filteredHelicopters.length} 架直升机`}
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <AircraftTechTree aircraft={filteredHelicopters} gameMode={gameMode} useGroundBR={useGroundBR} />
        )}
      </Container>

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
