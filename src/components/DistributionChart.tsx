import { Paper, Typography, Box, Chip, Divider } from '@mui/material';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from 'recharts';
import { useState, useCallback, useMemo } from 'react';
import type { DistributionData, MetricType } from '../types';

interface DistributionChartProps {
  data: DistributionData;
  title: string;
  unit: string;
}

/** Color mapping for each metric type */
const METRIC_COLORS: Record<MetricType, string> = {
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
};

/** Display name mapping for each metric type */
const METRIC_NAMES: Record<MetricType, string> = {
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
};

// Distance threshold for clustering (in data units)
// Very high thresholds - only cluster when points are almost completely overlapping
const CLUSTER_THRESHOLD_X = 1.5;   // metric value threshold (~25-30px at typical scale)
const CLUSTER_THRESHOLD_Y = 3000;  // battles threshold (~25-30px at typical scale)

interface ScatterPoint {
  x: number;
  y: number;
  name: string;
  isCurrent: boolean;
  vehicleId: string;
  dotColor?: string;
}

export default function DistributionChart({ data, title, unit }: DistributionChartProps) {
  const color = METRIC_COLORS[data.metric] || '#4ade80';
  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint | null>(null);

  // Transform data for scatter chart: x=metric value, y=battles
  const scatterData = useMemo(() => data.bins.map((bin) => ({
    x: bin.metricValue || 0,
    y: bin.battles || 0,
    name: bin.range,
    isCurrent: bin.isCurrent,
    vehicleId: bin.vehicleId,
    dotColor: bin.dotColor,
  })), [data.bins]);

  // Separate current vehicle from others
  const currentVehicle = scatterData.find(d => d.isCurrent);
  const otherVehicles = scatterData.filter(d => !d.isCurrent);

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

  // Custom Tooltip that shows clustered vehicles
  const CustomTooltip = ({ active, payload }: any) => {
    // Get the hovered point from payload or use the tracked state
    const point = payload && payload[0]?.payload as ScatterPoint;
    const targetPoint = point || hoveredPoint;
    
    if (!active || !targetPoint) return null;
    
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
              label={`该区域有 ${nearbyPoints.length} 个载具`}
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
              {index > 0 && <Divider sx={{ my: 1, borderColor: '#333' }} />}
              <Box sx={{ 
                p: 0.5, 
                borderRadius: 0.5,
                backgroundColor: p.isCurrent ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
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
                    {METRIC_NAMES[data.metric]}:
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
      elevation={1}
      sx={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 2,
        p: 2,
        height: '100%',
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#171717', fontWeight: 600, fontSize: '1rem' }}>
          {title}
        </Typography>
        <Typography variant="caption" sx={{ color: '#737373' }}>
          当前载具: {data.currentVehicleValue.toFixed(1)} {unit}
        </Typography>
      </Box>
      
      <Box sx={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              type="number"
              dataKey="x"
              tick={{ fill: '#737373', fontSize: 10 }}
              axisLine={{ stroke: '#333' }}
              tickLine={{ stroke: '#333' }}
              label={{ value: unit, position: 'bottom', fill: '#737373', fontSize: 10 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              tick={{ fill: '#737373', fontSize: 10 }}
              axisLine={{ stroke: '#333' }}
              tickLine={{ stroke: '#333' }}
              tickFormatter={(value) => value.toLocaleString()}
              label={{ value: '出场数', angle: -90, position: 'insideLeft', fill: '#737373', fontSize: 10 }}
            />
            <ZAxis type="number" range={[60, 60]} />
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ strokeDasharray: '3 3' }}
              isAnimationActive={false}
            />
            
            {/* Other vehicles - colored by BR distance using shape renderer */}
            <Scatter
              data={otherVehicles}
              onMouseEnter={(data) => setHoveredPoint(data as ScatterPoint)}
              onMouseLeave={() => setHoveredPoint(null)}
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                const dotColor = payload?.dotColor || color;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={dotColor}
                  />
                );
              }}
            />
            
            {/* Current vehicle - highlighted with star shape */}
            {currentVehicle && (
              <Scatter
                data={[currentVehicle]}
                onMouseEnter={(data) => setHoveredPoint(data as ScatterPoint)}
                onMouseLeave={() => setHoveredPoint(null)}
                shape={(props: any) => {
                  const { cx, cy } = props;
                  const size = 8; // Star size
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
                      strokeWidth={1}
                    />
                  );
                }}
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </Box>
      
      {/* Gradient legend */}
      <Box sx={{ mt: 1, px: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#737373', fontSize: '0.65rem' }}>BR-1.0</Typography>
          <Typography variant="caption" sx={{ color: '#737373', fontSize: '0.65rem' }}>同BR</Typography>
          <Typography variant="caption" sx={{ color: '#737373', fontSize: '0.65rem' }}>BR+1.0</Typography>
        </Box>
        <Box
          sx={{
            height: 8,
            borderRadius: 1,
            background: 'linear-gradient(90deg, hsl(240, 75%, 50%) 0%, hsl(120, 75%, 50%) 50%, hsl(0, 75%, 50%) 100%)',
          }}
        />
      </Box>
    </Paper>
  );
}
