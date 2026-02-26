import {
  Paper,
  Box,
  Typography,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { NATIONS, BATTLE_RATINGS, type Nation, type VehicleType } from '../types';

// 用于滑块标记的 BR 点（每隔几个显示一个标签，避免拥挤）
const BR_MARKS = BATTLE_RATINGS.map(br => ({
  value: br,
  label: br % 1 === 0 ? br.toFixed(1) : '', // 只在整数 BR 显示标签
}));

interface VehicleFilterProps {
  selectedNations: Nation[];
  onNationsChange: (nations: Nation[]) => void;
  brRange: [number, number];
  onBrRangeChange: (range: [number, number]) => void;
  selectedType: VehicleType | 'all';
  onTypeChange: (type: VehicleType | 'all') => void;
}

const VEHICLE_TYPES: { value: VehicleType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'light_tank', label: '轻坦' },
  { value: 'medium_tank', label: '中坦' },
  { value: 'heavy_tank', label: '重坦' },
  { value: 'tank_destroyer', label: '坦歼' },
  { value: 'spaa', label: '防空' },
];

export default function VehicleFilter({
  selectedNations,
  onNationsChange,
  brRange,
  onBrRangeChange,
  selectedType,
  onTypeChange,
}: VehicleFilterProps) {
  const handleNationToggle = (nation: Nation) => {
    if (selectedNations.includes(nation)) {
      onNationsChange(selectedNations.filter(n => n !== nation));
    } else {
      onNationsChange([...selectedNations, nation]);
    }
  };

  const handleSelectAllNations = () => {
    if (selectedNations.length === NATIONS.length) {
      onNationsChange([]);
    } else {
      onNationsChange(NATIONS.map(n => n.id));
    }
  };

  return (
    <Paper
      elevation={1}
      sx={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 2,
        p: 3,
        mb: 3,
      }}
    >
      {/* Nation Filter */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ color: '#171717', fontWeight: 600 }}>
            国家筛选
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#16a34a',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
            }}
            onClick={handleSelectAllNations}
          >
            {selectedNations.length === NATIONS.length ? '取消全选' : '全选'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {NATIONS.map(nation => {
            const isSelected = selectedNations.includes(nation.id);
            return (
              <ToggleButton
                key={nation.id}
                value={nation.id}
                selected={isSelected}
                onChange={() => handleNationToggle(nation.id)}
                sx={{
                  minWidth: 0,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  border: '1px solid #d4d4d4',
                  backgroundColor: isSelected ? 'rgba(22, 163, 74, 0.1)' : '#ffffff',
                  color: isSelected ? '#16a34a' : '#525252',
                  textTransform: 'none',
                  fontSize: '0.85rem',
                  '&:hover': {
                    backgroundColor: isSelected ? 'rgba(22, 163, 74, 0.2)' : '#f5f5f5',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(22, 163, 74, 0.1)',
                    color: '#16a34a',
                  },
                }}
              >
                {nation.flagIcon} {nation.nameZh}
              </ToggleButton>
            );
          })}
        </Box>
      </Box>

      {/* Battle Rating Range */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ color: '#171717', fontWeight: 600, mb: 2 }}>
          权重范围: {brRange[0].toFixed(1)} - {brRange[1].toFixed(1)}
        </Typography>
        <Slider
          value={brRange}
          onChange={(_, value) => onBrRangeChange(value as [number, number])}
          min={1.0}
          max={12.7}
          step={null}
          marks={BR_MARKS}
          sx={{
            color: '#16a34a',
            '& .MuiSlider-thumb': {
              backgroundColor: '#16a34a',
            },
            '& .MuiSlider-track': {
              backgroundColor: '#16a34a',
            },
            '& .MuiSlider-mark': {
              backgroundColor: '#a3a3a3',
            },
            '& .MuiSlider-markActive': {
              backgroundColor: '#16a34a',
            },
            '& .MuiSlider-markLabel': {
              color: '#737373',
              fontSize: '0.75rem',
            },
          }}
        />
      </Box>

      {/* Vehicle Type */}
      <Box>
        <Typography variant="subtitle1" sx={{ color: '#171717', fontWeight: 600, mb: 2 }}>
          载具类型
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {VEHICLE_TYPES.map(type => (
            <ToggleButton
              key={type.value}
              value={type.value}
              selected={selectedType === type.value}
              onChange={() => onTypeChange(type.value)}
              sx={{
                px: 2,
                py: 0.5,
                borderRadius: 1,
                border: '1px solid #d4d4d4',
                backgroundColor: selectedType === type.value ? 'rgba(37, 99, 235, 0.1)' : '#ffffff',
                color: selectedType === type.value ? '#2563eb' : '#525252',
                textTransform: 'none',
                fontSize: '0.85rem',
                '&:hover': {
                  backgroundColor: selectedType === type.value ? 'rgba(37, 99, 235, 0.2)' : '#f5f5f5',
                },
              }}
            >
              {type.label}
            </ToggleButton>
          ))}
        </Box>
      </Box>
    </Paper>
  );
}
