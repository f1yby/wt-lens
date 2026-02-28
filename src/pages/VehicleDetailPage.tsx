import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  Button,
  CircularProgress,
  ToggleButton,
  Stack,
} from '@mui/material';
import { ArrowBack, Speed, AccessTime, ExpandLess, SyncAlt, GpsFixed, Visibility, FastForward, FastRewind, RotateRight, FlashOn, OpenInNew, School, SvgIconComponent } from '@mui/icons-material';
import Navbar from '../components/Navbar';
import DistributionChart from '../components/DistributionChart';
import StabilizerScatterChart from '../components/StabilizerScatterChart';
import { BRGridSelector } from '../components/VehicleFilter';

import { loadVehicles, sampleVehicleDetail, sampleDistributions } from '../data/vehicles';
import { NATIONS, VEHICLE_TYPE_LABELS, BATTLE_RATINGS, ECONOMIC_TYPE_GRADIENTS, Nation } from '../types';
import type { Vehicle, MetricType, VehicleType } from '../types';

// Get base URL from Vite env
const BASE_URL = import.meta.env.BASE_URL || '/';

/** Gets the flag image path for a nation */
const getFlagImagePath = (nation: Nation): string => 
  `${BASE_URL}images/flags/unit_tooltip/country_${nation}.webp`;

/** Gets the vehicle image path */
const getVehicleImagePath = (vehicleId: string): string => 
  `${BASE_URL}vehicles/${vehicleId}.webp`;

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

/** Filter options for comparison charts */
interface ComparisonFilter {
  vehicleTypes?: VehicleType[];
  brMin?: number;
  brMax?: number;
}

/** Generates scatter data for vehicle comparison charts */
function generateVehicleComparisonData(vehicleId: string, metric: MetricType, allVehicles: Vehicle[], filter?: ComparisonFilter) {
  const vehicle = allVehicles.find(v => v.id === vehicleId);
  if (!vehicle) return null;

  const targetBR = vehicle.battleRating;
  const brMin = filter?.brMin ?? (targetBR - 1.0);
  const brMax = filter?.brMax ?? (targetBR + 1.0);
  const brSpan = Math.max(brMax - brMin, 0.1);

  const value = getMetricValue(vehicle, metric);

  // Filter vehicles within BR range with valid metric (always include current vehicle)
  const filteredVehicles = allVehicles.filter(v => {
    // Always include current vehicle regardless of filters
    if (v.id === vehicleId) {
      return getMetricValue(v, metric) > 0;
    }
    const metricValue = getMetricValue(v, metric);
    if (metricValue <= 0) return false;
    if (v.battleRating < brMin || v.battleRating > brMax) return false;
    if (filter?.vehicleTypes && filter.vehicleTypes.length > 0 && !filter.vehicleTypes.includes(v.vehicleType)) return false;
    return true;
  });

  if (filteredVehicles.length === 0) return null;

  // Calculate BR gradient color based on distance from current vehicle BR
  // Negative brDiff (lower BR) -> blue (hue 240), zero -> green (hue 120), positive (higher BR) -> red (hue 0)
  const lowerSpan = Math.max(targetBR - brMin, 0.1);
  const upperSpan = Math.max(brMax - targetBR, 0.1);
  const getBRGradientColor = (brDiff: number): string => {
    let normalized: number; // -1 to +1, where -1=lowest BR, 0=same BR, +1=highest BR
    if (brDiff <= 0) {
      normalized = Math.max(brDiff / lowerSpan, -1);
    } else {
      normalized = Math.min(brDiff / upperSpan, 1);
    }
    // Map: -1 -> hue 240 (blue), 0 -> hue 120 (green), +1 -> hue 0 (red)
    const hue = 120 - normalized * 120;
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

/** Stats metric types for comparison */
type StatsMetricType = 'killPerSpawn' | 'winRate' | 'expPerSpawn';

/** Gets the numeric value for a given stats metric */
function getStatsMetricValue(vehicle: Vehicle, metric: StatsMetricType): number {
  if (!vehicle.stats) return 0;
  
  switch (metric) {
    case 'killPerSpawn': return vehicle.stats.killPerSpawn;
    case 'winRate': return vehicle.stats.winRate;
    case 'expPerSpawn': return vehicle.stats.expPerSpawn ?? 0;
    default: return 0;
  }
}

/** Generates scatter data for stats comparison charts (KR, winRate) */
function generateStatsComparisonData(
  vehicleId: string, 
  metric: StatsMetricType, 
  allVehicles: Vehicle[],
  filter?: ComparisonFilter,
) {
  const vehicle = allVehicles.find(v => v.id === vehicleId);
  if (!vehicle) return null;

  const targetBR = vehicle.battleRating;
  const brMin = filter?.brMin ?? (targetBR - 1.0);
  const brMax = filter?.brMax ?? (targetBR + 1.0);
  const brSpan = Math.max(brMax - brMin, 0.1);

  const value = getStatsMetricValue(vehicle, metric);

  // Filter vehicles within BR range with valid stats data (always include current vehicle)
  const filteredVehicles = allVehicles.filter(v => {
    // Always include current vehicle regardless of filters
    if (v.id === vehicleId) {
      return v.stats && v.stats.battles > 0 && getStatsMetricValue(v, metric) > 0;
    }
    const metricValue = getStatsMetricValue(v, metric);
    if (v.battleRating < brMin || v.battleRating > brMax) return false;
    if (!v.stats || v.stats.battles <= 0 || metricValue <= 0) return false;
    if (filter?.vehicleTypes && filter.vehicleTypes.length > 0 && !filter.vehicleTypes.includes(v.vehicleType)) return false;
    return true;
  });

  if (filteredVehicles.length === 0) return null;

  // Calculate BR gradient color based on distance from current vehicle BR
  const lowerSpan = Math.max(targetBR - brMin, 0.1);
  const upperSpan = Math.max(brMax - targetBR, 0.1);
  const getBRGradientColor = (brDiff: number): string => {
    let normalized: number;
    if (brDiff <= 0) {
      normalized = Math.max(brDiff / lowerSpan, -1);
    } else {
      normalized = Math.min(brDiff / upperSpan, 1);
    }
    const hue = 120 - normalized * 120;
    return `hsl(${hue}, 75%, 50%)`;
  };

  const bins = filteredVehicles.map((v) => {
    const brDiff = parseFloat((v.battleRating - targetBR).toFixed(2));
    const isCurrent = v.id === vehicleId;

    return {
      range: v.localizedName,
      metricValue: getStatsMetricValue(v, metric),
      battles: v.stats?.battles ?? 0,
      isCurrent,
      vehicleId: v.id,
      brDiff,
      dotColor: isCurrent ? '#f97316' : getBRGradientColor(brDiff),
    };
  });

  const currentVehicleBin = bins.findIndex(b => b.isCurrent);

  return {
    metric: metric as MetricType, // Cast for compatibility with DistributionChart
    bins,
    currentVehicleBin: Math.max(0, currentVehicleBin),
    currentVehicleValue: value,
    allValues: filteredVehicles.map(v => ({
      vehicleId: v.id,
      value: getStatsMetricValue(v, metric),
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

/** Reload time stat item with auto-loader indicator and crew skill levels */
function ReloadTimeStatItem({ reloadTime, mainGun }: {
  reloadTime: number;
  mainGun?: { autoLoader?: boolean; reloadTimes?: { base: number; expert: number; ace: number } } | null;
}) {
  const isAutoLoader = mainGun?.autoLoader ?? false;
  const reloadTimes = mainGun?.reloadTimes;
  const hasData = reloadTime > 0;
  const color = hasData ? COLOR_HAS_VALUE : COLOR_NO_VALUE;

  // Format reload time display
  const formatTime = (t: number) => t.toFixed(1) + 's';

  // Generate sub-label
  let subLabel = '';
  if (hasData) {
    if (isAutoLoader) {
      subLabel = '自动装填';
    } else if (reloadTimes) {
      // Show range: base (whiteboard) → ace
      subLabel = `${formatTime(reloadTimes.base)} → ${formatTime(reloadTimes.ace)}`;
    }
  }

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.25,
      py: { xs: 0.75, sm: 1 },
    }}>
      <AccessTime sx={{ color, fontSize: { xs: 18, sm: 20, md: 22 }, mb: 0.25 }} />
      <Typography sx={{
        color,
        fontWeight: 700,
        fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1rem' },
        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
        lineHeight: 1.2,
      }}>
        {hasData ? formatTime(reloadTime) : '-'}
      </Typography>
      {/* Auto-loader indicator or reload time range */}
      {subLabel && (
        <Typography sx={{
          color: isAutoLoader ? '#4ade80' : 'rgba(255,255,255,0.85)',
          fontSize: { xs: '0.55rem', sm: '0.6rem', md: '0.65rem' },
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          {subLabel}
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
        装填时间
      </Typography>
    </Box>
  );
}

/** Ammo type labels */
const AMMO_TYPE_LABELS: Record<string, string> = {
  'apds_fs_tank': 'APFSDS',
  'apds_fs_long_tank': '长杆APFSDS',
  'apds_fs_long_l30_tank': 'L30长杆APFSDS',
  'apds_fs_tungsten_l10_l15_tank': '钨芯APFSDS',
  'apds_fs_tungsten_l10_l15_tank_navy': '钨芯APFSDS',
  'apds_fs_tungsten_l10_l15_navy': '钨芯APFSDS',
  'apds_fs_tungsten_caliber_fins_tank': '尾翼钨芯APFSDS',
  'apds_fs_tungsten_small_core_tank': '细钨芯APFSDS',
  'apds_early_tank': '早期APDS',
  'apds_tank': 'APDS',
  'apcbc_tank': 'APCBC',
  'apcbc_solid_medium_caliber_tank': 'APCBC',
  'apcr_tank': 'APCR',
  'ap_tank': 'AP',
  'ap_he_tank': 'APHE',
  'aphe_tank': 'APHE',
  'aphebc_tank': 'APHEBC',
  'apbc_usa_tank': 'APBC',
  'apc_solid_medium_caliber_tank': 'APC',
  'heat_tank': 'HEAT',
  'heat_fs_tank': 'HEAT-FS',
  'he_frag_tank': 'HE',
  'he_frag_fs_tank': 'HE-FS',
  'he_frag_radio_fuse': 'HE-VT',
  'he_frag_dist_fuse': 'HE-TF',
  'hesh_tank': 'HESH',
  'smoke_tank': '烟雾弹',
  'atgm_tank': '反坦克导弹',
  'atgm_tandem_tank': '串联反坦克导弹',
  'sam_tank': '防空导弹',
  'sap_hei_tank': '半穿甲弹',
  'shrapnel_tank': '榴霰弹',
  'practice_tank': '训练弹',
};

/** Get the best kinetic round info from ammunitions */
function getBestKineticRound(ammunitions?: any[]): {
  type: string;
  name: string;
  penetration: number;
  isLO: boolean;
  loParams?: { workingLength: number; density: number; caliber: number; mass: number; velocity: number; Cx: number };
} | null {
  if (!ammunitions || ammunitions.length === 0) return null;

  // Find the round with the highest penetration
  let bestRound: any = null;
  let bestPen = 0;

  for (const a of ammunitions) {
    const pen = a.penetration0m || a.armorPower || 0;
    if (pen > bestPen) {
      bestPen = pen;
      bestRound = a;
    }
  }

  if (!bestRound) return null;

  return {
    type: AMMO_TYPE_LABELS[bestRound.type] || bestRound.type || 'Unknown',
    name: bestRound.localizedName || bestRound.name || 'Unknown',
    penetration: bestPen,
    isLO: !!bestRound.lanzOdermatt,
    loParams: bestRound.lanzOdermatt ? {
      workingLength: bestRound.lanzOdermatt.workingLength,
      density: bestRound.lanzOdermatt.density,
      caliber: bestRound.caliber,
      mass: bestRound.mass,
      velocity: bestRound.muzzleVelocity,
      Cx: bestRound.lanzOdermatt.Cx || 0,
    } : undefined,
  };
}

/** Generate Lanz-Odermatt calculator internal URL with parameters */
function generateLOCalculatorUrl(loParams: { workingLength: number; density: number; caliber: number; mass: number; velocity: number; Cx: number }, roundName: string, penetration: number, vehicleName: string): string {
  const params = new URLSearchParams({
    wl: loParams.workingLength.toString(),
    density: loParams.density.toString(),
    caliber: loParams.caliber.toString(),
    mass: loParams.mass.toString(),
    cx: loParams.Cx.toString(),
    velocity: (loParams.velocity / 1000).toFixed(3), // m/s -> km/s
    gamePen: penetration.toString(),
    vehicle: vehicleName,
    ammo: roundName,
  });
  return `/lo-calculator?${params.toString()}`;
}

/** Penetration stat item with ammo details */
function PenetrationStatItem({ penetration, ammunitions, vehicleName, onNavigate }: {
  penetration: number;
  ammunitions?: any[];
  vehicleName: string;
  onNavigate: (url: string) => void;
}) {
  const color = penetration > 0 ? COLOR_HAS_VALUE : COLOR_NO_VALUE;
  const roundInfo = getBestKineticRound(ammunitions);

  const handleLOClick = () => {
    if (roundInfo?.isLO && roundInfo.loParams) {
      const url = generateLOCalculatorUrl(roundInfo.loParams, roundInfo.name, penetration, vehicleName);
      onNavigate(url);
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.25,
      py: { xs: 0.75, sm: 1 },
    }}>
      <FlashOn sx={{ color, fontSize: { xs: 18, sm: 20, md: 22 }, mb: 0.25 }} />
      <Typography sx={{
        color,
        fontWeight: 700,
        fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1rem' },
        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
        lineHeight: 1.2,
      }}>
        {penetration > 0 ? `${penetration.toFixed(0)}mm` : '-'}
      </Typography>
      {roundInfo && (
        <>
          <Typography sx={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: { xs: '0.5rem', sm: '0.55rem', md: '0.6rem' },
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            lineHeight: 1,
            fontWeight: 500,
          }}>
            {roundInfo.type}
          </Typography>
          {roundInfo.isLO && roundInfo.loParams ? (
            <>
              <Typography sx={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: { xs: '0.5rem', sm: '0.55rem', md: '0.6rem' },
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                lineHeight: 1,
                fontWeight: 400,
              }}>
                {roundInfo.name}
              </Typography>
              <Typography
                onClick={handleLOClick}
                sx={{
                  color: '#4ade80',
                  fontSize: { xs: '0.5rem', sm: '0.55rem', md: '0.6rem' },
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  lineHeight: 1,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(74, 222, 128, 0.5)',
                  '&:hover': {
                    textDecorationColor: '#4ade80',
                  },
                }}
              >
                Lanz-Odermatt
              </Typography>
            </>
          ) : (
            <Typography sx={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: { xs: '0.5rem', sm: '0.55rem', md: '0.6rem' },
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              lineHeight: 1,
              fontWeight: 400,
            }}>
              {roundInfo.name}
            </Typography>
          )}
        </>
      )}
      <Typography sx={{
        color: 'rgba(255,255,255,0.85)',
        fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.7rem' },
        fontWeight: 500,
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}>
        穿深
      </Typography>
    </Box>
  );
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<VehicleType[]>([]);
  const [brRange, setBrRange] = useState<[number, number] | null>(null);
  const [typesInitialized, setTypesInitialized] = useState(false);

  useEffect(() => {
    loadVehicles()
      .then(data => {
        console.log('[VehicleDetailPage] Loaded vehicles:', data.length);
        setVehicles(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('[VehicleDetailPage] Failed to load vehicles:', err);
        setLoading(false);
      });
  }, []);

  const vehicle = vehicles.find(v => v.id === id);
  console.log('[VehicleDetailPage] URL id:', id, 'Found vehicle:', vehicle?.id || 'NOT FOUND');
  const nation = vehicle ? NATIONS.find(n => n.id === vehicle.nation) : null;

  // Default selectedTypes to current vehicle's type
  useEffect(() => {
    if (vehicle && !typesInitialized) {
      setSelectedTypes([vehicle.vehicleType]);
      setTypesInitialized(true);
    }
  }, [vehicle, typesInitialized]);

  // Reset filter state when vehicle ID changes
  useEffect(() => {
    setTypesInitialized(false);
    setBrRange(null);
  }, [id]);

  // Default BR range: vehicle BR ± 1.0, snapped to BATTLE_RATINGS
  const effectiveBrRange: [number, number] = useMemo(() => {
    if (brRange) return brRange;
    if (!vehicle) return [1.0, 12.7];
    const br = vehicle.battleRating;
    const lo = BATTLE_RATINGS.filter(b => b >= br - 1.0)[0] ?? 1.0;
    const hi = [...BATTLE_RATINGS].reverse().find(b => b <= br + 1.0) ?? 12.7;
    return [lo, hi];
  }, [brRange, vehicle]);

  const filter: ComparisonFilter = useMemo(() => ({
    vehicleTypes: selectedTypes,
    brMin: effectiveBrRange[0],
    brMax: effectiveBrRange[1],
  }), [selectedTypes, effectiveBrRange]);

  const comparisons = useMemo(() => {
    if (!vehicle) return null;
    return {
      powerToWeight: generateVehicleComparisonData(vehicle.id, 'powerToWeight', vehicles, filter),
      maxSpeed: generateVehicleComparisonData(vehicle.id, 'maxSpeed', vehicles, filter),
      maxReverseSpeed: generateVehicleComparisonData(vehicle.id, 'maxReverseSpeed', vehicles, filter),
      reloadTime: generateVehicleComparisonData(vehicle.id, 'reloadTime', vehicles, filter),
      penetration: generateVehicleComparisonData(vehicle.id, 'penetration', vehicles, filter),
      traverseSpeed: generateVehicleComparisonData(vehicle.id, 'traverseSpeed', vehicles, filter),
      elevationSpeed: generateVehicleComparisonData(vehicle.id, 'elevationSpeed', vehicles, filter),
      elevationMin: generateVehicleComparisonData(vehicle.id, 'elevationMin', vehicles, filter),
      gunnerThermal: generateVehicleComparisonData(vehicle.id, 'gunnerThermal', vehicles, filter),
      commanderThermal: generateVehicleComparisonData(vehicle.id, 'commanderThermal', vehicles, filter),
    };
  }, [vehicle, vehicles, filter]);

  const statsComparisons = useMemo(() => {
    if (!vehicle) return null;
    return {
      killPerSpawn: generateStatsComparisonData(vehicle.id, 'killPerSpawn', vehicles, filter),
      winRate: generateStatsComparisonData(vehicle.id, 'winRate', vehicles, filter),
      expPerSpawn: generateStatsComparisonData(vehicle.id, 'expPerSpawn', vehicles, filter),
    };
  }, [vehicle, vehicles, filter]);

  const stabilizerComparisonVehicles = useMemo(() => {
    if (!vehicle) return [];
    return vehicles.filter(v => {
      // Always include current vehicle
      if (v.id === vehicle.id) return true;
      if (v.battleRating < effectiveBrRange[0] || v.battleRating > effectiveBrRange[1]) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(v.vehicleType)) return false;
      return true;
    });
  }, [vehicle, vehicles, effectiveBrRange, selectedTypes]);

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
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
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
                loading="eager"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://placehold.co/400x300/e5e5e5/666?text=${encodeURIComponent(vehicle.localizedName)}`;
                }}
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

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'center', md: 'flex-start' }, mb: { xs: 1, md: 1.5 } }}>
                <Typography sx={{
                  fontFamily: "'WTSymbols', 'Roboto', Tahoma, sans-serif",
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: { xs: '1.4rem', sm: '1.8rem', md: '2.2rem', lg: '2.6rem' },
                  lineHeight: 1.1,
                  textShadow: '0 2px 12px rgba(0,0,0,0.3)',
                }}>
                  {vehicle.localizedName}
                </Typography>
                <Box
                  component="a"
                  href={`https://wiki.warthunder.com/unit/${vehicle.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: 'rgba(255,255,255,0.7)',
                    transition: 'color 0.2s',
                    '&:hover': { color: '#fff' },
                    flexShrink: 0,
                  }}
                >
                  <OpenInNew sx={{ fontSize: { xs: 16, sm: 18, md: 22 } }} />
                </Box>
              </Box>

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
                    { label: 'KR', value: (vehicle.stats.killPerSpawn ?? 0).toFixed(1), color: '#fff' },
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
                sm: 'repeat(4, 1fr)',
                md: 'repeat(6, 1fr)',
                lg: 'repeat(12, 1fr)',
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
              <ReloadTimeStatItem
                reloadTime={vehicle.performance.reloadTime}
                mainGun={vehicle.performance.mainGun}
              />
              <PenetrationStatItem
                penetration={vehicle.performance.penetration}
                ammunitions={vehicle.performance.ammunitions}
                vehicleName={vehicle.localizedName}
                onNavigate={(url) => navigate(url)}
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
              <StatItem
                icon={School}
                value={vehicle.stats?.expPerSpawn ? Math.round(vehicle.stats.expPerSpawn).toLocaleString() : '-'}
                label="每次重生经验"
              />
            </Box>
          </Box>
        </Paper>

        {/* Comparison Charts */}
        <Typography variant="h5" sx={{ color: '#171717', fontWeight: 600, mb: 2 }}>
          同权重载具对比
        </Typography>

        {/* Filter Controls */}
        <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid #e5e5e5', borderRadius: 2 }}>
          <Stack spacing={2}>
            {/* Vehicle Type Filter */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ color: '#171717', fontWeight: 600 }}>
                  载具类型
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#16a34a',
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                  onClick={() => setSelectedTypes([])}
                >
                  {selectedTypes.length === 0 ? '已全选' : '全选'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {(Object.entries(VEHICLE_TYPE_LABELS) as [VehicleType, string][]).map(([type, label]) => {
                  const isSelected = selectedTypes.includes(type);
                  return (
                    <ToggleButton
                      key={type}
                      value={type}
                      selected={isSelected}
                      onChange={() => {
                        setSelectedTypes(prev =>
                          isSelected ? prev.filter(t => t !== type) : [...prev, type]
                        );
                      }}
                      sx={{
                        px: 2,
                        py: 0.5,
                        borderRadius: 1,
                        border: '1px solid #d4d4d4',
                        backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.1)' : '#ffffff',
                        color: isSelected ? '#2563eb' : '#525252',
                        textTransform: 'none',
                        fontSize: '0.85rem',
                        '&:hover': {
                          backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.2)' : '#f5f5f5',
                        },
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: '#2563eb',
                        },
                      }}
                    >
                      {label}
                    </ToggleButton>
                  );
                })}
              </Box>
            </Box>

            {/* BR Range Grid Selector */}
            <BRGridSelector
              brRange={effectiveBrRange}
              onBrRangeChange={(range) => setBrRange(range)}
            />
          </Stack>
        </Paper>

        <Typography variant="body2" sx={{ color: '#737373', mb: 2 }}>
          展示 BR {effectiveBrRange[0].toFixed(1)} - {effectiveBrRange[1].toFixed(1)} 范围内{selectedTypes.length > 0 ? selectedTypes.map(t => VEHICLE_TYPE_LABELS[t]).join('、') : '全部载具'}的指标对比，橙色星形标记当前载具位置
        </Typography>

        <Grid container spacing={2}>
          {/* 1. 胜率 */}
          {statsComparisons?.winRate && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.winRate} title="胜率" unit="%" brInfo={{ vehicleBR: vehicle.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 2. KR */}
          {statsComparisons?.killPerSpawn && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.killPerSpawn} title="KR (每重生击毁)" unit="" brInfo={{ vehicleBR: vehicle.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 3. 每次重生经验 */}
          {statsComparisons?.expPerSpawn && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.expPerSpawn} title="每次重生经验" unit=" RP" brInfo={{ vehicleBR: vehicle.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 4. 装填 */}
          {comparisons?.reloadTime && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={comparisons.reloadTime} title="装填时间" unit="s" brInfo={{ vehicleBR: vehicle.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 5. 功重比 */}
          {comparisons?.powerToWeight && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={comparisons.powerToWeight} title="功重比" unit="hp/t" brInfo={{ vehicleBR: vehicle.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 6. 穿深 */}
          {comparisons?.penetration && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={comparisons.penetration} title="穿深" unit="mm" brInfo={{ vehicleBR: vehicle.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 7. 方向机速度 */}
          {comparisons?.traverseSpeed && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={comparisons.traverseSpeed} title="方向机速度" unit="°/s" brInfo={{ vehicleBR: vehicle.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 8. 高低机速度 */}
          {comparisons?.elevationSpeed && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={comparisons.elevationSpeed} title="高低机速度" unit="°/s" brInfo={{ vehicleBR: vehicle.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 9. 倒车极速 */}
          {comparisons?.maxReverseSpeed && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={comparisons.maxReverseSpeed} title="倒车速度" unit="km/h" brInfo={{ vehicleBR: vehicle.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 10. 前进极速 */}
          {comparisons?.maxSpeed && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={comparisons.maxSpeed} title="前进极速" unit="km/h" brInfo={{ vehicleBR: vehicle.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 11. 炮手热成像 */}
          {comparisons?.gunnerThermal && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={comparisons.gunnerThermal} title="炮手热成像" unit="像素" brInfo={{ vehicleBR: vehicle.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 12. 车长热成像 */}
          {comparisons?.commanderThermal && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={comparisons.commanderThermal} title="车长热成像" unit="像素" brInfo={{ vehicleBR: vehicle.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 13. 稳定器 */}
          <Grid item xs={12} md={4}>
            <StabilizerScatterChart 
              vehicles={stabilizerComparisonVehicles}
              currentVehicleId={vehicle.id}
              currentStabilizerType={vehicle.performance.stabilizerType}
            />
          </Grid>
        </Grid>


      </Container>
    </Box>
  );
}
