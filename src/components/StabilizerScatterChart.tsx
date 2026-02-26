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
import { useState, useMemo, useCallback } from 'react';
import type { Vehicle } from '../types';

interface StabilizerScatterChartProps {
  vehicles: Vehicle[];
  currentVehicleId: string;
  currentStabilizerType: Vehicle['performance']['stabilizerType'];
}

const STABILIZER_LABELS: Record<Vehicle['performance']['stabilizerType'], string> = {
  none: '无',
  horizontal: '水平',
  vertical: '垂直',
  both: '双向',
};

const STABILIZER_ORDER: Vehicle['performance']['stabilizerType'][] = ['none', 'horizontal', 'vertical', 'both'];

// Map stabilizer type to numeric value for X-axis
const STABILIZER_X_MAP: Record<Vehicle['performance']['stabilizerType'], number> = {
  none: 0,
  horizontal: 1,
  vertical: 2,
  both: 3,
};

interface ScatterPoint {
  x: number;
  y: number;
  name: string;
  stabilizerType: Vehicle['performance']['stabilizerType'];
  isCurrent: boolean;
  vehicleId: string;
  brDiff: number;
  dotColor: string;
}

export default function StabilizerScatterChart({ 
  vehicles, 
  currentVehicleId, 
  currentStabilizerType 
}: StabilizerScatterChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint | null>(null);

  // Calculate BR gradient color: BR-1.0 (blue, 240°) -> BR 0 (green, 120°) -> BR+1.0 (red, 0°)
  const getBRGradientColor = (brDiff: number): string => {
    const clampedDiff = Math.max(-1.0, Math.min(1.0, brDiff));
    const hue = 120 - (clampedDiff * 120);
    return `hsl(${hue}, 75%, 50%)`;
  };

  // Get current vehicle BR for comparison
  const currentVehicle = vehicles.find(v => v.id === currentVehicleId);
  const targetBR = currentVehicle?.battleRating || 0;

  // Transform data for scatter chart
  const scatterData = useMemo(() => {
    return vehicles.map((v) => {
      const brDiff = parseFloat((v.battleRating - targetBR).toFixed(2));
      const isCurrent = v.id === currentVehicleId;
      
      return {
        x: STABILIZER_X_MAP[v.performance.stabilizerType],
        y: v.stats?.battles || 0,
        name: v.localizedName,
        stabilizerType: v.performance.stabilizerType,
        isCurrent,
        vehicleId: v.id,
        brDiff,
        dotColor: isCurrent ? '#f97316' : getBRGradientColor(brDiff),
      };
    });
  }, [vehicles, currentVehicleId, targetBR]);

  // Separate current vehicle from others
  const currentVehiclePoint = scatterData.find(d => d.isCurrent);
  const otherVehicles = scatterData.filter(d => !d.isCurrent);

  // Find nearby points based on coordinate distance
  const findNearbyPoints = useCallback((centerPoint: ScatterPoint): ScatterPoint[] => {
    const nearby = scatterData.filter(point => {
      if (point.vehicleId === centerPoint.vehicleId) return true;
      // Only cluster points with same stabilizer type and similar battles
      const xDist = Math.abs(point.x - centerPoint.x);
      const yDist = Math.abs(point.y - centerPoint.y);
      return xDist < 0.5 && yDist < 3000;
    });
    
    return nearby.sort((a, b) => {
      const distA = Math.abs(a.y - centerPoint.y);
      const distB = Math.abs(b.y - centerPoint.y);
      return distA - distB;
    });
  }, [scatterData]);

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
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
        
        {nearbyPoints.map((p, index) => (
          <Box key={p.vehicleId}>
            {index > 0 && <Divider sx={{ my: 1, borderColor: '#e5e5e5' }} />}
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
                  稳定器:
                </Typography>
                <Typography variant="caption" sx={{ color: '#171717', fontSize: '0.7rem', fontWeight: 500 }}>
                  {STABILIZER_LABELS[p.stabilizerType]}
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
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  // Calculate counts for each type
  const counts = vehicles.reduce((acc, v) => {
    acc[v.performance.stabilizerType] = (acc[v.performance.stabilizerType] || 0) + 1;
    return acc;
  }, {} as Record<Vehicle['performance']['stabilizerType'], number>);

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
          稳定器分布
        </Typography>
        <Typography variant="caption" sx={{ color: '#737373' }}>
          当前载具: {STABILIZER_LABELS[currentStabilizerType]}稳定器
        </Typography>
      </Box>
      
      <Box sx={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[-0.5, 3.5]}
              tickFormatter={(value) => STABILIZER_LABELS[STABILIZER_ORDER[value]] || ''}
              ticks={[0, 1, 2, 3]}
              tick={{ fill: '#737373', fontSize: 10 }}
              axisLine={{ stroke: '#d4d4d4' }}
              tickLine={{ stroke: '#d4d4d4' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              tick={{ fill: '#737373', fontSize: 10 }}
              axisLine={{ stroke: '#d4d4d4' }}
              tickLine={{ stroke: '#d4d4d4' }}
              tickFormatter={(value) => value.toLocaleString()}
              label={{ value: '出场数', angle: -90, position: 'insideLeft', fill: '#737373', fontSize: 10 }}
            />
            <ZAxis type="number" range={[60, 60]} />
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ strokeDasharray: '3 3' }}
              isAnimationActive={false}
            />
            
            {/* Other vehicles */}
            <Scatter
              data={otherVehicles}
              onMouseEnter={(data) => setHoveredPoint(data as ScatterPoint)}
              onMouseLeave={() => setHoveredPoint(null)}
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                const dotColor = payload?.dotColor || '#737373';
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
            {currentVehiclePoint && (
              <Scatter
                data={[currentVehiclePoint]}
                onMouseEnter={(data) => setHoveredPoint(data as ScatterPoint)}
                onMouseLeave={() => setHoveredPoint(null)}
                shape={(props: any) => {
                  const { cx, cy } = props;
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
                    />
                  );
                }}
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </Box>
      
      {/* Legend */}
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
