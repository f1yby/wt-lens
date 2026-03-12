import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
import { ArrowBack, OpenInNew } from '@mui/icons-material';
import Navbar from '../components/Navbar';
import DistributionChart from '../components/DistributionChart';
import { BRGridSelector } from '../components/VehicleFilter';
import GameModeSelector from '../components/GameModeSelector';
import { loadAircraft, getAircraftStatsByMode, loadAircraftDetail } from '../data/aircraft';
import EconomySection from '../components/EconomySection';
import { AIRCRAFT_TYPE_LABELS, BATTLE_RATINGS, ECONOMIC_TYPE_GRADIENTS } from '../types';
import type { AircraftVehicle, AircraftType, GameMode, MetricType, EconomyData } from '../types';
import { getAircraftImagePath, getFlagImagePath } from '../utils/paths';
import { getBRGradientColor } from '../utils/chart';
import { getWinRateColor } from '../utils/gameMode';
import { useGameMode } from '../hooks/useGameMode';

/** Stats metric types for comparison */
type StatsMetricType = 'killPerSpawn' | 'winRate' | 'expPerSpawn';

/** Gets the numeric value for a given stats metric for a specific game mode */
function getStatsMetricValue(aircraft: AircraftVehicle, metric: StatsMetricType, gameMode: GameMode): number {
  const stats = getAircraftStatsByMode(aircraft, gameMode);
  if (!stats) return 0;

  switch (metric) {
    case 'killPerSpawn': return stats.killPerSpawn;
    case 'winRate': return stats.winRate;
    case 'expPerSpawn': return stats.expPerSpawn ?? 0;
    default: return 0;
  }
}

/** Filter options for comparison charts */
interface ComparisonFilter {
  aircraftTypes?: AircraftType[];
  brMin?: number;
  brMax?: number;
}

/** Generates scatter data for stats comparison charts */
function generateStatsComparisonData(
  aircraftId: string,
  metric: StatsMetricType,
  allAircraft: AircraftVehicle[],
  gameMode: GameMode,
  filter?: ComparisonFilter,
) {
  const aircraft = allAircraft.find(a => a.id === aircraftId);
  if (!aircraft) return null;

  const targetBR = aircraft.battleRating;
  const brMin = filter?.brMin ?? (targetBR - 1.0);
  const brMax = filter?.brMax ?? (targetBR + 1.0);

  const value = getStatsMetricValue(aircraft, metric, gameMode);

  const filtered = allAircraft.filter(a => {
    const aStats = getAircraftStatsByMode(a, gameMode);
    if (a.id === aircraftId) {
      return aStats && aStats.battles > 0 && getStatsMetricValue(a, metric, gameMode) > 0;
    }
    const metricValue = getStatsMetricValue(a, metric, gameMode);
    if (a.battleRating < brMin || a.battleRating > brMax) return false;
    if (!aStats || aStats.battles <= 0 || metricValue <= 0) return false;
    if (filter?.aircraftTypes && filter.aircraftTypes.length > 0 && !filter.aircraftTypes.includes(a.aircraftType)) return false;
    return true;
  });

  if (filtered.length === 0) return null;

  const lowerSpan = Math.max(targetBR - brMin, 0.1);
  const upperSpan = Math.max(brMax - targetBR, 0.1);

  const bins = filtered.map((a) => {
    const brDiff = parseFloat((a.battleRating - targetBR).toFixed(2));
    const isCurrent = a.id === aircraftId;

    return {
      range: a.localizedName,
      metricValue: getStatsMetricValue(a, metric, gameMode),
      battles: getAircraftStatsByMode(a, gameMode)?.battles ?? 0,
      isCurrent,
      vehicleId: a.id,
      brDiff,
      dotColor: isCurrent ? '#f97316' : getBRGradientColor(brDiff, lowerSpan, upperSpan),
    };
  });

  const currentBin = bins.findIndex(b => b.isCurrent);

  return {
    metric: metric as MetricType,
    bins,
    currentVehicleBin: Math.max(0, currentBin),
    currentVehicleValue: value,
    allValues: filtered.map(a => ({
      vehicleId: a.id,
      value: getStatsMetricValue(a, metric, gameMode),
    })),
  };
}

export default function AircraftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Detect if this is a helicopter detail page based on the current route
  const isHelicopter = location.pathname.startsWith('/helicopter');
  const listPath = isHelicopter ? '/helicopter' : '/aircraft';
  const navPrefix = isHelicopter ? '/helicopter' : '/aircraft';
  const [aircraftList, setAircraftList] = useState<AircraftVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<AircraftType[]>([]);
  const [brRange, setBrRange] = useState<[number, number] | null>(null);
  const [typesInitialized, setTypesInitialized] = useState(false);
  const [economyData, setEconomyData] = useState<EconomyData | undefined>(undefined);

  // Use custom hook for game mode management
  const { gameMode, handleGameModeChange } = useGameMode();

  useEffect(() => {
    loadAircraft()
      .then(data => {
        setAircraftList(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const aircraft = aircraftList.find(a => a.id === id);

  // Load economy data on demand when aircraft is found
  useEffect(() => {
    if (!aircraft) return;
    setEconomyData(undefined);
    loadAircraftDetail(aircraft.id).then(detail => {
      if (detail?.economy) {
        setEconomyData(detail.economy);
      }
    });
  }, [aircraft]);

  // Default selectedTypes to current aircraft's type
  useEffect(() => {
    if (aircraft && !typesInitialized) {
      setSelectedTypes([aircraft.aircraftType]);
      setTypesInitialized(true);
    }
  }, [aircraft, typesInitialized]);

  // Reset filter state when aircraft ID changes
  useEffect(() => {
    setTypesInitialized(false);
    setBrRange(null);
  }, [id]);

  // Default BR range: aircraft BR ± 1.0
  const effectiveBrRange: [number, number] = useMemo(() => {
    if (brRange) return brRange;
    if (!aircraft) return [BATTLE_RATINGS[0], BATTLE_RATINGS[BATTLE_RATINGS.length - 1]];
    const br = aircraft.battleRating;
    const lo = BATTLE_RATINGS.filter(b => b >= br - 1.0)[0] ?? BATTLE_RATINGS[0];
    const hi = [...BATTLE_RATINGS].reverse().find(b => b <= br + 1.0) ?? BATTLE_RATINGS[BATTLE_RATINGS.length - 1];
    return [lo, hi];
  }, [brRange, aircraft]);

  const filter: ComparisonFilter = useMemo(() => ({
    aircraftTypes: selectedTypes,
    brMin: effectiveBrRange[0],
    brMax: effectiveBrRange[1],
  }), [selectedTypes, effectiveBrRange]);

  const statsComparisons = useMemo(() => {
    if (!aircraft) return null;
    return {
      killPerSpawn: generateStatsComparisonData(aircraft.id, 'killPerSpawn', aircraftList, gameMode, filter),
      winRate: generateStatsComparisonData(aircraft.id, 'winRate', aircraftList, gameMode, filter),
      expPerSpawn: generateStatsComparisonData(aircraft.id, 'expPerSpawn', aircraftList, gameMode, filter),
    };
  }, [aircraft, aircraftList, gameMode, filter]);

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

  if (!aircraft) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Navbar />
        <Container maxWidth="xl" sx={{ pt: 12, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ color: '#171717' }}>
            {isHelicopter ? '直升机' : '飞机'}未找到
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate(listPath)}
            sx={{ mt: 2, color: '#16a34a', borderColor: '#16a34a' }}
          >
            返回列表
          </Button>
        </Container>
      </Box>
    );
  }

  const modeStats = getAircraftStatsByMode(aircraft, gameMode);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Navbar />

      <Container maxWidth="xl" sx={{ pt: 10 }}>
        {/* Back Button */}
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(listPath)}
          sx={{
            color: '#525252',
            mb: 2,
            '&:hover': { color: '#171717' },
          }}
        >
          返回列表
        </Button>

        {/* Aircraft Header Card */}
        <Paper
          elevation={2}
          sx={{
            background: ECONOMIC_TYPE_GRADIENTS[aircraft.economicType],
            borderRadius: 3,
            mb: 3,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background flag watermark */}
          <Box
            component="img"
            src={getFlagImagePath(aircraft.nation)}
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

          {/* Top Section: Identity + Image */}
          <Box sx={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'center', md: 'flex-end' },
            gap: { xs: 1, md: 0 },
            px: { xs: 2, sm: 3, md: 4 },
            pt: { xs: 2.5, sm: 3, md: 4 },
            pb: { xs: 2, md: 3 },
          }}>
            {/* Aircraft Image */}
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
                src={getAircraftImagePath(aircraft.id)}
                alt={aircraft.localizedName}
                loading="eager"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://placehold.co/400x300/e5e5e5/666?text=${encodeURIComponent(aircraft.localizedName)}`;
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

            {/* Aircraft Identity Info */}
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
                {AIRCRAFT_TYPE_LABELS[aircraft.aircraftType]}
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
                  {aircraft.localizedName}
                </Typography>
                <Box
                  component="a"
                  href={`https://wiki.warthunder.com/unit/${aircraft.id}`}
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
              {aircraft.releaseDate && (
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
                    {aircraft.unreleased ? '预计上线' : '发布日期'}：{aircraft.releaseDate}
                  </Typography>
                  {aircraft.unreleased && (
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
              {modeStats ? (
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
                    { label: 'BR', value: aircraft.battleRating.toFixed(1), color: '#86efac' },
                    ...(aircraft.groundBattleRating ? [{ label: '联合BR', value: aircraft.groundBattleRating.toFixed(1), color: '#fbbf24' }] : []),
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
              ) : (
                <Typography sx={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.85rem',
                  fontStyle: 'italic',
                }}>
                  暂无统计数据
                </Typography>
              )}
            </Box>
          </Box>
        </Paper>

        {/* Economy Data Section */}
        {economyData && (
          <Box sx={{ mb: 3 }}>
            <EconomySection economy={economyData} gameMode={gameMode} />
          </Box>
        )}

        {/* Game Mode Selector */}
        <GameModeSelector
          currentMode={gameMode}
          onModeChange={handleGameModeChange}
        />

        {/* Comparison Charts */}
        <Typography variant="h5" sx={{ color: '#171717', fontWeight: 600, mb: 2 }}>
          同权重载具对比
        </Typography>

        {/* Filter Controls */}
        <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid #e5e5e5', borderRadius: 2 }}>
          <Stack spacing={2}>
            {/* Aircraft Type Filter */}
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
                {(Object.entries(AIRCRAFT_TYPE_LABELS) as [AircraftType, string][]).map(([type, label]) => {
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
          展示 BR {effectiveBrRange[0].toFixed(1)} - {effectiveBrRange[1].toFixed(1)} 范围内{selectedTypes.length > 0 ? selectedTypes.map(t => AIRCRAFT_TYPE_LABELS[t]).join('、') : '全部载具'}的指标对比，橙色星形标记当前载具位置
        </Typography>

        <Grid container spacing={2}>
          {/* 胜率 */}
          {statsComparisons?.winRate && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.winRate} title="胜率" unit="%" navPrefix={navPrefix} brInfo={{ vehicleBR: aircraft.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* KR */}
          {statsComparisons?.killPerSpawn && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.killPerSpawn} title="KR (每重生击毁)" unit="" navPrefix={navPrefix} brInfo={{ vehicleBR: aircraft.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 每次重生经验 */}
          {statsComparisons?.expPerSpawn && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.expPerSpawn} title="每次重生经验" unit=" RP" navPrefix={navPrefix} brInfo={{ vehicleBR: aircraft.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
        </Grid>
      </Container>
    </Box>
  );
}
