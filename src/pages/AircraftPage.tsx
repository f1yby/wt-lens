import { useState, useMemo, useEffect } from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import Navbar from '../components/Navbar';
import VehicleFilter from '../components/VehicleFilter';
import type { TypeOption } from '../components/VehicleFilter';
import AircraftTechTree from '../components/AircraftTechTree';
import GameModeSelector from '../components/GameModeSelector';
import MonthRangeSelector from '../components/MonthSelector';
import { loadAircraft } from '../data/aircraft';
import type { Nation, AircraftType, AircraftVehicle } from '../types';
import { BATTLE_RATINGS } from '../types';
import { useGameMode } from '../hooks/useGameMode';
import { useStatsMonthRange } from '../hooks/useStatsMonth';

const AIRCRAFT_TYPES: TypeOption<AircraftType>[] = [
  { value: 'all', label: '全部' },
  { value: 'fighter', label: '战斗机' },
  { value: 'bomber', label: '轰炸机' },
  { value: 'assault', label: '攻击机' },
];

export default function AircraftPage() {
  const [aircraft, setAircraft] = useState<AircraftVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNations, setSelectedNations] = useState<Nation[]>([]);
  const [brRange, setBrRange] = useState<[number, number]>([BATTLE_RATINGS[0], BATTLE_RATINGS[BATTLE_RATINGS.length - 1]]);
  const [selectedType, setSelectedType] = useState<AircraftType | 'all'>('all');
  const [showUnreleased, setShowUnreleased] = useState(false);
  const [useGroundBR, setUseGroundBR] = useState(false);

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
      // Exclude helicopters (they have their own page)
      if (ac.aircraftType === 'helicopter') return false;
      const nationMatch = selectedNations.length === 0 || selectedNations.includes(ac.nation);
      const effectiveBR = useGroundBR ? (ac.groundBattleRating ?? ac.battleRating) : ac.battleRating;
      const brMatch = effectiveBR >= brRange[0] && effectiveBR <= brRange[1];
      const typeMatch = selectedType === 'all' || ac.aircraftType === selectedType;
      const unreleasedMatch = showUnreleased || !ac.unreleased;
      return nationMatch && brMatch && typeMatch && unreleasedMatch;
    });
  }, [aircraft, selectedNations, brRange, selectedType, showUnreleased, useGroundBR]);

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
          typeOptions={AIRCRAFT_TYPES}
          showGroundBRToggle
          useGroundBR={useGroundBR}
          onUseGroundBRChange={setUseGroundBR}
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
            {loading ? '加载中...' : `显示 ${filteredAircraft.length} 架飞机`}
          </Typography>
        </Box>

        {/* Aircraft Tech Tree Grid */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <AircraftTechTree aircraft={filteredAircraft} gameMode={gameMode} useGroundBR={useGroundBR} />
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
