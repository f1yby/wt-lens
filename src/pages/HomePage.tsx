import { useState, useMemo, useEffect } from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import Navbar from '../components/Navbar';
import VehicleFilter from '../components/VehicleFilter';
import VehicleTechTree from '../components/VehicleTechTree';
import { loadVehicles } from '../data/vehicles';
import type { Nation, VehicleType, Vehicle } from '../types';
import { NATIONS } from '../types';

export default function HomePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNations, setSelectedNations] = useState<Nation[]>(NATIONS.map(n => n.id));
  const [brRange, setBrRange] = useState<[number, number]>([1.0, 12.7]);
  const [selectedType, setSelectedType] = useState<VehicleType | 'all'>('all');

  useEffect(() => {
    loadVehicles().then(data => {
      setVehicles(data);
      setLoading(false);
    });
  }, []);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
      const nationMatch = selectedNations.includes(vehicle.nation);
      const brMatch = vehicle.battleRating >= brRange[0] && vehicle.battleRating <= brRange[1];
      const typeMatch = selectedType === 'all' || vehicle.vehicleType === selectedType;
      return nationMatch && brMatch && typeMatch;
    });
  }, [vehicles, selectedNations, brRange, selectedType]);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Navbar />
      
      {/* Hero Section */}
      <Box
        sx={{
          pt: 12,
          pb: 4,
          background: 'linear-gradient(180deg, rgba(74, 222, 128, 0.1) 0%, rgba(245, 245, 245, 1) 100%)',
          borderBottom: '1px solid #e5e5e5',
        }}
      >
        <Container maxWidth="xl">
          <Typography
            variant="h2"
            sx={{
              color: '#171717',
              fontWeight: 700,
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
              mb: 1,
              textAlign: 'center',
            }}
          >
            战争雷霆
            <Typography
              component="span"
              sx={{
                ml: 1.5,
                color: '#16a34a',
              }}
            >
              数据分析
            </Typography>
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: '#525252',
              textAlign: 'center',
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            基于 StatShark 和官方解包数据的载具性能分析工具，
            提供匹配分析和性能分布对比
          </Typography>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <VehicleFilter
          selectedNations={selectedNations}
          onNationsChange={setSelectedNations}
          brRange={brRange}
          onBrRangeChange={setBrRange}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
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
          <VehicleTechTree vehicles={filteredVehicles} />
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
