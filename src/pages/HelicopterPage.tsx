import { useState, useMemo, useEffect } from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import Navbar from '../components/Navbar';
import VehicleFilter from '../components/VehicleFilter';
import AircraftTechTree from '../components/AircraftTechTree';
import GameModeSelector from '../components/GameModeSelector';
import { loadAircraft } from '../data/aircraft';
import type { Nation, AircraftVehicle } from '../types';
import { useGameMode } from '../hooks/useGameMode';

export default function HelicopterPage() {
  const [aircraft, setAircraft] = useState<AircraftVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNations, setSelectedNations] = useState<Nation[]>([]);
  const [brRange, setBrRange] = useState<[number, number]>([1.0, 12.7]);
  const [showUnreleased, setShowUnreleased] = useState(false);

  // Use custom hook for game mode management
  const { gameMode, handleGameModeChange } = useGameMode();

  useEffect(() => {
    loadAircraft().then(data => {
      setAircraft(data);
      setLoading(false);
    });
  }, []);

  const filteredHelicopters = useMemo(() => {
    return aircraft.filter(ac => {
      if (ac.aircraftType !== 'helicopter') return false;
      const nationMatch = selectedNations.length === 0 || selectedNations.includes(ac.nation);
      const brMatch = ac.battleRating >= brRange[0] && ac.battleRating <= brRange[1];
      const unreleasedMatch = showUnreleased || !ac.unreleased;
      return nationMatch && brMatch && unreleasedMatch;
    });
  }, [aircraft, selectedNations, brRange, showUnreleased]);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Navbar />

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
          selectedType={'all' as string}
          onTypeChange={() => {}}
          showUnreleased={showUnreleased}
          onShowUnreleasedChange={setShowUnreleased}
          typeOptions={[]}
        />

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
          <AircraftTechTree aircraft={filteredHelicopters} gameMode={gameMode} />
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
