import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  Button,
  CircularProgress,
} from '@mui/material';
import { ArrowBack, Speed, AccessTime, ExpandLess, SyncAlt, GpsFixed, Visibility, FastForward, FastRewind, RotateRight, SvgIconComponent } from '@mui/icons-material';
import Navbar from '../components/Navbar';
import DistributionChart from '../components/DistributionChart';
import StabilizerScatterChart from '../components/StabilizerScatterChart';
import { loadVehicles, sampleVehicleDetail, sampleDistributions } from '../data/vehicles';
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
function generateVehicleComparisonData(vehicleId: string, metric: MetricType, allVehicles: Vehicle[]) {
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

/** Color constants - white with shadow works on all backgrounds */
const COLOR_HAS_VALUE = '#ffffff';
const COLOR_NO_VALUE = 'rgba(255,255,255,0.4)';

/** Check if value represents "no data" */
function hasNoValue(value: string | number): boolean {
  return value === '-' || value === '0' || value === '0.0' || value === '0s' || value === '';
}

/** Unified stat item for the performance grid */
function StatItem({ icon: Icon, value, subValue, label }: {
  icon: SvgIconComponent;
  value: string | number;
  subValue?: string;
  label: string;
}) {
  const isEmpty = hasNoValue(value);
  const color = isEmpty ? COLOR_NO_VALUE : COLOR_HAS_VALUE;

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.25,
      py: { xs: 0.75, sm: 1 },
    }}>
      <Icon sx={{ color, fontSize: { xs: 18, sm: 20, md: 22 }, mb: 0.25 }} />
      <Typography sx={{
        color,
        fontWeight: 700,
        fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1rem' },
        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
        lineHeight: 1.2,
      }}>
        {value}
      </Typography>
      {subValue && (
        <Typography sx={{
          color,
          fontSize: { xs: '0.55rem', sm: '0.6rem', md: '0.65rem' },
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          lineHeight: 1,
        }}>
          {subValue}
        </Typography>
      )}
      <Typography sx={{
        color: 'rgba(255,255,255,0.85)',
        fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.7rem' },
        fontWeight: 500,
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}>
        {label}
      </Typography>
    </Box>
  );
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVehicles().then(data => {
      setVehicles(data);
      setLoading(false);
    });
  }, []);

  const vehicle = vehicles.find(v => v.id === id);
  const nation = vehicle ? NATIONS.find(n => n.id === vehicle.nation) : null;

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Navbar />
        <Container maxWidth="xl" sx={{ pt: 12, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Container>
      </Box>
    );
  }

  if (!vehicle) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Navbar />
        <Container maxWidth="xl" sx={{ pt: 12, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ color: '#171717' }}>
            载具未找到
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate('/')}
            sx={{ mt: 2, color: '#16a34a', borderColor: '#16a34a' }}
          >
            返回首页
          </Button>
        </Container>
      </Box>
    );
  }

  const comparisons = {
    powerToWeight: generateVehicleComparisonData(vehicle.id, 'powerToWeight', vehicles),
    maxSpeed: generateVehicleComparisonData(vehicle.id, 'maxSpeed', vehicles),
    maxReverseSpeed: generateVehicleComparisonData(vehicle.id, 'maxReverseSpeed', vehicles),
    reloadTime: generateVehicleComparisonData(vehicle.id, 'reloadTime', vehicles),
    penetration: generateVehicleComparisonData(vehicle.id, 'penetration', vehicles),
    traverseSpeed: generateVehicleComparisonData(vehicle.id, 'traverseSpeed', vehicles),
    elevationSpeed: generateVehicleComparisonData(vehicle.id, 'elevationSpeed', vehicles),
    elevationMin: generateVehicleComparisonData(vehicle.id, 'elevationMin', vehicles),
    gunnerThermal: generateVehicleComparisonData(vehicle.id, 'gunnerThermal', vehicles),
    commanderThermal: generateVehicleComparisonData(vehicle.id, 'commanderThermal', vehicles),
  };

  // Get vehicles in same BR range for stabilizer comparison
  const targetBR = vehicle.battleRating;
  const stabilizerComparisonVehicles = vehicles.filter(v =>
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

        {/* Vehicle Header Card - Responsive Layout */}
        <Paper
          elevation={2}
          sx={{
            background: ECONOMIC_TYPE_GRADIENTS[vehicle.economicType],
            borderRadius: 3,
            mb: 3,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background flag watermark (md+) */}
          <Box
            component="img"
            src={getFlagImagePath(vehicle.nation)}
            alt=""
            sx={{
              position: 'absolute',
              top: '-20%',
              left: '-5%',
              width: '55%',
              height: '140%',
              objectFit: 'cover',
              opacity: 0.5,
              maskImage: 'linear-gradient(135deg, rgba(0,0,0,0.8) 0%, transparent 60%)',
              WebkitMaskImage: 'linear-gradient(135deg, rgba(0,0,0,0.8) 0%, transparent 60%)',
              display: { xs: 'none', md: 'block' },
              pointerEvents: 'none',
            }}
          />

          {/* ===== Top Section: Identity + Image ===== */}
          <Box sx={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'center', md: 'flex-end' },
            gap: { xs: 1, md: 0 },
            px: { xs: 2, sm: 3, md: 4 },
            pt: { xs: 2.5, sm: 3, md: 4 },
            pb: { xs: 1.5, md: 2.5 },
          }}>
            {/* Vehicle Image */}
            <Box sx={{
              order: { xs: 1, md: 2 },
              flex: { md: '0 0 auto' },
              display: 'flex',
              justifyContent: 'center',
              width: { xs: '100%', md: 'auto' },
              mr: { md: 4 },
            }}>
              <Box
                component="img"
                src={getVehicleImagePath(vehicle.id)}
                alt={vehicle.localizedName}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                sx={{
                  height: { xs: 100, sm: 130, md: 160, lg: 200 },
                  width: 'auto',
                  maxWidth: { xs: '70%', sm: '60%', md: 320, lg: 400 },
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))',
                }}
              />
            </Box>

            {/* Vehicle Identity Info */}
            <Box sx={{
              order: { xs: 2, md: 1 },
              flex: { md: 1 },
              minWidth: 0,
              textAlign: { xs: 'center', md: 'left' },
            }}>
              <Typography sx={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.8rem' },
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontWeight: 600,
                mb: 0.5,
              }}>
                {VEHICLE_TYPE_LABELS[vehicle.vehicleType]}
              </Typography>

              <Typography sx={{
                color: '#fff',
                fontWeight: 700,
                fontSize: { xs: '1.4rem', sm: '1.8rem', md: '2.2rem', lg: '2.6rem' },
                lineHeight: 1.1,
                mb: { xs: 1, md: 1.5 },
                textShadow: '0 2px 12px rgba(0,0,0,0.3)',
              }}>
                {vehicle.localizedName}
              </Typography>

              {/* Battle Stats */}
              {vehicle.stats && (
                <Box sx={{
                  display: 'flex',
                  gap: { xs: 2, sm: 3, md: 4 },
                  justifyContent: { xs: 'center', md: 'flex-start' },
                  flexWrap: 'wrap',
                }}>
                  {[
                    { label: '总对局数', value: vehicle.stats.battles.toLocaleString(), color: '#fff' },
                    {
                      label: '胜率',
                      value: `${vehicle.stats.winRate.toFixed(1)}%`,
                      color: vehicle.stats.winRate > 50 ? '#86efac' : vehicle.stats.winRate < 48 ? '#fca5a5' : '#fde047',
                    },
                    { label: '场均击毁', value: vehicle.stats.avgKills.toFixed(1), color: '#fff' },
                    { label: 'BR', value: vehicle.battleRating.toFixed(1), color: '#86efac' },
                  ].map((stat) => (
                    <Box key={stat.label}>
                      <Typography sx={{
                        color: 'rgba(255,255,255,0.85)',
                        fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.7rem' },
                        fontWeight: 500,
                        mb: 0.25,
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      }}>
                        {stat.label}
                      </Typography>
                      <Typography sx={{
                        color: stat.color,
                        fontWeight: 700,
                        fontSize: { xs: '0.95rem', sm: '1.05rem', md: '1.2rem' },
                        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      }}>
                        {stat.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          {/* ===== Bottom Section: Performance Stats Grid ===== */}
          <Box sx={{
            position: 'relative',
            zIndex: 2,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.25) 100%)',
            borderTop: '1px solid rgba(255,255,255,0.15)',
            px: { xs: 1.5, sm: 3, md: 4 },
            py: { xs: 1.5, sm: 2 },
          }}>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(4, 1fr)',
                sm: 'repeat(5, 1fr)',
                md: 'repeat(5, 1fr)',
                lg: 'repeat(10, 1fr)',
              },
              gap: { xs: 0.5, sm: 1 },
            }}>
              <StatItem
                icon={Speed}
                value={vehicle.performance.powerToWeight.toFixed(1)}
                label="功重比"
              />
              <StatItem
                icon={FastForward}
                value={vehicle.performance.maxSpeed > 0 ? Math.round(vehicle.performance.maxSpeed) : '-'}
                label="前进极速"
              />
              <StatItem
                icon={FastRewind}
                value={vehicle.performance.maxReverseSpeed > 0 ? Math.round(vehicle.performance.maxReverseSpeed) : '-'}
                label="倒退极速"
              />
              <StatItem
                icon={RotateRight}
                value={vehicle.performance.traverseSpeed > 0 ? vehicle.performance.traverseSpeed.toFixed(1) : '-'}
                label="转向速度"
              />
              <StatItem
                icon={AccessTime}
                value={`${vehicle.performance.reloadTime.toFixed(1)}s`}
                label="装填时间"
              />
              <StatItem
                icon={ExpandLess}
                value={vehicle.performance.elevationRange[1] > vehicle.performance.elevationRange[0]
                  ? `${vehicle.performance.elevationRange[0].toFixed(0)}°~${vehicle.performance.elevationRange[1].toFixed(0)}°`
                  : '-'}
                subValue={vehicle.performance.elevationSpeed > 0 ? `${vehicle.performance.elevationSpeed.toFixed(1)}°/s` : undefined}
                label="俯仰角/速度"
              />
              <StatItem
                icon={SyncAlt}
                value={vehicle.performance.traverseRange[1] > vehicle.performance.traverseRange[0]
                  ? `${vehicle.performance.traverseRange[0].toFixed(0)}°~${vehicle.performance.traverseRange[1].toFixed(0)}°`
                  : '-'}
                subValue={vehicle.performance.traverseSpeed > 0 ? `${vehicle.performance.traverseSpeed.toFixed(1)}°/s` : undefined}
                label="射界/速度"
              />
              <StatItem
                icon={GpsFixed}
                value={vehicle.performance.stabilizerType === 'both' ? '双向' :
                       vehicle.performance.stabilizerType === 'horizontal' ? '水平' :
                       vehicle.performance.stabilizerType === 'vertical' ? '垂直' : '无'}
                label="稳定器"
              />
              <StatItem
                icon={Visibility}
                value={vehicle.performance.gunnerThermalResolution[0] > 0
                  ? `${vehicle.performance.gunnerThermalResolution[0]}×${vehicle.performance.gunnerThermalResolution[1]}`
                  : '-'}
                label="炮手热成像"
              />
              <StatItem
                icon={Visibility}
                value={vehicle.performance.commanderThermalResolution[0] > 0
                  ? `${vehicle.performance.commanderThermalResolution[0]}×${vehicle.performance.commanderThermalResolution[1]}`
                  : '-'}
                label="车长热成像"
              />
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
