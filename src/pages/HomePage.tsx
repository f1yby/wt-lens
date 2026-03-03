import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import Navbar from '../components/Navbar';
import VehicleFilter from '../components/VehicleFilter';
import VehicleTechTree from '../components/VehicleTechTree';
import GameModeSelector from '../components/GameModeSelector';
import { loadVehicles } from '../data/vehicles';
import type { Nation, VehicleType, Vehicle, GameMode } from '../types';
import { getInitialGameMode, saveGameModeToStorage, updateURLWithGameMode } from '../utils/gameMode';

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNations, setSelectedNations] = useState<Nation[]>([]);
  const [brRange, setBrRange] = useState<[number, number]>([1.0, 12.7]);
  const [selectedType, setSelectedType] = useState<VehicleType | 'all'>('all');
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

  // Sync game mode from URL on mount (in case URL was changed externally)
  useEffect(() => {
    const urlMode = searchParams.get('mode') as GameMode | null;
    if (urlMode && urlMode !== gameMode) {
      setGameMode(urlMode);
    }
  }, [searchParams]);

  useEffect(() => {
    loadVehicles().then(data => {
      setVehicles(data);
      setLoading(false);
    });
  }, []);

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
