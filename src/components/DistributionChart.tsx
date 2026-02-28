import { Paper, Typography, Box, Chip, Divider, IconButton } from '@mui/material';
import { Add, Remove, Refresh } from '@mui/icons-material';
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
import { useState, useCallback, useMemo, useRef } from 'react';
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
  const chartAreaRef = useRef<HTMLDivElement>(null);

  // Clean zero-width spaces from vehicle names, keep WT symbols (rendered via WTSymbols font)
  const cleanString = (str: string): string => {
    return str.replace(/\u200b/g, '');
  };

  // Transform data for scatter chart: x=metric value, y=battles
  const scatterData = useMemo(() => data.bins.map((bin) => ({
    x: bin.metricValue || 0,
    y: bin.battles || 0,
    name: cleanString(bin.range),
    isCurrent: bin.isCurrent,
    vehicleId: bin.vehicleId,
    dotColor: (bin as any).dotColor,
  })), [data.bins]);

  // Separate current vehicle from others
  const currentVehicle = scatterData.find(d => d.isCurrent);
  const otherVehicles = scatterData.filter(d => !d.isCurrent);

  // Compute cumulative percentile line data
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

  // Calculate default domains
  const defaultDomains = useMemo(() => {
    const xValues = scatterData.map(d => d.x);
    const yValues = scatterData.map(d => d.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const xPadding = (xMax - xMin) * 0.05 || 1;
    const yPadding = (yMax - yMin) * 0.05 || 1000;
    return {
      xMin: xMin - xPadding,
      xMax: xMax + xPadding,
      yMin: Math.max(0, yMin - yPadding),
      yMax: yMax + yPadding,
    };
  }, [scatterData]);

  // View state (pan and zoom)
  const [viewState, setViewState] = useState<{
    xMin: number; xMax: number; yMin: number; yMax: number;
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0);

  const currentDomain = viewState ?? defaultDomains;
  const isZoomed = zoomLevel > 0;

  // Zoom in only (no zoom out beyond default)
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => {
      const newLevel = prev + 1;
      const zoomFactor = Math.pow(0.5, newLevel);
      const xCenter = (defaultDomains.xMin + defaultDomains.xMax) / 2;
      const yCenter = (defaultDomains.yMin + defaultDomains.yMax) / 2;
      const xRange = (defaultDomains.xMax - defaultDomains.xMin) * zoomFactor;
      const yRange = (defaultDomains.yMax - defaultDomains.yMin) * zoomFactor;
      setViewState({
        xMin: xCenter - xRange / 2,
        xMax: xCenter + xRange / 2,
        yMin: Math.max(0, yCenter - yRange / 2),
        yMax: yCenter + yRange / 2,
      });
      return newLevel;
    });
  }, [defaultDomains]);

  const handleReset = useCallback(() => {
    setZoomLevel(0);
    setViewState(null);
  }, []);

  // Drag to pan
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isZoomed) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isZoomed]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !chartAreaRef.current) return;
    const rect = chartAreaRef.current.getBoundingClientRect();
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    // Apply pan immediately for smooth dragging
    const xRange = currentDomain.xMax - currentDomain.xMin;
    const yRange = currentDomain.yMax - currentDomain.yMin;
    const xShift = (dx / rect.width) * xRange;
    const yShift = (dy / rect.height) * yRange;
    
    setViewState(prev => {
      if (!prev) return null;
      return {
        xMin: prev.xMin - xShift,
        xMax: prev.xMax - xShift,
        yMin: Math.max(0, prev.yMin + yShift),
        yMax: prev.yMax + yShift,
      };
    });
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, currentDomain]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  // Handle point click - navigate directly
  const handlePointClick = useCallback((point: ScatterPoint) => {
    if (point.vehicleId) {
      navigate(`/vehicle/${point.vehicleId}`);
    }
  }, [navigate]);

  // Calculate percentile
  const calculatePercentile = useCallback((value: number): number => {
    const totalBattles = scatterData.reduce((sum, d) => sum + d.y, 0);
    if (totalBattles === 0) return 0;
    const battlesLessOrEqual = scatterData.filter(d => d.x <= value).reduce((sum, d) => sum + d.y, 0);
    return Math.round((battlesLessOrEqual / totalBattles) * 100);
  }, [scatterData]);

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    const pointFromPayload = payload && payload[0]?.payload as ScatterPoint;
    const targetPoint = hoveredPoint || pointFromPayload;
    
    if (!targetPoint || !targetPoint.name) return null;
    if (!active) return null;
    
    const percentile = calculatePercentile(targetPoint.x);
    
    return (
      <Box
        sx={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRadius: 1,
          p: 1.5,
          minWidth: 180,
          maxWidth: 260,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <Typography 
          variant="body2" 
          sx={{ 
            color: targetPoint.isCurrent ? '#f97316' : '#171717', 
            fontWeight: targetPoint.isCurrent ? 600 : 500,
            fontSize: '0.85rem',
          }}
        >
          {targetPoint.isCurrent ? '⭐ ' : ''}{targetPoint.name}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#737373', fontSize: '0.7rem' }}>
            {METRIC_NAMES[data.metric as ExtendedMetricType]}:
          </Typography>
          <Typography variant="caption" sx={{ color: '#171717', fontSize: '0.7rem', fontWeight: 500 }}>
            {targetPoint.x.toFixed(1)} {unit}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: '#737373', fontSize: '0.7rem' }}>
            出场数:
          </Typography>
          <Typography variant="caption" sx={{ color: '#171717', fontSize: '0.7rem', fontWeight: 500 }}>
            {targetPoint.y.toLocaleString()}
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
    );
  };

  return (
    <Paper
      elevation={1}
      sx={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 2,
        p: 2,
        height: '100%',
        cursor: isDragging ? 'grabbing' : 'default',
        '& *': {
          outline: 'none !important',
        },
        '& *:focus': {
          outline: 'none !important',
          boxShadow: 'none !important',
        },
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
      
      <Box 
        sx={{ height: 240, position: 'relative' }} 
        ref={chartAreaRef} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Zoom controls */}
        <Box sx={{ 
          position: 'absolute',
          top: 0,
          right: 35,
          zIndex: 10,
          display: 'flex',
          gap: 0.5,
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderRadius: 1,
          p: 0.5,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <IconButton 
            size="small" 
            onClick={handleZoomIn}
            sx={{ width: 24, height: 24, p: 0 }}
          >
            <Add sx={{ fontSize: 16 }} />
          </IconButton>
          {isZoomed && (
            <IconButton 
              size="small" 
              onClick={handleReset}
              sx={{ width: 24, height: 24, p: 0 }}
            >
              <Refresh sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 10, right: 35, left: 5, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[currentDomain.xMin, currentDomain.xMax]}
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
              domain={[currentDomain.yMin, currentDomain.yMax]}
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
            
            {/* Percentile line */}
            <Line
              yAxisId="right"
              data={percentileLine}
              dataKey="pct"
              stroke="#f97316"
              strokeWidth={1.5}
              dot={false}
              strokeOpacity={0.4}
              isAnimationActive={false}
              tooltipType="none"
            />
            
            {/* Other vehicles */}
            <Scatter
              yAxisId="left"
              data={otherVehicles}
              onMouseEnter={(data) => setHoveredPoint(data as ScatterPoint)}
              onMouseLeave={() => setHoveredPoint(null)}
              onClick={(data: any) => handlePointClick(data as ScatterPoint)}
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null) return null;
                const dotColor = payload?.dotColor || color;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={dotColor}
                    style={{ cursor: 'pointer' }}
                  />
                );
              }}
            />
            
            {/* Current vehicle */}
            {currentVehicle && (
              <Scatter
                yAxisId="left"
                data={[currentVehicle]}
                onMouseEnter={(data) => setHoveredPoint(data as ScatterPoint)}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={(data: any) => handlePointClick(data as ScatterPoint)}
                shape={(props: any) => {
                  const { cx, cy } = props;
                  if (cx == null || cy == null) return null;
                  const size = 8;
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
                      strokeWidth={1}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
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
