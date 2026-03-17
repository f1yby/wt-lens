/**
 * Generic Vehicle Detail Page
 * Renders detail page for any vehicle type based on configuration
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
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
import MonthRangeSelector from '../components/MonthSelector';
import EconomySection from '../components/EconomySection';
import { BATTLE_RATINGS, ECONOMIC_TYPE_GRADIENTS } from '../types';
import type { EconomyData } from '../types';
import { getFlagImagePath } from '../utils/paths';
import { getWinRateColor } from '../utils/gameMode';
import { useGameMode } from '../hooks/useGameMode';
import { useStatsMonthRange } from '../hooks/useStatsMonth';
import { useDetailPageLoader, useSimpleDetailLoader } from '../hooks/useDetailPageLoader';
import type { VehicleDetailConfig, BaseVehicle } from '../config/vehicleDetailConfig';

interface DetailPageProps<V extends BaseVehicle, T extends string> {
  config: VehicleDetailConfig<V, T>;
}

export default function DetailPage<V extends BaseVehicle, T extends string>({ config }: DetailPageProps<V, T>) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [selectedTypes, setSelectedTypes] = useState<T[]>([]);
  const [brRange, setBrRange] = useState<[number, number] | null>(null);
  const [typesInitialized, setTypesInitialized] = useState(false);
  const [economyData, setEconomyData] = useState<EconomyData | undefined>(undefined);
  const [detailData, setDetailData] = useState<unknown>(undefined);

  const { gameMode, handleGameModeChange } = useGameMode();
  const { statsMonthRange, handleStatsMonthRangeChange } = useStatsMonthRange();

  // Check if progressive loading is available
  const useProgressiveLoading = !!(config.loadLightList && config.loadStatsForIds);

  // Progressive loading hook (fast initial load, lazy load comparison data)
  const progressiveLoader = useDetailPageLoader(
    {
      loadLightList: config.loadLightList!,
      loadStatsForIds: config.loadStatsForIds!,
      loadDetail: config.loadDetail,
      getId: (v: V) => v.id,
      hasStats: config.hasStats ?? ((v: V) => !!(v as unknown as { stats?: unknown }).stats),
      getBR: (v: V) => config.getBR(v, gameMode),
      getType: (v: V) => config.getType(v) as string,
    },
    id,
    statsMonthRange,
    gameMode,
    selectedTypes as string[],
    brRange ?? [0, 99],
  );

  // Simple loading hook (load all at once, for backwards compatibility)
  const simpleLoader = useSimpleDetailLoader(
    config.loadVehicles,
    id,
    config.loadDetail,
  );

  // Use appropriate loader based on config
  const vehicles = useProgressiveLoading ? progressiveLoader.vehicles : simpleLoader.vehicles;
  const loading = useProgressiveLoading ? progressiveLoader.loading : simpleLoader.loading;
  const loadingStats = useProgressiveLoading ? progressiveLoader.loadingStats : false;

  const vehicle = vehicles.find(v => v.id === id);

  // Load economy/detail data for current vehicle
  useEffect(() => {
    if (!vehicle || !config.loadDetail) return;
    setEconomyData(undefined);
    setDetailData(undefined);
    config.loadDetail(vehicle.id).then(detail => {
      if (detail?.economy) {
        setEconomyData(detail.economy);
      }
      setDetailData(detail);
    });
  }, [vehicle?.id]);

  // Default selectedTypes to current vehicle's type
  useEffect(() => {
    if (vehicle && !typesInitialized) {
      setSelectedTypes([config.getType(vehicle)]);
      setTypesInitialized(true);
    }
  }, [vehicle, typesInitialized]);

  // Reset filter state when vehicle ID changes
  useEffect(() => {
    setTypesInitialized(false);
    setBrRange(null);
  }, [id]);

  // Default BR range
  const effectiveBrRange: [number, number] = useMemo(() => {
    if (brRange) return brRange;
    if (!vehicle) return [BATTLE_RATINGS[0], BATTLE_RATINGS[BATTLE_RATINGS.length - 1]];
    const br = config.getBR(vehicle, gameMode);
    const lo = BATTLE_RATINGS.filter(b => b >= br - 1.0)[0] ?? BATTLE_RATINGS[0];
    const hi = [...BATTLE_RATINGS].reverse().find(b => b <= br + 1.0) ?? BATTLE_RATINGS[BATTLE_RATINGS.length - 1];
    return [lo, hi];
  }, [brRange, vehicle, gameMode]);

  const filter = useMemo(() => ({
    types: selectedTypes.length > 0 ? selectedTypes : config.allTypes,
    brMin: effectiveBrRange[0],
    brMax: effectiveBrRange[1],
  }), [selectedTypes, effectiveBrRange]);

  // Generate stats comparisons
  const statsComparisons = useMemo(() => {
    if (!vehicle) return null;
    return {
      killPerSpawn: config.generateStatsComparison(vehicle.id, 'killPerSpawn', vehicles, gameMode, filter),
      winRate: config.generateStatsComparison(vehicle.id, 'winRate', vehicles, gameMode, filter),
      expPerSpawn: config.generateStatsComparison(vehicle.id, 'expPerSpawn', vehicles, gameMode, filter),
    };
  }, [vehicle, vehicles, gameMode, filter]);

  // Navigation handler
  const handleNavigate = useCallback((url: string) => navigate(url), [navigate]);

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
            {config.vehicleTypeName}未找到
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate(config.listPath)}
            sx={{ mt: 2, color: '#16a34a', borderColor: '#16a34a' }}
          >
            返回列表
          </Button>
        </Container>
      </Box>
    );
  }

  const modeStats = config.getStats(vehicle, gameMode);
  const vehicleBR = config.getBR(vehicle, gameMode);
  const vehicleType = config.getType(vehicle);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Navbar />

      <Container maxWidth="xl" sx={{ pt: 10 }}>
        {/* Back Button */}
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(config.listPath)}
          sx={{ color: '#525252', mb: 2, '&:hover': { color: '#171717' } }}
        >
          返回列表
        </Button>

        {/* Vehicle Header Card */}
        <Paper
          elevation={2}
          sx={{
            background: (ECONOMIC_TYPE_GRADIENTS as Record<string, string>)[vehicle.economicType] ?? 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
            borderRadius: 3,
            mb: 3,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background flag watermark */}
          <Box
            component="img"
            src={getFlagImagePath(vehicle.nation)}
            alt=""
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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

          {/* Top Section */}
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
                src={config.getImagePath(vehicle.id)}
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
                {config.typeLabels[vehicleType]}
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

              {/* Release Date */}
              {vehicle.releaseDate && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'center', md: 'flex-start' }, mb: 1 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' } }}>
                    {vehicle.unreleased ? '预计上线' : '发布日期'}：{vehicle.releaseDate}
                  </Typography>
                  {vehicle.unreleased && (
                    <Box sx={{ backgroundColor: '#f97316', color: '#fff', fontSize: '0.65rem', fontWeight: 700, px: 1, py: 0.25, borderRadius: 1 }}>
                      DEV
                    </Box>
                  )}
                </Box>
              )}

              {/* Battle Stats */}
              {modeStats ? (
                <Box sx={{ display: 'flex', gap: { xs: 2, sm: 3, md: 4 }, justifyContent: { xs: 'center', md: 'flex-start' }, flexWrap: 'wrap' }}>
                  {[
                    { label: '总对局数', value: modeStats.battles.toLocaleString(), color: '#fff' },
                    { label: '胜率', value: `${modeStats.winRate.toFixed(1)}%`, color: getWinRateColor(modeStats.winRate) },
                    { label: 'KPS', value: modeStats.killPerSpawn.toFixed(2), color: '#fff' },
                    { label: 'BR', value: vehicleBR.toFixed(1), color: '#86efac' },
                  ].map(stat => (
                    <Box key={stat.label}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.7rem' }, fontWeight: 500, mb: 0.25 }}>
                        {stat.label}
                      </Typography>
                      <Typography sx={{ color: stat.color, fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1.05rem', md: '1.2rem' } }}>
                        {stat.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontStyle: 'italic' }}>
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

        {/* Additional Sections (for ground vehicles) */}
        {config.renderAdditionalSections?.(vehicle, gameMode, handleNavigate, detailData)}

        {/* Game Mode Selector */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <GameModeSelector currentMode={gameMode} onModeChange={handleGameModeChange} />
          {config.showMonthRangeSelector && (
            <MonthRangeSelector
              currentRange={statsMonthRange}
              onRangeChange={handleStatsMonthRangeChange}
            />
          )}
        </Box>

        {/* Loading indicator for progressive loading */}
        {loadingStats && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" sx={{ color: '#737373' }}>
              加载对比数据中...
            </Typography>
          </Box>
        )}

        {/* Comparison Charts */}
        <Typography variant="h5" sx={{ color: '#171717', fontWeight: 600, mb: 2 }}>
          同权重载具对比
        </Typography>

        {/* Filter Controls */}
        <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid #e5e5e5', borderRadius: 2 }}>
          <Stack spacing={2}>
            {/* Type Filter */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ color: '#171717', fontWeight: 600 }}>
                  {config.vehicleTypeName}类型
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: '#16a34a', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  onClick={() => setSelectedTypes([])}
                >
                  {selectedTypes.length === 0 ? '已全选' : '全选'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {config.allTypes.map(type => {
                  const label = config.typeLabels[type];
                  const isSelected = selectedTypes.includes(type);
                  return (
                    <ToggleButton
                      key={type}
                      value={type}
                      selected={isSelected}
                      onChange={() => setSelectedTypes(prev => isSelected ? prev.filter(t => t !== type) : [...prev, type])}
                      sx={{
                        px: 2, py: 0.5, borderRadius: 1, border: '1px solid #d4d4d4',
                        backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.1)' : '#ffffff',
                        color: isSelected ? '#2563eb' : '#525252',
                        textTransform: 'none', fontSize: '0.85rem',
                        '&:hover': { backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.2)' : '#f5f5f5' },
                      }}
                    >
                      {label}
                    </ToggleButton>
                  );
                })}
              </Box>
            </Box>

            {/* BR Range Grid Selector */}
            <BRGridSelector brRange={effectiveBrRange} onBrRangeChange={setBrRange} />
          </Stack>
        </Paper>

        <Typography variant="body2" sx={{ color: '#737373', mb: 2 }}>
          展示 BR {effectiveBrRange[0].toFixed(1)} - {effectiveBrRange[1].toFixed(1)} 范围内{selectedTypes.length > 0 ? selectedTypes.map(t => config.typeLabels[t]).join('、') : '全部'}的指标对比，橙色星形标记当前载具位置
        </Typography>

        <Grid container spacing={2}>
          {/* Stats Charts */}
          {statsComparisons?.winRate && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.winRate} title="胜率" unit="%" navPrefix={config.navPrefix} />
            </Grid>
          )}
          {statsComparisons?.killPerSpawn && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.killPerSpawn} title="KR (每重生击毁)" unit="" navPrefix={config.navPrefix} />
            </Grid>
          )}
          {statsComparisons?.expPerSpawn && (
            <Grid item xs={12} md={4}>
              <DistributionChart data={statsComparisons.expPerSpawn} title="每次重生经验" unit=" RP" navPrefix={config.navPrefix} />
            </Grid>
          )}
        </Grid>
      </Container>
    </Box>
  );
}
