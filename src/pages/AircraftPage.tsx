import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import Navbar from '../components/Navbar';
import VehicleFilter from '../components/VehicleFilter';
import type { TypeOption } from '../components/VehicleFilter';
import AircraftTechTree from '../components/AircraftTechTree';
import GameModeSelector from '../components/GameModeSelector';
import { loadAircraft } from '../data/aircraft';
import type { Nation, AircraftType, AircraftVehicle, GameMode } from '../types';
import { getInitialGameMode, saveGameModeToStorage, updateURLWithGameMode } from '../utils/gameMode';

const AIRCRAFT_TYPES: TypeOption<AircraftType>[] = [
  { value: 'all', label: '全部' },
  { value: 'fighter', label: '战斗机' },
  { value: 'bomber', label: '轰炸机' },
  { value: 'assault', label: '攻击机' },
];

export default function AircraftPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [aircraft, setAircraft] = useState<AircraftVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNations, setSelectedNations] = useState<Nation[]>([]);
  const [brRange, setBrRange] = useState<[number, number]>([1.0, 12.7]);
  const [selectedType, setSelectedType] = useState<AircraftType | 'all'>('all');
  const [showUnreleased, setShowUnreleased] = useState(false);

  // Initialize game mode from URL or storage
  const [gameMode, setGameMode] = useState<GameMode>(() =>
    getInitialGameMode(searchParams)
  );

  // Handle game mode change
  const handleGameModeChange = (mode: GameMode) => {
    setGameMode(mode);
    saveGameModeToStorage(mode);
    updateURLWithGameMode(searchParams, setSearchParams, mode);
  };

  // Sync game mode from URL on mount
  useEffect(() => {
    const urlMode = searchParams.get('mode') as GameMode | null;
    if (urlMode && urlMode !== gameMode) {
      setGameMode(urlMode);
    }
  }, [searchParams]);

  useEffect(() => {
    loadAircraft().then(data => {
      setAircraft(data);
      setLoading(false);
    });
  }, []);

  const filteredAircraft = useMemo(() => {
    return aircraft.filter(ac => {
      // Exclude helicopters (they have their own page)
      if (ac.aircraftType === 'helicopter') return false;
      const nationMatch = selectedNations.length === 0 || selectedNations.includes(ac.nation);
      const brMatch = ac.battleRating >= brRange[0] && ac.battleRating <= brRange[1];
      const typeMatch = selectedType === 'all' || ac.aircraftType === selectedType;
      const unreleasedMatch = showUnreleased || !ac.unreleased;
      return nationMatch && brMatch && typeMatch && unreleasedMatch;
    });
  }, [aircraft, selectedNations, brRange, selectedType, showUnreleased]);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Navbar />

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ pt: 12, pb: 4 }}>
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
          <AircraftTechTree aircraft={filteredAircraft} gameMode={gameMode} />
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
