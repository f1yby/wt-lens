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
import { ArrowBack, Speed, SwapVert, SyncAlt, GpsFixed, CenterFocusStrong, FastForward, FastRewind, ThreeSixty, OpenInNew, School } from '@mui/icons-material';
import Navbar from '../components/Navbar';
import DistributionChart from '../components/DistributionChart';
import StabilizerScatterChart from '../components/StabilizerScatterChart';
import { BRGridSelector } from '../components/VehicleFilter';
import GameModeSelector from '../components/GameModeSelector';
import MonthRangeSelector from '../components/MonthSelector';
import { StatItem, ReloadTimeStatItem, PenetrationStatItem } from '../components/stats';
import EconomySection from '../components/EconomySection';
import MobilitySection from '../components/MobilitySection';
import ArmamentsSection from '../components/ArmamentsSection';
import OpticsSection from '../components/OpticsSection';

import { loadVehicles, getVehicleStatsByMode, loadVehicleDetail } from '../data/vehicles';
import { VEHICLE_TYPE_LABELS, BATTLE_RATINGS, ECONOMIC_TYPE_GRADIENTS } from '../types';
import type { Vehicle, VehicleType, GroundVehicleType } from '../types';
import { getVehicleImagePath, getFlagImagePath } from '../utils/paths';
import { getWinRateColor } from '../utils/gameMode';
import { useGameMode } from '../hooks/useGameMode';
import { useStatsMonthRange } from '../hooks/useStatsMonth';
import {
  getVehicleBR,
  generateVehicleComparisonData,
  generateStatsComparisonData,
  type ComparisonFilter,
} from '../utils/vehicleComparison';

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<VehicleType[]>([]);
  const [brRange, setBrRange] = useState<[number, number] | null>(null);
  const [typesInitialized, setTypesInitialized] = useState(false);
  const [detailLoaded, setDetailLoaded] = useState<string | null>(null);

  // Use custom hooks for game mode and stats month management
  const { gameMode, handleGameModeChange } = useGameMode();
  const { statsMonthRange, handleStatsMonthRangeChange } = useStatsMonthRange();

  // Reload data when month range changes
  useEffect(() => {
    setLoading(true);
    loadVehicles(statsMonthRange)
      .then(data => {
        setVehicles(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [statsMonthRange]);

  const vehicle = vehicles.find(v => v.id === id);

  // Load detailed performance + economy data for the current vehicle
  useEffect(() => {
    if (!id || vehicles.length === 0 || detailLoaded === id) return;
    loadVehicleDetail(id).then(detail => {
      if (!detail) return;
      setVehicles(prev => prev.map(v =>
        v.id === id
          ? { ...v, performance: detail.performance, economy: detail.economy ?? v.economy }
          : v
      ));
      setDetailLoaded(id);
    });
  }, [id, vehicles.length, detailLoaded]);

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
    setDetailLoaded(null);
  }, [id]);

  // Default BR range: vehicle BR ± 1.0, snapped to BATTLE_RATINGS
  const effectiveBrRange: [number, number] = useMemo(() => {
    if (brRange) return brRange;
    if (!vehicle) return [BATTLE_RATINGS[0], BATTLE_RATINGS[BATTLE_RATINGS.length - 1]];
    const br = getVehicleBR(vehicle, gameMode);
    const lo = BATTLE_RATINGS.filter(b => b >= br - 1.0)[0] ?? BATTLE_RATINGS[0];
    const hi = [...BATTLE_RATINGS].reverse().find(b => b <= br + 1.0) ?? BATTLE_RATINGS[BATTLE_RATINGS.length - 1];
    return [lo, hi];
  }, [brRange, vehicle, gameMode]);

  const filter: ComparisonFilter = useMemo(() => ({
    vehicleTypes: selectedTypes,
    brMin: effectiveBrRange[0],
    brMax: effectiveBrRange[1],
  }), [selectedTypes, effectiveBrRange]);

  const comparisons = useMemo(() => {
    if (!vehicle) return null;
    return {
      powerToWeight: generateVehicleComparisonData(vehicle.id, 'powerToWeight', vehicles, gameMode, filter),
      maxSpeed: generateVehicleComparisonData(vehicle.id, 'maxSpeed', vehicles, gameMode, filter),
      maxReverseSpeed: generateVehicleComparisonData(vehicle.id, 'maxReverseSpeed', vehicles, gameMode, filter),
      reloadTime: generateVehicleComparisonData(vehicle.id, 'reloadTime', vehicles, gameMode, filter),
      penetration: generateVehicleComparisonData(vehicle.id, 'penetration', vehicles, gameMode, filter),
      traverseSpeed: generateVehicleComparisonData(vehicle.id, 'traverseSpeed', vehicles, gameMode, filter),
      elevationSpeed: generateVehicleComparisonData(vehicle.id, 'elevationSpeed', vehicles, gameMode, filter),
      elevationMin: generateVehicleComparisonData(vehicle.id, 'elevationMin', vehicles, gameMode, filter),
      gunnerThermal: generateVehicleComparisonData(vehicle.id, 'gunnerThermal', vehicles, gameMode, filter),
      commanderThermal: generateVehicleComparisonData(vehicle.id, 'commanderThermal', vehicles, gameMode, filter),
    };
  }, [vehicle, vehicles, gameMode, filter]);

  const statsComparisons = useMemo(() => {
    if (!vehicle) return null;
    return {
      killPerSpawn: generateStatsComparisonData(vehicle.id, 'killPerSpawn', vehicles, gameMode, filter),
      winRate: generateStatsComparisonData(vehicle.id, 'winRate', vehicles, gameMode, filter),
      expPerSpawn: generateStatsComparisonData(vehicle.id, 'expPerSpawn', vehicles, gameMode, filter),
    };
  }, [vehicle, vehicles, gameMode, filter]);

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

              {/* Release Date & Unreleased Badge */}
              {vehicle.releaseDate && (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  justifyContent: { xs: 'center', md: 'flex-start' },
                  mb: 1,
                }}>
                  <Typography sx={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                  }}>
                    {vehicle.unreleased ? '预计上线' : '发布日期'}：{vehicle.releaseDate}
                  </Typography>
                  {vehicle.unreleased && (
                    <Box sx={{
                      backgroundColor: '#f97316',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      lineHeight: 1.2,
                    }}>
                      DEV
                    </Box>
                  )}
                </Box>
              )}

              {/* Battle Stats */}
              {(() => {
                const modeStats = getVehicleStatsByMode(vehicle, gameMode);
                return modeStats ? (
                  <Box sx={{
                    display: 'flex',
                    gap: { xs: 2, sm: 3, md: 4 },
                    justifyContent: { xs: 'center', md: 'flex-start' },
                    flexWrap: 'wrap',
                  }}>
                    {[
                      { label: '总对局数', value: modeStats.battles.toLocaleString(), color: '#fff' },
                      {
                        label: '胜率',
                        value: `${modeStats.winRate.toFixed(1)}%`,
                        color: getWinRateColor(modeStats.winRate),
                      },
                      { label: 'KPS', value: modeStats.killPerSpawn.toFixed(2), color: '#fff' },
                      { label: 'BR', value: getVehicleBR(vehicle, gameMode).toFixed(1), color: '#86efac' },
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
                ) : null;
              })()}
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
                icon={ThreeSixty}
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
                icon={SwapVert}
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
                icon={CenterFocusStrong}
                value={vehicle.performance.gunnerThermalResolution[0] > 0
                  ? `${vehicle.performance.gunnerThermalResolution[0]}×${vehicle.performance.gunnerThermalResolution[1]}`
                  : '-'}
                label="炮手热成像"
              />
              <StatItem
                icon={CenterFocusStrong}
                value={vehicle.performance.commanderThermalResolution[0] > 0
                  ? `${vehicle.performance.commanderThermalResolution[0]}×${vehicle.performance.commanderThermalResolution[1]}`
                  : '-'}
                label="车长热成像"
              />
              <StatItem
                icon={School}
                value={(() => {
                  const modeStats = getVehicleStatsByMode(vehicle, gameMode);
                  return modeStats?.expPerSpawn ? Math.round(modeStats.expPerSpawn).toLocaleString() : '-';
                })()}
                label="每次重生经验"
              />
            </Box>
          </Box>
        </Paper>

        {/* Economy Data Section */}
        {vehicle.economy && (
          <Box sx={{ mb: 3 }}>
            <EconomySection economy={vehicle.economy} gameMode={gameMode} />
          </Box>
        )}

        {/* Detailed Performance Sections - 2 column layout for better balance */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Left column: Mobility + Optics stacked */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <MobilitySection performance={vehicle.performance} />
              <OpticsSection performance={vehicle.performance} />
            </Box>
          </Grid>
          {/* Right column: Armaments (typically tallest) */}
          <Grid item xs={12} md={8}>
            <ArmamentsSection performance={vehicle.performance} vehicleName={vehicle.localizedName} onNavigate={(url) => navigate(url)} />
          </Grid>
        </Grid>

        {/* Comparison Charts */}
        <Typography variant="h5" sx={{ color: '#171717', fontWeight: 600, mb: 2 }}>
          同权重载具对比
        </Typography>

        {/* Filter Controls */}
        <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid #e5e5e5', borderRadius: 2 }}>
          <Stack spacing={2}>
            {/* Game Mode and Time Range Selector */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ color: '#171717', fontWeight: 600 }}>
                  游戏模式
                </Typography>
                <MonthRangeSelector
                  currentRange={statsMonthRange}
                  onRangeChange={handleStatsMonthRangeChange}
                />
              </Box>
              <GameModeSelector
                currentMode={gameMode}
                onModeChange={handleGameModeChange}
              />
            </Box>

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
          展示 BR {effectiveBrRange[0].toFixed(1)} - {effectiveBrRange[1].toFixed(1)} 范围内{selectedTypes.length > 0 ? selectedTypes.map(t => VEHICLE_TYPE_LABELS[t as GroundVehicleType]).join('、') : '全部载具'}的指标对比，橙色星形标记当前载具位置
        </Typography>

        <Grid container spacing={2}>
          {/* 1. 胜率 */}
          {statsComparisons?.winRate && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.winRate} title="胜率" unit="%" brInfo={{ vehicleBR: getVehicleBR(vehicle, gameMode), brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 2. KR */}
          {statsComparisons?.killPerSpawn && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.killPerSpawn} title="KR (每重生击毁)" unit="" brInfo={{ vehicleBR: getVehicleBR(vehicle, gameMode), brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 3. 每次重生经验 */}
          {statsComparisons?.expPerSpawn && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.expPerSpawn} title="每次重生经验" unit=" RP" brInfo={{ vehicleBR: getVehicleBR(vehicle, gameMode), brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 4. 装填 */}
          {comparisons?.reloadTime && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={comparisons.reloadTime} title="装填时间" unit="s" brInfo={{ vehicleBR: getVehicleBR(vehicle, gameMode), brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
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
              <DistributionChart data={comparisons.penetration} title="穿深" unit="mm" brInfo={{ vehicleBR: getVehicleBR(vehicle, gameMode), brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 7. 方向机速度 */}
          {comparisons?.traverseSpeed && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={comparisons.traverseSpeed} title="方向机速度" unit="°/s" brInfo={{ vehicleBR: getVehicleBR(vehicle, gameMode), brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 8. 高低机速度 */}
          {comparisons?.elevationSpeed && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={comparisons.elevationSpeed} title="高低机速度" unit="°/s" brInfo={{ vehicleBR: getVehicleBR(vehicle, gameMode), brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 9. 倒车极速 */}
          {comparisons?.maxReverseSpeed && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={comparisons.maxReverseSpeed} title="倒车速度" unit="km/h" brInfo={{ vehicleBR: getVehicleBR(vehicle, gameMode), brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
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
              <DistributionChart data={comparisons.commanderThermal} title="车长热成像" unit="像素" brInfo={{ vehicleBR: getVehicleBR(vehicle, gameMode), brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
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
