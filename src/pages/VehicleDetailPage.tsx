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
import { ArrowBack, Speed, AccessTime, ExpandLess, SyncAlt, GpsFixed, Visibility, FastForward, FastRewind, RotateRight, SvgIconComponent } from '@mui/icons-material';
import Navbar from '../components/Navbar';
import DistributionChart from '../components/DistributionChart';
import StabilizerScatterChart from '../components/StabilizerScatterChart';
import { allVehicles, sampleVehicleDetail, sampleDistributions } from '../data/vehicles';
import { NATIONS, VEHICLE_TYPE_LABELS, ECONOMIC_TYPE_GRADIENTS, Nation } from '../types';
import type { Vehicle, MetricType } from '../types';

// Get base URL from Vite env
const BASE_URL = import.meta.env.BASE_URL || '/';

/** Gets the flag image path for a nation */
const getFlagImagePath = (nation: Nation): string => 
  `${BASE_URL}images/flags/unit_tooltip/country_${nation}.png`;

/** Gets the vehicle image path */
const getVehicleImagePath = (vehicleId: string): string => 
  `${BASE_URL}vehicles/${vehicleId}.png`;

/** Gets the numeric value for a given metric from vehicle performance data */
function getMetricValue(vehicle: Vehicle, metric: MetricType): number {
  const { performance } = vehicle;
  
  switch (metric) {
    case 'powerToWeight': return performance.powerToWeight;
    case 'maxReverseSpeed': return performance.maxReverseSpeed;
    case 'reloadTime': return performance.reloadTime;
    case 'penetration': return performance.penetration;
    case 'maxSpeed': return performance.maxSpeed;
    case 'traverseSpeed': return performance.traverseSpeed;
    case 'elevationSpeed': return performance.elevationSpeed;
    case 'elevationMin': return performance.elevationRange[0] ?? 0;
    case 'gunnerThermal': return performance.gunnerThermalDiagonal ?? 0;
    case 'commanderThermal': return performance.commanderThermalDiagonal ?? 0;
    case 'stabilizer': return performance.stabilizerValue ?? 0;
    default: return 0;
  }
}

/** Generates scatter data for vehicle comparison charts */
function generateVehicleComparisonData(vehicleId: string, metric: MetricType) {
  const vehicle = allVehicles.find(v => v.id === vehicleId);
  if (!vehicle) return null;

  const targetBR = vehicle.battleRating;
  const brMin = targetBR - 1.0;
  const brMax = targetBR + 1.0;

  const value = getMetricValue(vehicle, metric);

  // Filter vehicles within BR ±1.0 range with valid metric
  const filteredVehicles = allVehicles.filter(v => {
    const metricValue = getMetricValue(v, metric);
    return v.battleRating >= brMin && v.battleRating <= brMax && metricValue > 0;
  });

  if (filteredVehicles.length === 0) return null;

  // Calculate BR gradient color: BR-1.0 (blue, 240°) -> BR 0 (green, 120°) -> BR+1.0 (red, 0°)
  const getBRGradientColor = (brDiff: number): string => {
    const clampedDiff = Math.max(-1.0, Math.min(1.0, brDiff));
    const hue = 120 - (clampedDiff * 120);
    return `hsl(${hue}, 75%, 50%)`;
  };

  const bins = filteredVehicles.map((v) => {
    const brDiff = parseFloat((v.battleRating - targetBR).toFixed(2));
    const isCurrent = v.id === vehicleId;

    return {
      range: v.localizedName,
      metricValue: getMetricValue(v, metric),
      battles: v.stats?.battles ?? 0,
      isCurrent,
      vehicleId: v.id,
      brDiff,
      dotColor: isCurrent ? '#f97316' : getBRGradientColor(brDiff),
    };
  });

  const currentVehicleBin = bins.findIndex(b => b.isCurrent);

  return {
    metric,
    bins,
    currentVehicleBin: Math.max(0, currentVehicleBin),
    currentVehicleValue: value,
    allValues: filteredVehicles.map(v => ({
      vehicleId: v.id,
      value: getMetricValue(v, metric),
    })),
  };
}

/** Props for the StatCard component */
interface StatCardProps {
  icon: SvgIconComponent;
  value: string | number;
  label: string;
}

/** Color constants - white with shadow works on all backgrounds */
const COLOR_HAS_VALUE = '#ffffff'; // White
const COLOR_NO_VALUE = 'rgba(255,255,255,0.4)'; // Gray

/** Check if value represents "no data" */
function hasNoValue(value: string | number): boolean {
  return value === '-' || value === '0' || value === '0.0' || value === '0s' || value === '';
}

/** Reusable stat card component for vehicle header */
function StatCard({ icon: Icon, value, label }: StatCardProps) {
  const isEmpty = hasNoValue(value);
  const color = isEmpty ? COLOR_NO_VALUE : COLOR_HAS_VALUE;
  
  return (
    <Box sx={{ 
      textAlign: 'center', 
      minWidth: 80, 
      height: 72, 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'space-between' 
    }}>
      <Icon sx={{ color, fontSize: 20, display: 'block', mx: 'auto' }} />
      <Typography variant="h5" sx={{ color, fontWeight: 700, fontSize: '1.1rem', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.7rem', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
        {label}
      </Typography>
    </Box>
  );
}

/** Props for the RangeStatCard component */
interface RangeStatCardProps {
  icon: SvgIconComponent;
  range: string;
  speed: string;
  label: string;
}

/** Stat card for range-based stats (elevation/traverse) */
function RangeStatCard({ icon: Icon, range, speed, label }: RangeStatCardProps) {
  const isEmpty = hasNoValue(range);
  const color = isEmpty ? COLOR_NO_VALUE : COLOR_HAS_VALUE;
  
  return (
    <Box sx={{ 
      textAlign: 'center', 
      minWidth: 90, 
      height: 72, 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'space-between' 
    }}>
      <Icon sx={{ color, fontSize: 20, display: 'block', mx: 'auto' }} />
      <Box>
        <Typography variant="h5" sx={{ color, fontWeight: 700, fontSize: '0.85rem', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
          {range}
        </Typography>
        <Typography variant="body2" sx={{ color, fontSize: '0.65rem', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
          {speed}
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.65rem', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
        {label}
      </Typography>
    </Box>
  );
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
    maxSpeed: generateVehicleComparisonData(vehicle.id, 'maxSpeed'),
    maxReverseSpeed: generateVehicleComparisonData(vehicle.id, 'maxReverseSpeed'),
    reloadTime: generateVehicleComparisonData(vehicle.id, 'reloadTime'),
    penetration: generateVehicleComparisonData(vehicle.id, 'penetration'),
    traverseSpeed: generateVehicleComparisonData(vehicle.id, 'traverseSpeed'),
    elevationSpeed: generateVehicleComparisonData(vehicle.id, 'elevationSpeed'),
    elevationMin: generateVehicleComparisonData(vehicle.id, 'elevationMin'),
    gunnerThermal: generateVehicleComparisonData(vehicle.id, 'gunnerThermal'),
    commanderThermal: generateVehicleComparisonData(vehicle.id, 'commanderThermal'),
  };

  // Get vehicles in same BR range for stabilizer comparison
  const targetBR = vehicle.battleRating;
  const stabilizerComparisonVehicles = allVehicles.filter(v => 
    v.battleRating >= targetBR - 1.0 && v.battleRating <= targetBR + 1.0
  );

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
            background: ECONOMIC_TYPE_GRADIENTS[vehicle.economicType],
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
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.95)', display: 'block', mb: 0.5, fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    总对局数
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    {vehicle.stats.battles.toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.95)', display: 'block', mb: 0.5, fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    胜率
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      color: vehicle.stats.winRate > 50 ? '#86efac' : vehicle.stats.winRate < 48 ? '#fca5a5' : '#fde047',
                      fontWeight: 700,
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    }}
                  >
                    {vehicle.stats.winRate.toFixed(1)}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.95)', display: 'block', mb: 0.5, fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    场均击毁
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    {vehicle.stats.avgKills.toFixed(1)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.95)', display: 'block', mb: 0.5, fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    BR
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#86efac', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    {vehicle.battleRating.toFixed(1)}
                  </Typography>
                </Box>
              </Box>
            )}
            </Box>

            {/* Gradient overlay for right side readability - fades from transparent to slightly dark */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '30%',
                right: 0,
                background: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.5) 100%)',
                zIndex: 1,
              }}
            />

            {/* Right side - Performance stats */}
            <Box sx={{ display: 'flex', gap: 3, ml: 4, alignItems: 'flex-end', position: 'relative', zIndex: 2 }}>
              <StatCard 
                icon={Speed} 
                value={vehicle.performance.powerToWeight.toFixed(1)} 
                label="功重比" 
              />
              <StatCard 
                icon={FastForward} 
                value={vehicle.performance.maxSpeed > 0 ? Math.round(vehicle.performance.maxSpeed) : '-'} 
                label="前进极速" 
              />
              <StatCard 
                icon={FastRewind} 
                value={vehicle.performance.maxReverseSpeed > 0 ? Math.round(vehicle.performance.maxReverseSpeed) : '-'} 
                label="倒退极速" 
              />
              <StatCard 
                icon={RotateRight} 
                value={vehicle.performance.traverseSpeed > 0 ? vehicle.performance.traverseSpeed.toFixed(1) : '-'} 
                label="转向速度" 
              />
              <StatCard 
                icon={AccessTime} 
                value={`${vehicle.performance.reloadTime.toFixed(1)}s`} 
                label="装填时间" 
              />
              <RangeStatCard 
                icon={ExpandLess}
                range={vehicle.performance.elevationRange[1] > vehicle.performance.elevationRange[0] 
                  ? `${vehicle.performance.elevationRange[0].toFixed(0)}°~${vehicle.performance.elevationRange[1].toFixed(0)}°` 
                  : '-'}
                speed={vehicle.performance.elevationSpeed > 0 ? `${vehicle.performance.elevationSpeed.toFixed(1)}°/s` : '-'}
                label="俯仰角/速度"
              />
              <RangeStatCard 
                icon={SyncAlt}
                range={vehicle.performance.traverseRange[1] > vehicle.performance.traverseRange[0] 
                  ? `${vehicle.performance.traverseRange[0].toFixed(0)}°~${vehicle.performance.traverseRange[1].toFixed(0)}°` 
                  : '-'}
                speed={vehicle.performance.traverseSpeed > 0 ? `${vehicle.performance.traverseSpeed.toFixed(1)}°/s` : '-'}
                label="射界/速度"
              />
              <Box sx={{ textAlign: 'center', minWidth: 70, height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <GpsFixed sx={{ color: vehicle.performance.stabilizerType !== 'none' ? COLOR_HAS_VALUE : COLOR_NO_VALUE, fontSize: 20, display: 'block', mx: 'auto' }} />
                <Typography variant="h5" sx={{ color: vehicle.performance.stabilizerType !== 'none' ? COLOR_HAS_VALUE : COLOR_NO_VALUE, fontWeight: 700, fontSize: '0.9rem', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {vehicle.performance.stabilizerType === 'both' ? '双向' : 
                   vehicle.performance.stabilizerType === 'horizontal' ? '水平' :
                   vehicle.performance.stabilizerType === 'vertical' ? '垂直' : '无'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.7rem', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  稳定器
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 90, height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Visibility sx={{ color: vehicle.performance.gunnerThermalResolution[0] > 0 ? COLOR_HAS_VALUE : COLOR_NO_VALUE, fontSize: 20, display: 'block', mx: 'auto' }} />
                <Typography variant="h5" sx={{ color: vehicle.performance.gunnerThermalResolution[0] > 0 ? COLOR_HAS_VALUE : COLOR_NO_VALUE, fontWeight: 700, fontSize: '0.9rem', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {vehicle.performance.gunnerThermalResolution[0] > 0 
                    ? `${vehicle.performance.gunnerThermalResolution[0]}×${vehicle.performance.gunnerThermalResolution[1]}` 
                    : '-'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.7rem', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  炮手热成像
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 90, height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Visibility sx={{ color: vehicle.performance.commanderThermalResolution[0] > 0 ? COLOR_HAS_VALUE : COLOR_NO_VALUE, fontSize: 20, display: 'block', mx: 'auto' }} />
                <Typography variant="h5" sx={{ color: vehicle.performance.commanderThermalResolution[0] > 0 ? COLOR_HAS_VALUE : COLOR_NO_VALUE, fontWeight: 700, fontSize: '0.9rem', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {vehicle.performance.commanderThermalResolution[0] > 0 
                    ? `${vehicle.performance.commanderThermalResolution[0]}×${vehicle.performance.commanderThermalResolution[1]}` 
                    : '-'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.7rem', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
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
          {/* Stabilizer Chart - always show */}
          <Grid item xs={12} md={6}>
            <StabilizerScatterChart 
              vehicles={stabilizerComparisonVehicles}
              currentVehicleId={vehicle.id}
              currentStabilizerType={vehicle.performance.stabilizerType}
            />
          </Grid>
          
          {(
            [
              { key: 'powerToWeight', title: '功重比对比', unit: 'hp/t' },
              { key: 'maxSpeed', title: '前进极速对比', unit: 'km/h' },
              { key: 'maxReverseSpeed', title: '倒车速度对比', unit: 'km/h' },
              { key: 'traverseSpeed', title: '方向机速度对比', unit: '°/s' },
              { key: 'reloadTime', title: '装填时间对比', unit: 's' },
              { key: 'elevationSpeed', title: '高低机速度对比', unit: '°/s' },
              { key: 'elevationMin', title: '俯角对比', unit: '°' },
              { key: 'penetration', title: '穿深对比', unit: 'mm' },
              { key: 'gunnerThermal', title: '炮手热成像对比', unit: '像素' },
              { key: 'commanderThermal', title: '车长热成像对比', unit: '像素' },
            ] as const
          ).map(({ key, title, unit }) => 
            comparisons[key] && (
              <Grid item xs={12} md={6} key={key}>
                <DistributionChart data={comparisons[key]} title={title} unit={unit} />
              </Grid>
            )
          )}
        </Grid>


      </Container>
    </Box>
  );
}
