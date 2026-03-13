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
import { ArrowBack, OpenInNew } from '@mui/icons-material';
import Navbar from '../components/Navbar';
import DistributionChart from '../components/DistributionChart';
import { BRGridSelector } from '../components/VehicleFilter';
import GameModeSelector from '../components/GameModeSelector';
import { loadShips, getShipStatsByMode, loadShipDetail } from '../data/ships';
import EconomySection from '../components/EconomySection';
import { SHIP_TYPE_LABELS, BATTLE_RATINGS, ECONOMIC_TYPE_GRADIENTS } from '../types';
import type { ShipVehicle, ShipType, GameMode, MetricType, EconomyData } from '../types';
import { getShipImagePath, getFlagImagePath } from '../utils/paths';
import { getBRGradientColor } from '../utils/chart';
import { getWinRateColor } from '../utils/gameMode';
import { useGameMode } from '../hooks/useGameMode';

/** Stats metric types for comparison */
type StatsMetricType = 'killPerSpawn' | 'winRate' | 'expPerSpawn';

/** Gets the numeric value for a given stats metric for a specific game mode */
function getStatsMetricValue(ship: ShipVehicle, metric: StatsMetricType, gameMode: GameMode): number {
  const stats = getShipStatsByMode(ship, gameMode);
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
  shipTypes?: ShipType[];
  brMin?: number;
  brMax?: number;
}

/** Generates scatter data for stats comparison charts */
function generateStatsComparisonData(
  shipId: string,
  metric: StatsMetricType,
  allShips: ShipVehicle[],
  gameMode: GameMode,
  filter?: ComparisonFilter,
) {
  const ship = allShips.find(s => s.id === shipId);
  if (!ship) return null;

  const targetBR = ship.battleRating;
  const brMin = filter?.brMin ?? (targetBR - 1.0);
  const brMax = filter?.brMax ?? (targetBR + 1.0);

  const value = getStatsMetricValue(ship, metric, gameMode);

  const filtered = allShips.filter(s => {
    const sStats = getShipStatsByMode(s, gameMode);
    if (s.id === shipId) {
      return sStats && sStats.battles > 0 && getStatsMetricValue(s, metric, gameMode) > 0;
    }
    const metricValue = getStatsMetricValue(s, metric, gameMode);
    if (s.battleRating < brMin || s.battleRating > brMax) return false;
    if (!sStats || sStats.battles <= 0 || metricValue <= 0) return false;
    if (filter?.shipTypes && filter.shipTypes.length > 0 && !filter.shipTypes.includes(s.shipType)) return false;
    return true;
  });

  if (filtered.length === 0) return null;

  const lowerSpan = Math.max(targetBR - brMin, 0.1);
  const upperSpan = Math.max(brMax - targetBR, 0.1);

  const bins = filtered.map((s) => {
    const brDiff = parseFloat((s.battleRating - targetBR).toFixed(2));
    const isCurrent = s.id === shipId;

    return {
      range: s.localizedName,
      metricValue: getStatsMetricValue(s, metric, gameMode),
      battles: getShipStatsByMode(s, gameMode)?.battles ?? 0,
      isCurrent,
      vehicleId: s.id,
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
    allValues: filtered.map(s => ({
      vehicleId: s.id,
      value: getStatsMetricValue(s, metric, gameMode),
    })),
  };
}

const ALL_SHIP_TYPES: ShipType[] = ['destroyer', 'cruiser', 'torpedo_boat', 'submarine_chaser', 'barge', 'ship'];

export default function ShipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [shipList, setShipList] = useState<ShipVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<ShipType[]>([]);
  const [brRange, setBrRange] = useState<[number, number] | null>(null);
  const [typesInitialized, setTypesInitialized] = useState(false);
  const [economyData, setEconomyData] = useState<EconomyData | undefined>(undefined);

  // Use custom hook for game mode management
  const { gameMode, handleGameModeChange } = useGameMode();

  useEffect(() => {
    loadShips()
      .then(data => {
        setShipList(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const ship = shipList.find(s => s.id === id);

  // Load economy data on demand when ship is found
  useEffect(() => {
    if (!ship) return;
    setEconomyData(undefined);
    loadShipDetail(ship.id).then(detail => {
      if (detail?.economy) {
        setEconomyData(detail.economy);
      }
    });
  }, [ship?.id]);

  // Default selectedTypes to current ship's type
  useEffect(() => {
    if (ship && !typesInitialized) {
      setSelectedTypes([ship.shipType]);
      setTypesInitialized(true);
    }
  }, [ship, typesInitialized]);

  // Reset filter state when ship ID changes
  useEffect(() => {
    setTypesInitialized(false);
    setBrRange(null);
  }, [id]);

  // Default BR range: ship BR ± 1.0
  const effectiveBrRange: [number, number] = useMemo(() => {
    if (brRange) return brRange;
    if (!ship) return [BATTLE_RATINGS[0], BATTLE_RATINGS[BATTLE_RATINGS.length - 1]];
    const br = ship.battleRating;
    const lo = BATTLE_RATINGS.filter(b => b >= br - 1.0)[0] ?? BATTLE_RATINGS[0];
    const hi = [...BATTLE_RATINGS].reverse().find(b => b <= br + 1.0) ?? BATTLE_RATINGS[BATTLE_RATINGS.length - 1];
    return [lo, hi];
  }, [brRange, ship]);

  const filter: ComparisonFilter = useMemo(() => ({
    shipTypes: selectedTypes.length > 0 ? selectedTypes : ALL_SHIP_TYPES,
    brMin: effectiveBrRange[0],
    brMax: effectiveBrRange[1],
  }), [selectedTypes, effectiveBrRange]);

  const statsComparisons = useMemo(() => {
    if (!ship) return null;
    return {
      killPerSpawn: generateStatsComparisonData(ship.id, 'killPerSpawn', shipList, gameMode, filter),
      winRate: generateStatsComparisonData(ship.id, 'winRate', shipList, gameMode, filter),
      expPerSpawn: generateStatsComparisonData(ship.id, 'expPerSpawn', shipList, gameMode, filter),
    };
  }, [ship, shipList, gameMode, filter]);

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

  if (!ship) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Navbar />
        <Container maxWidth="xl" sx={{ pt: 12, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ color: '#171717' }}>
            舰船未找到
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate('/ship')}
            sx={{ mt: 2, color: '#16a34a', borderColor: '#16a34a' }}
          >
            返回列表
          </Button>
        </Container>
      </Box>
    );
  }

  const modeStats = getShipStatsByMode(ship, gameMode);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Navbar />

      <Container maxWidth="xl" sx={{ pt: 10 }}>
        {/* Back Button */}
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/ship')}
          sx={{
            color: '#525252',
            mb: 2,
            '&:hover': { color: '#171717' },
          }}
        >
          返回列表
        </Button>

        {/* Ship Header Card */}
        <Paper
          elevation={2}
          sx={{
            background: ECONOMIC_TYPE_GRADIENTS[ship.economicType],
            borderRadius: 3,
            mb: 3,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background flag watermark */}
          <Box
            component="img"
            src={getFlagImagePath(ship.nation)}
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
            {/* Ship Image */}
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
                src={getShipImagePath(ship.id)}
                alt={ship.localizedName}
                loading="eager"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://placehold.co/400x300/e5e5e5/666?text=${encodeURIComponent(ship.localizedName)}`;
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

            {/* Ship Identity Info */}
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
                {SHIP_TYPE_LABELS[ship.shipType]}
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
                  {ship.localizedName}
                </Typography>
                <Box
                  component="a"
                  href={`https://wiki.warthunder.com/unit/${ship.id}`}
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
              {ship.releaseDate && (
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
                    {ship.unreleased ? '预计上线' : '发布日期'}：{ship.releaseDate}
                  </Typography>
                  {ship.unreleased && (
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
                    { label: 'BR', value: ship.battleRating.toFixed(1), color: '#86efac' },
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
        <Box sx={{ mb: 3 }}>
          <GameModeSelector
            currentMode={gameMode}
            onModeChange={handleGameModeChange}
          />
        </Box>

        {/* Comparison Charts */}
        <Typography variant="h5" sx={{ color: '#171717', fontWeight: 600, mb: 2 }}>
          同权重载具对比
        </Typography>

        {/* Filter Controls */}
        <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid #e5e5e5', borderRadius: 2 }}>
          <Stack spacing={2}>
            {/* Ship Type Filter */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ color: '#171717', fontWeight: 600 }}>
                  舰船类型
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
                {ALL_SHIP_TYPES.map((type) => {
                  const label = SHIP_TYPE_LABELS[type];
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
          展示 BR {effectiveBrRange[0].toFixed(1)} - {effectiveBrRange[1].toFixed(1)} 范围内{selectedTypes.length > 0 ? selectedTypes.map(t => SHIP_TYPE_LABELS[t]).join('、') : '全部舰船'}的指标对比，橙色星形标记当前载具位置
        </Typography>

        <Grid container spacing={2}>
          {/* 胜率 */}
          {statsComparisons?.winRate && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.winRate} title="胜率" unit="%" navPrefix="/ship" brInfo={{ vehicleBR: ship.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* KR */}
          {statsComparisons?.killPerSpawn && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.killPerSpawn} title="KR (每重生击毁)" unit="" navPrefix="/ship" brInfo={{ vehicleBR: ship.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
          {/* 每次重生经验 */}
          {statsComparisons?.expPerSpawn && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.expPerSpawn} title="每次重生经验" unit=" RP" navPrefix="/ship" brInfo={{ vehicleBR: ship.battleRating, brMin: effectiveBrRange[0], brMax: effectiveBrRange[1] }} />
            </Grid>
          )}
        </Grid>
      </Container>
    </Box>
  );
}
