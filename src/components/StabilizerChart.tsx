import { Paper, Typography, Box, Chip } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Vehicle } from '../types';

interface StabilizerChartProps {
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

const STABILIZER_COLORS: Record<Vehicle['performance']['stabilizerType'], string> = {
  none: '#9ca3af',    // gray
  horizontal: '#3b82f6', // blue
  vertical: '#8b5cf6',   // purple
  both: '#16a34a',       // green
};

interface StabilizerData {
  type: Vehicle['performance']['stabilizerType'];
  label: string;
  count: number;
  isCurrent: boolean;
}

export default function StabilizerChart({ 
  vehicles, 
  currentVehicleId, 
  currentStabilizerType 
}: StabilizerChartProps) {
  // Count vehicles by stabilizer type
  const counts = vehicles.reduce((acc, v) => {
    acc[v.performance.stabilizerType] = (acc[v.performance.stabilizerType] || 0) + 1;
    return acc;
  }, {} as Record<Vehicle['performance']['stabilizerType'], number>);

  // Prepare chart data
  const data: StabilizerData[] = [
    { type: 'none', label: STABILIZER_LABELS['none'], count: counts['none'] || 0, isCurrent: currentStabilizerType === 'none' },
    { type: 'horizontal', label: STABILIZER_LABELS['horizontal'], count: counts['horizontal'] || 0, isCurrent: currentStabilizerType === 'horizontal' },
    { type: 'vertical', label: STABILIZER_LABELS['vertical'], count: counts['vertical'] || 0, isCurrent: currentStabilizerType === 'vertical' },
    { type: 'both', label: STABILIZER_LABELS['both'], count: counts['both'] || 0, isCurrent: currentStabilizerType === 'both' },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;
    
    const item = payload[0].payload as StabilizerData;
    const percentage = vehicles.length > 0 ? ((item.count / vehicles.length) * 100).toFixed(1) : '0';
    
    return (
      <Box
        sx={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRadius: 1,
          p: 1.5,
          minWidth: 150,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <Typography 
          variant="body2" 
          sx={{ 
            color: item.isCurrent ? '#f97316' : '#171717', 
            fontWeight: item.isCurrent ? 600 : 500,
            fontSize: '0.85rem',
          }}
        >
          {item.isCurrent ? '⭐ ' : ''}{item.label}稳定器
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="caption" sx={{ color: '#737373' }}>
            载具数量:
          </Typography>
          <Typography variant="caption" sx={{ color: '#171717', fontWeight: 600 }}>
            {item.count}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: '#737373' }}>
            占比:
          </Typography>
          <Typography variant="caption" sx={{ color: '#171717', fontWeight: 600 }}>
            {percentage}%
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
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#737373', fontSize: 11 }}
              axisLine={{ stroke: '#d4d4d4' }}
              tickLine={{ stroke: '#d4d4d4' }}
            />
            <YAxis
              tick={{ fill: '#737373', fontSize: 10 }}
              axisLine={{ stroke: '#d4d4d4' }}
              tickLine={{ stroke: '#d4d4d4' }}
              label={{ value: '载具数', angle: -90, position: 'insideLeft', fill: '#737373', fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={STABILIZER_COLORS[entry.type]}
                  stroke={entry.isCurrent ? '#f97316' : 'transparent'}
                  strokeWidth={entry.isCurrent ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      {/* Legend */}
      <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        {data.map((item) => (
          <Box key={item.type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: 1,
                backgroundColor: STABILIZER_COLORS[item.type],
                border: item.isCurrent ? '2px solid #f97316' : 'none',
              }}
            />
            <Typography variant="caption" sx={{ color: item.isCurrent ? '#f97316' : '#737373', fontSize: '0.7rem', fontWeight: item.isCurrent ? 600 : 400 }}>
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
