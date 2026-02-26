import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  Chip,
  Button,
  LinearProgress,
} from '@mui/material';
import { ArrowBack, Speed, AccessTime, ExpandLess, SyncAlt, GpsFixed, Visibility } from '@mui/icons-material';
import Navbar from '../components/Navbar';
import DistributionChart from '../components/DistributionChart';
import { allVehicles, sampleVehicleDetail, sampleDistributions } from '../data/vehicles';
import { NATIONS, VEHICLE_TYPE_LABELS, Nation } from '../types';

// Get base URL from Vite env
const BASE_URL = import.meta.env.BASE_URL || '/';

// Nation flag image mapping
const getFlagImagePath = (nation: Nation): string => `${BASE_URL}images/flags/unit_tooltip/country_${nation}.png`;

// Vehicle image path helper
const getVehicleImagePath = (vehicleId: string): string => `${BASE_URL}vehicles/${vehicleId}.png`;

// Generate scatter data: x=metric value, y=battles, color based on BR distance
function generateVehicleComparisonData(
  vehicleId: string,
  metric: 'powerToWeight' | 'maxReverseSpeed' | 'reloadTime' | 'penetration'
) {
  const vehicle = allVehicles.find(v => v.id === vehicleId);
  if (!vehicle) return null;

  const targetBR = vehicle.battleRating;
  const brMin = targetBR - 1.0;
  const brMax = targetBR + 1.0;

  let value: number;

  switch (metric) {
    case 'powerToWeight':
      value = vehicle.performance.powerToWeight;
      break;
    case 'maxReverseSpeed':
      value = vehicle.performance.maxReverseSpeed;
      break;
    case 'reloadTime':
      value = vehicle.performance.reloadTime;
      break;
    case 'penetration':
      value = vehicle.performance.penetration;
      break;
  }

  // Filter vehicles within BR ±1.0 range with valid metric
  const filteredVehicles = allVehicles.filter(v => {
    const metricValue = v.performance[metric];
    return (
      v.battleRating >= brMin &&
      v.battleRating <= brMax &&
      metricValue &&
      metricValue > 0
    );
  });

  if (filteredVehicles.length === 0) return null;

  // Create data points for scatter chart with continuous BR gradient color
  // Gradient: BR-1.0 (blue, 240°) -> BR 0 (green, 120°) -> BR+1.0 (red, 0°)
  const getBRGradientColor = (brDiff: number): string => {
    // Clamp brDiff to [-1.0, 1.0]
    const clampedDiff = Math.max(-1.0, Math.min(1.0, brDiff));
    // Map -1..1 to 240..0 (blue -> green -> red)
    const hue = 120 - (clampedDiff * 120);
    return `hsl(${hue}, 75%, 50%)`;
  };

  const bins = filteredVehicles.map((v) => {
    const brDiff = parseFloat((v.battleRating - targetBR).toFixed(2));
    const dotColor = v.id === vehicleId ? '#f97316' : getBRGradientColor(brDiff);

    return {
      range: v.localizedName,
      metricValue: v.performance[metric] || 0,
      battles: v.stats?.battles || 0,
      isCurrent: v.id === vehicleId,
      vehicleId: v.id,
      brDiff,
      dotColor,
    };
  });

  // Find current vehicle index
  const currentVehicleBin = bins.findIndex(b => b.isCurrent);

  return {
    metric,
    bins,
    currentVehicleBin: currentVehicleBin >= 0 ? currentVehicleBin : 0,
    currentVehicleValue: value,
    allValues: filteredVehicles.map(v => ({
      vehicleId: v.id,
      value: v.performance[metric] || 0,
    })),
  };
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const vehicle = allVehicles.find(v => v.id === id);
  const nation = vehicle ? NATIONS.find(n => n.id === vehicle.nation) : null;

  if (!vehicle) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
        <Navbar />
        <Container maxWidth="xl" sx={{ pt: 12, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ color: '#171717' }}>
            载具未找到
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate('/')}
            sx={{ mt: 2, color: '#4ade80', borderColor: '#4ade80' }}
          >
            返回首页
          </Button>
        </Container>
      </Box>
    );
  }

  const comparisons = {
    powerToWeight: generateVehicleComparisonData(vehicle.id, 'powerToWeight'),
    maxReverseSpeed: generateVehicleComparisonData(vehicle.id, 'maxReverseSpeed'),
    reloadTime: generateVehicleComparisonData(vehicle.id, 'reloadTime'),
    penetration: generateVehicleComparisonData(vehicle.id, 'penetration'),
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Navbar />
      
      <Container maxWidth="xl" sx={{ pt: 10 }}>
        {/* Back Button */}
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/')}
          sx={{ 
            color: '#525252', 
            mb: 2,
            '&:hover': { color: '#171717' },
          }}
        >
          返回列表
        </Button>

        {/* Vehicle Header - War Thunder Style */}
        <Paper
          elevation={1}
          sx={{
            background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)',
            border: '1px solid #d4d4d4',
            borderRadius: 2,
            mb: 3,
            position: 'relative',
            overflow: 'hidden',
            minHeight: 400,
          }}
        >
          {/* Background flag - top left, faded */}
          <Box
            component="img"
            src={getFlagImagePath(vehicle.nation)}
            alt=""
            sx={{
              position: 'absolute',
              top: '-20%',
              left: '-10%',
              width: '70%',
              height: '140%',
              objectFit: 'cover',
              opacity: 0.6,
              maskImage: 'linear-gradient(135deg, rgba(0,0,0,1) 0%, transparent 70%)',
              WebkitMaskImage: 'linear-gradient(135deg, rgba(0,0,0,1) 0%, transparent 70%)',
            }}
          />
          
          {/* Vehicle Image - left aligned, 80% size */}
          <Box
            component="img"
            src={getVehicleImagePath(vehicle.id)}
            alt={vehicle.localizedName}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
            sx={{
              position: 'absolute',
              left: '5%',
              top: '50%',
              transform: 'translateY(-50%) scale(0.8)',
              transformOrigin: 'left center',
              height: '80%',
              width: 'auto',
              maxWidth: '55%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 12px 30px rgba(0,0,0,0.5))',
              zIndex: 1,
            }}
          />
          
          {/* Content overlay - split left/right */}
          <Box 
            sx={{ 
              position: 'relative', 
              zIndex: 2, 
              p: 4,
              minHeight: 400,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            {/* Left side - Vehicle info */}
            <Box sx={{ flex: 1 }}>
            {/* Category label */}
            <Typography 
              variant="overline" 
              sx={{ 
                color: 'rgba(255,255,255,0.9)', 
                fontSize: '0.9rem',
                letterSpacing: '0.1em',
                mb: 0.5,
              }}
            >
              {VEHICLE_TYPE_LABELS[vehicle.vehicleType]}
            </Typography>
            
            {/* Vehicle Name */}
            <Typography 
              variant="h1" 
              sx={{ 
                color: '#fff', 
                fontWeight: 700, 
                fontSize: { xs: '2rem', md: '3rem' },
                lineHeight: 1,
                mb: 2,
                textShadow: '0 2px 20px rgba(0,0,0,0.3)',
              }}
            >
              {vehicle.localizedName}
            </Typography>

            {/* Battle Stats row */}
            {vehicle.stats && (
              <Box sx={{ display: 'flex', gap: 4, mt: 1 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
                    总对局数
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                    {vehicle.stats.battles.toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
                    胜率
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      color: vehicle.stats.winRate > 50 ? '#86efac' : vehicle.stats.winRate < 48 ? '#fca5a5' : '#fde047',
                      fontWeight: 700,
                    }}
                  >
                    {vehicle.stats.winRate.toFixed(1)}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
                    场均击毁
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                    {vehicle.stats.avgKills.toFixed(1)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
                    BR
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#86efac', fontWeight: 700 }}>
                    {vehicle.battleRating.toFixed(1)}
                  </Typography>
                </Box>
              </Box>
            )}
            </Box>

            {/* Right side - Performance stats */}
            <Box sx={{ display: 'flex', gap: 3, ml: 4, alignItems: 'flex-end' }}>
              <Box sx={{ textAlign: 'center', minWidth: 80, height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Speed sx={{ color: '#86efac', fontSize: 20, display: 'block', mx: 'auto' }} />
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>
                  {vehicle.performance.powerToWeight.toFixed(1)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                  功重比
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 80, height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <AccessTime sx={{ color: '#fdba74', fontSize: 20, display: 'block', mx: 'auto' }} />
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>
                  {vehicle.performance.reloadTime.toFixed(1)}s
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                  装填时间
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 90, height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <ExpandLess sx={{ color: '#93c5fd', fontSize: 20, display: 'block', mx: 'auto' }} />
                <Box>
                  <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
                    {vehicle.performance.elevationRange[1] > vehicle.performance.elevationRange[0] 
                      ? `${vehicle.performance.elevationRange[0].toFixed(0)}°~${vehicle.performance.elevationRange[1].toFixed(0)}°` 
                      : '-'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.65rem' }}>
                    {vehicle.performance.elevationSpeed > 0 ? `${vehicle.performance.elevationSpeed.toFixed(1)}°/s` : '-'}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem' }}>
                  俯仰角/速度
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 100, height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <SyncAlt sx={{ color: '#93c5fd', fontSize: 20, display: 'block', mx: 'auto' }} />
                <Box>
                  <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
                    {vehicle.performance.traverseRange[1] > vehicle.performance.traverseRange[0] 
                      ? `${vehicle.performance.traverseRange[0].toFixed(0)}°~${vehicle.performance.traverseRange[1].toFixed(0)}°` 
                      : '-'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.65rem' }}>
                    {vehicle.performance.traverseSpeed > 0 ? `${vehicle.performance.traverseSpeed.toFixed(1)}°/s` : '-'}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem' }}>
                  射界/速度
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 60, height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <GpsFixed sx={{ color: vehicle.performance.hasStabilizer ? '#86efac' : '#fca5a5', fontSize: 20, display: 'block', mx: 'auto' }} />
                <Typography variant="h5" sx={{ color: vehicle.performance.hasStabilizer ? '#86efac' : '#fca5a5', fontWeight: 700, fontSize: '1.1rem' }}>
                  {vehicle.performance.hasStabilizer ? '有' : '无'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                  稳定器
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 90, height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Visibility sx={{ color: vehicle.performance.gunnerThermalResolution[0] > 0 ? '#fbbf24' : 'rgba(255,255,255,0.5)', fontSize: 20, display: 'block', mx: 'auto' }} />
                <Typography variant="h5" sx={{ color: vehicle.performance.gunnerThermalResolution[0] > 0 ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: '0.9rem' }}>
                  {vehicle.performance.gunnerThermalResolution[0] > 0 
                    ? `${vehicle.performance.gunnerThermalResolution[0]}×${vehicle.performance.gunnerThermalResolution[1]}` 
                    : '-'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                  炮手热成像
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 90, height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Visibility sx={{ color: vehicle.performance.commanderThermalResolution[0] > 0 ? '#fbbf24' : 'rgba(255,255,255,0.5)', fontSize: 20, display: 'block', mx: 'auto' }} />
                <Typography variant="h5" sx={{ color: vehicle.performance.commanderThermalResolution[0] > 0 ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: '0.9rem' }}>
                  {vehicle.performance.commanderThermalResolution[0] > 0 
                    ? `${vehicle.performance.commanderThermalResolution[0]}×${vehicle.performance.commanderThermalResolution[1]}` 
                    : '-'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                  车长热成像
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Comparison Charts */}
        <Typography variant="h5" sx={{ color: '#171717', fontWeight: 600, mb: 2 }}>
          同权重载具对比
        </Typography>
        <Typography variant="body2" sx={{ color: '#737373', mb: 2 }}>
          展示同BR±1.0范围内该指标前12的载具，橙色标记当前载具位置
        </Typography>

        <Grid container spacing={2}>
          {comparisons.powerToWeight && (
            <Grid item xs={12} md={6}>
              <DistributionChart
                data={comparisons.powerToWeight}
                title="功重比对比"
                unit="hp/t"
              />
            </Grid>
          )}
          {comparisons.maxReverseSpeed && (
            <Grid item xs={12} md={6}>
              <DistributionChart
                data={comparisons.maxReverseSpeed}
                title="倒车速度对比"
                unit="km/h"
              />
            </Grid>
          )}
          {comparisons.reloadTime && (
            <Grid item xs={12} md={6}>
              <DistributionChart
                data={comparisons.reloadTime}
                title="装填时间对比"
                unit="s"
              />
            </Grid>
          )}
          {comparisons.penetration && (
            <Grid item xs={12} md={6}>
              <DistributionChart
                data={comparisons.penetration}
                title="穿深对比"
                unit="mm"
              />
            </Grid>
          )}
        </Grid>


      </Container>
    </Box>
  );
}
