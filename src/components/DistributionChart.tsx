import { Paper, Typography, Box, Chip, Divider } from '@mui/material';
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from 'recharts';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DistributionData, MetricType } from '../types';

interface DistributionChartProps {
  data: DistributionData;
  title: string;
  unit: string;
  /** Current vehicle BR and filter BR range for gradient legend labels */
  brInfo?: { vehicleBR: number; brMin: number; brMax: number };
}

/** Extended metric type including stats metrics */
type ExtendedMetricType = MetricType | 'killPerSpawn' | 'winRate' | 'expPerSpawn';

/** Color mapping for each metric type */
const METRIC_COLORS: Record<ExtendedMetricType, string> = {
  powerToWeight: '#4ade80',
  maxSpeed: '#60a5fa',
  maxReverseSpeed: '#3b82f6',
  traverseSpeed: '#a78bfa',
  reloadTime: '#f97316',
  elevationSpeed: '#fbbf24',
  elevationMin: '#f472b6',
  penetration: '#ef4444',
  gunnerThermal: '#fbbf24',
  commanderThermal: '#fbbf24',
  stabilizer: '#8b5cf6',
  killPerSpawn: '#f97316',
  winRate: '#4ade80',
  expPerSpawn: '#3b82f6',
};

/** Display name mapping for each metric type */
const METRIC_NAMES: Record<ExtendedMetricType, string> = {
  powerToWeight: '功重比',
  maxSpeed: '前进极速',
  maxReverseSpeed: '倒车速度',
  traverseSpeed: '方向机速度',
  reloadTime: '装填时间',
  elevationSpeed: '高低机速度',
  elevationMin: '俯角',
  penetration: '穿深',
  gunnerThermal: '炮手热成像',
  commanderThermal: '车长热成像',
  stabilizer: '稳定器',
  killPerSpawn: 'KR',
  winRate: '胜率',
  expPerSpawn: '每次重生经验',
};

// Distance threshold for clustering (in data units)
// Very high thresholds - only cluster when points are almost completely overlapping
const CLUSTER_THRESHOLD_X = 1.5;   // metric value threshold (~25-30px at typical scale)
const CLUSTER_THRESHOLD_Y = 3000;  // battles threshold (~25-30px at typical scale)

interface ScatterPoint {
  x: number;
  y: number;
  name: string;
  isCurrent?: boolean;
  vehicleId?: string;
  dotColor?: string;
}

export default function DistributionChart({ data, title, unit, brInfo }: DistributionChartProps) {
  const color = METRIC_COLORS[data.metric as ExtendedMetricType] || '#4ade80';
  const navigate = useNavigate();
  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint | null>(null);
  const [lockedPoint, setLockedPoint] = useState<ScatterPoint | null>(null);
  const [lockedTooltipPos, setLockedTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);

  // Transform data for scatter chart: x=metric value, y=battles
  const scatterData = useMemo(() => data.bins.map((bin) => ({
    x: bin.metricValue || 0,
    y: bin.battles || 0,
    name: bin.range,
    isCurrent: bin.isCurrent,
    vehicleId: bin.vehicleId,
    dotColor: (bin as any).dotColor,
  })), [data.bins]);

  // Separate current vehicle from others
  const currentVehicle = scatterData.find(d => d.isCurrent);
  const otherVehicles = scatterData.filter(d => !d.isCurrent);

  // Compute cumulative percentile line data (sorted by x, cumulative battles percentage)
  const percentileLine = useMemo(() => {
    const sorted = [...scatterData].sort((a, b) => a.x - b.x);
    const totalBattles = sorted.reduce((sum, d) => sum + d.y, 0);
    if (totalBattles === 0) return [];
    let cumBattles = 0;
    return sorted.map(d => {
      cumBattles += d.y;
      return { x: d.x, pct: Math.round((cumBattles / totalBattles) * 100) };
    });
  }, [scatterData]);

  // Calculate Euclidean distance between two points (normalized)
  const getDistance = useCallback((p1: ScatterPoint, p2: ScatterPoint): number => {
    // Normalize distances to make them comparable
    const xRange = Math.max(...scatterData.map(d => d.x)) - Math.min(...scatterData.map(d => d.x)) || 1;
    const yRange = Math.max(...scatterData.map(d => d.y)) - Math.min(...scatterData.map(d => d.y)) || 1;
    
    const xDist = (p1.x - p2.x) / xRange;
    const yDist = (p1.y - p2.y) / yRange;
    
    return Math.sqrt(xDist * xDist + yDist * yDist);
  }, [scatterData]);

  // Find nearby points based on coordinate distance
  const findNearbyPoints = useCallback((centerPoint: ScatterPoint): ScatterPoint[] => {
    const nearby = scatterData.filter(point => {
      if (point.vehicleId === centerPoint.vehicleId) return true; // Always include the hovered point
      
      const xDist = Math.abs(point.x - centerPoint.x);
      const yDist = Math.abs(point.y - centerPoint.y);
      
      // Use fixed thresholds - only cluster truly overlapping points
      return xDist < CLUSTER_THRESHOLD_X && yDist < CLUSTER_THRESHOLD_Y;
    });
    
    // Sort by distance from center point (closest first)
    return nearby.sort((a, b) => {
      const distA = getDistance(centerPoint, a);
      const distB = getDistance(centerPoint, b);
      return distA - distB;
    });
  }, [scatterData, getDistance]);

  // Calculate weighted percentile by battles for a given metric value
  const calculatePercentile = useCallback((value: number): number => {
    const totalBattles = scatterData.reduce((sum, d) => sum + d.y, 0);
    if (totalBattles === 0) return 0;
    const battlesLessOrEqual = scatterData.filter(d => d.x <= value).reduce((sum, d) => sum + d.y, 0);
    return Math.round((battlesLessOrEqual / totalBattles) * 100);
  }, [scatterData]);

  // Handle point click to lock/unlock tooltip
  // recharts Scatter onClick signature: (data, index, event)
  const handlePointClick = useCallback((point: ScatterPoint, _index: number, event: any) => {
    // event from recharts can be a React SyntheticEvent or native MouseEvent
    const nativeEvent = event?.nativeEvent || event;
    nativeEvent?.stopPropagation?.();
    
    setLockedPoint(prev => {
      if (prev?.vehicleId === point.vehicleId) {
        setLockedTooltipPos(null);
        return null;
      }
      // Calculate tooltip position relative to chart area
      if (chartAreaRef.current) {
        const rect = chartAreaRef.current.getBoundingClientRect();
        const clientX = nativeEvent?.clientX ?? 0;
        const clientY = nativeEvent?.clientY ?? 0;
        setLockedTooltipPos({
          x: clientX - rect.left,
          y: clientY - rect.top,
        });
      }
      return point;
    });
  }, []);

  // Handle click outside to unlock
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chartRef.current && !chartRef.current.contains(event.target as Node)) {
        setLockedPoint(null);
        setLockedTooltipPos(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle vehicle name click to navigate
  const handleVehicleClick = useCallback((vehicleId: string) => {
    navigate(`/vehicle/${vehicleId}`);
  }, [navigate]);

  // Custom Tooltip that shows clustered vehicles (only for hover, not locked)
  const CustomTooltip = ({ active, payload }: any) => {
    // When locked, don't render here - the overlay handles it
    if (lockedPoint) return null;
    
    const pointFromPayload = payload && payload[0]?.payload as ScatterPoint;
    const targetPoint = hoveredPoint || pointFromPayload;
    
    // Don't render tooltip for Line data (percentile line) - it has no vehicleId/name
    if (!targetPoint || !targetPoint.name) return null;
    if (!active) return null;
    
    const nearbyPoints = findNearbyPoints(targetPoint);
    const hasMultiple = nearbyPoints.length > 1;
    
    return (
      <Box
        sx={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRadius: 1,
          p: 1.5,
          minWidth: 220,
          maxWidth: 320,
          maxHeight: 280,
          overflow: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        {hasMultiple && (
          <Box sx={{ mb: 1 }}>
            <Chip 
              size="small" 
              label={`该区域有 ${nearbyPoints.length} 个载具 (点击固定)`}
              sx={{ 
                backgroundColor: 'rgba(249, 115, 22, 0.2)', 
                color: '#f97316',
                fontSize: '0.7rem',
                height: 20,
              }}
            />
          </Box>
        )}
        
        {nearbyPoints.map((p, index) => {
          const percentile = calculatePercentile(p.x);
          return (
            <Box key={p.vehicleId}>
              {index > 0 && <Divider sx={{ my: 1, borderColor: '#e5e5e5' }} />}
              <Box sx={{ 
                p: 0.5, 
                borderRadius: 0.5,
                backgroundColor: p.isCurrent ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
              }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: p.isCurrent ? '#f97316' : '#171717', 
                    fontWeight: p.isCurrent ? 600 : 500,
                    fontSize: '0.8rem',
                  }}
                >
                  {p.isCurrent ? '⭐ ' : ''}{p.name}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#737373', fontSize: '0.7rem' }}>
                    {METRIC_NAMES[data.metric as ExtendedMetricType]}:
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#171717', fontSize: '0.7rem', fontWeight: 500 }}>
                    {p.x.toFixed(1)} {unit}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: '#737373', fontSize: '0.7rem' }}>
                    出场数:
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#171717', fontSize: '0.7rem', fontWeight: 500 }}>
                    {p.y.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: '#737373', fontSize: '0.7rem' }}>
                    出场占比 (≤该值):
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#171717', fontSize: '0.7rem', fontWeight: 600 }}>
                    {percentile}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  };

  // Locked tooltip overlay content (rendered outside recharts)
  const LockedTooltipOverlay = () => {
    if (!lockedPoint || !lockedTooltipPos) return null;
    
    const nearbyPoints = findNearbyPoints(lockedPoint);
    
    return (
      <Box
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: 'absolute',
          left: lockedTooltipPos.x + 15,
          top: lockedTooltipPos.y - 10,
          zIndex: 1000,
          pointerEvents: 'auto',
          backgroundColor: '#ffffff',
          border: '2px solid #f97316',
          borderRadius: 1,
          p: 1.5,
          minWidth: 220,
          maxWidth: 320,
          maxHeight: 280,
          overflow: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <Box sx={{ mb: 1 }}>
          <Chip 
            size="small" 
            label="已固定 - 点击外部解锁"
            sx={{ 
              backgroundColor: 'rgba(249, 115, 22, 0.15)', 
              color: '#f97316',
              fontSize: '0.7rem',
              height: 20,
              fontWeight: 500,
            }}
          />
        </Box>
        
        {nearbyPoints.map((p, index) => {
          const percentile = calculatePercentile(p.x);
          return (
            <Box key={p.vehicleId}>
              {index > 0 && <Divider sx={{ my: 1, borderColor: '#e5e5e5' }} />}
              <Box sx={{ 
                p: 0.5, 
                borderRadius: 0.5,
                backgroundColor: p.isCurrent ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
              }}>
                <Typography 
                  variant="body2" 
                  onClick={() => handleVehicleClick(p.vehicleId!)}
                  sx={{ 
                    color: p.isCurrent ? '#f97316' : '#171717', 
                    fontWeight: p.isCurrent ? 600 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textDecorationColor: 'transparent',
                    transition: 'all 0.2s',
                    '&:hover': {
                      textDecorationColor: p.isCurrent ? '#f97316' : '#171717',
                    },
                  }}
                >
                  {p.isCurrent ? '⭐ ' : ''}{p.name}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#737373', fontSize: '0.7rem' }}>
                    {METRIC_NAMES[data.metric as ExtendedMetricType]}:
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#171717', fontSize: '0.7rem', fontWeight: 500 }}>
                    {p.x.toFixed(1)} {unit}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: '#737373', fontSize: '0.7rem' }}>
                    出场数:
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#171717', fontSize: '0.7rem', fontWeight: 500 }}>
                    {p.y.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: '#737373', fontSize: '0.7rem' }}>
                    出场占比 (≤该值):
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#171717', fontSize: '0.7rem', fontWeight: 600 }}>
                    {percentile}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Paper
      ref={chartRef}
      elevation={1}
      onClick={() => { setLockedPoint(null); setLockedTooltipPos(null); }}
      sx={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 2,
        p: 2,
        height: '100%',
        cursor: 'default',
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#171717', fontWeight: 600, fontSize: '1rem' }}>
          {title}
        </Typography>
        <Typography variant="caption" sx={{ color: '#737373' }}>
          当前载具: {data.currentVehicleValue?.toFixed(1) ?? '-'} {unit}
        </Typography>
      </Box>
      
      <Box sx={{ height: 240, position: 'relative' }} ref={chartAreaRef} onClick={(e) => e.stopPropagation()}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 10, right: 35, left: 5, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              type="number"
              dataKey="x"
              tick={{ fill: '#737373', fontSize: 10 }}
              axisLine={{ stroke: '#333' }}
              tickLine={{ stroke: '#333' }}
              label={{ value: unit, position: 'bottom', fill: '#737373', fontSize: 10 }}
              allowDuplicatedCategory={false}
            />
            <YAxis
              yAxisId="left"
              type="number"
              dataKey="y"
              tick={{ fill: '#737373', fontSize: 10 }}
              axisLine={{ stroke: '#333' }}
              tickLine={{ stroke: '#333' }}
              tickFormatter={(value) => {
                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                return value.toString();
              }}
              width={40}
              label={{ value: '出场数', angle: -90, position: 'insideLeft', fill: '#737373', fontSize: 10 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              type="number"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: '#f97316', fontSize: 9 }}
              axisLine={{ stroke: '#f97316' }}
              tickLine={{ stroke: '#f97316' }}
              tickFormatter={(v) => `${v}%`}
              width={35}
            />
            <ZAxis type="number" range={[60, 60]} />
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ strokeDasharray: '3 3' }}
              isAnimationActive={false}
            />
            
            {/* Cumulative percentile line */}
            <Line
              key={`pct-${percentileLine.length}-${percentileLine[0]?.x ?? 0}-${percentileLine[percentileLine.length - 1]?.x ?? 0}`}
              yAxisId="right"
              data={percentileLine}
              dataKey="pct"
              stroke="#f97316"
              strokeWidth={1.5}
              dot={false}
              strokeOpacity={0.6}
              isAnimationActive={false}
              tooltipType="none"
            />
            
            {/* Other vehicles - colored by BR distance using shape renderer */}
            <Scatter
              yAxisId="left"
              data={otherVehicles}
              onMouseEnter={(data) => setHoveredPoint(data as ScatterPoint)}
              onMouseLeave={() => setHoveredPoint(null)}
              onClick={(data: any, index: any, event: any) => handlePointClick(data as ScatterPoint, index, event)}
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                const dotColor = payload?.dotColor || color;
                const isLocked = lockedPoint?.vehicleId === payload?.vehicleId;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isLocked ? 6 : 4}
                    fill={dotColor}
                    stroke={isLocked ? '#f97316' : 'transparent'}
                    strokeWidth={isLocked ? 2 : 0}
                    style={{ cursor: 'pointer' }}
                  />
                );
              }}
            />
            
            {/* Current vehicle - highlighted with star shape */}
            {currentVehicle && (
              <Scatter
                yAxisId="left"
                data={[currentVehicle]}
                onMouseEnter={(data) => setHoveredPoint(data as ScatterPoint)}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={(data: any, index: any, event: any) => handlePointClick(data as ScatterPoint, index, event)}
                shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  const size = lockedPoint?.vehicleId === payload?.vehicleId ? 10 : 8;
                  const strokeWidth = lockedPoint?.vehicleId === payload?.vehicleId ? 2 : 1;
                  // Calculate 5-point star coordinates
                  const starPoints = [];
                  for (let i = 0; i < 10; i++) {
                    const angle = (i * Math.PI) / 5 - Math.PI / 2;
                    const radius = i % 2 === 0 ? size : size / 2.5;
                    starPoints.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
                  }
                  return (
                    <polygon
                      points={starPoints.join(' ')}
                      fill="#f97316"
                      stroke="#fff"
                      strokeWidth={strokeWidth}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        <LockedTooltipOverlay />
      </Box>
      
      {/* Gradient legend */}
      <Box sx={{ mt: 1, px: 2 }}>
        {(() => {
          const midPct = brInfo
            ? ((brInfo.vehicleBR - brInfo.brMin) / Math.max(brInfo.brMax - brInfo.brMin, 0.1)) * 100
            : 50;
          const clampedMidPct = Math.max(5, Math.min(95, midPct));
          return (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, position: 'relative' }}>
                <Typography variant="caption" sx={{ color: '#737373', fontSize: '0.65rem' }}>
                  {brInfo ? `BR ${brInfo.brMin.toFixed(1)}` : 'BR-1.0'}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#737373',
                    fontSize: '0.65rem',
                    position: 'absolute',
                    left: `${clampedMidPct}%`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {brInfo ? `BR ${brInfo.vehicleBR.toFixed(1)}` : '同BR'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#737373', fontSize: '0.65rem' }}>
                  {brInfo ? `BR ${brInfo.brMax.toFixed(1)}` : 'BR+1.0'}
                </Typography>
              </Box>
              <Box
                sx={{
                  height: 8,
                  borderRadius: 1,
                  background: `linear-gradient(90deg, hsl(240, 75%, 50%) 0%, hsl(120, 75%, 50%) ${clampedMidPct}%, hsl(0, 75%, 50%) 100%)`,
                }}
              />
            </>
          );
        })()}
      </Box>
    </Paper>
  );
}
