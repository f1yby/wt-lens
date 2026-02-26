import {
  Paper,
  Box,
  Typography,
  ToggleButton,
} from '@mui/material';
import { useState, useCallback, useRef, useEffect } from 'react';
import { NATIONS, BATTLE_RATINGS, type Nation, type VehicleType } from '../types';

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

      {/* Battle Rating Grid Selector */}
      <BRGridSelector brRange={brRange} onBrRangeChange={onBrRangeChange} />

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

// BR 网格选择器组件
interface BRGridSelectorProps {
  brRange: [number, number];
  onBrRangeChange: (range: [number, number]) => void;
}

function BRGridSelector({ brRange, onBrRangeChange }: BRGridSelectorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasDragged = useRef(false);

  // 获取 BR 对应的索引
  const getBrIndex = useCallback((br: number) => BATTLE_RATINGS.indexOf(br), []);
  
  // 获取索引对应的 BR
  const getBrByIndex = useCallback((index: number) => BATTLE_RATINGS[index], []);

  // 检查某个 BR 是否被选中
  const isBrSelected = useCallback((br: number) => {
    return br >= brRange[0] && br <= brRange[1];
  }, [brRange]);

  // 检查某个 BR 是否在拖动预览范围内
  const isInDragPreview = useCallback((brIndex: number) => {
    if (dragStart === null || dragEnd === null) return false;
    const min = Math.min(dragStart, dragEnd);
    const max = Math.max(dragStart, dragEnd);
    return brIndex >= min && brIndex <= max;
  }, [dragStart, dragEnd]);

  // 处理鼠标按下
  const handleMouseDown = useCallback((index: number) => {
    setIsDragging(true);
    setDragStart(index);
    setDragEnd(index);
    hasDragged.current = false;
  }, []);

  // 处理鼠标进入
  const handleMouseEnter = useCallback((index: number) => {
    if (isDragging && dragStart !== null) {
      setDragEnd(index);
      if (index !== dragStart) {
        hasDragged.current = true;
      }
    }
  }, [isDragging, dragStart]);

  // 处理鼠标松开
  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    if (dragStart !== null && dragEnd !== null) {
      const startBr = getBrByIndex(dragStart);
      const endBr = getBrByIndex(dragEnd);
      
      if (hasDragged.current) {
        // 拖动选择 - 应用范围
        const newRange: [number, number] = [
          Math.min(startBr, endBr),
          Math.max(startBr, endBr)
        ];
        onBrRangeChange(newRange);
      } else {
        // 点击操作
        const clickedBr = startBr;
        if (brRange[0] === brRange[1] && brRange[0] === clickedBr) {
          // 点击已选中的单个 BR -> 全选
          onBrRangeChange([1.0, 12.7]);
        } else if (brRange[0] === 1.0 && brRange[1] === 12.7) {
          // 全选状态下点击 -> 单选该 BR
          onBrRangeChange([clickedBr, clickedBr]);
        } else {
          // 其他情况 -> 单选该 BR
          onBrRangeChange([clickedBr, clickedBr]);
        }
      }
    }
    
    setDragStart(null);
    setDragEnd(null);
    hasDragged.current = false;
  }, [isDragging, dragStart, dragEnd, brRange, onBrRangeChange, getBrByIndex]);

  // 全局鼠标松开监听
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, handleMouseUp]);

  // 全选/重置
  const handleReset = useCallback(() => {
    onBrRangeChange([1.0, 12.7]);
  }, [onBrRangeChange]);

  const isAllSelected = brRange[0] === 1.0 && brRange[1] === 12.7;
  const rangeText = isAllSelected ? '全部' : `${brRange[0].toFixed(1)} - ${brRange[1].toFixed(1)}`;

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ color: '#171717', fontWeight: 600 }}>
          权重范围: {rangeText}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: '#16a34a',
            cursor: 'pointer',
            '&:hover': { textDecoration: 'underline' },
          }}
          onClick={handleReset}
        >
          重置
        </Typography>
      </Box>
      
      {/* BR 网格 */}
      <Box
        ref={containerRef}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(36, minmax(22px, 1fr))',
          gap: 0.25,
          userSelect: 'none',
        }}
      >
        {BATTLE_RATINGS.map((br, index) => {
          const selected = isBrSelected(br);
          const inPreview = isInDragPreview(index);
          const isPreviewActive = isDragging && inPreview;
          
          return (
            <Box
              key={br}
              onMouseDown={() => handleMouseDown(index)}
              onMouseEnter={() => handleMouseEnter(index)}
              sx={{
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid',
                borderColor: isPreviewActive 
                  ? '#16a34a' 
                  : selected 
                    ? '#16a34a' 
                    : '#e5e5e5',
                borderRadius: 0.375,
                backgroundColor: isPreviewActive
                  ? 'rgba(22, 163, 74, 0.3)'
                  : selected
                    ? 'rgba(22, 163, 74, 0.1)'
                    : '#ffffff',
                color: selected || isPreviewActive ? '#16a34a' : '#525252',
                fontSize: '0.6rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.08s ease',
                transform: isDragging && dragStart === index ? 'scale(0.96)' : 'scale(1)',
                overflow: 'hidden',
                '&:hover': {
                  backgroundColor: isPreviewActive || selected
                    ? undefined
                    : '#f5f5f5',
                },
              }}
            >
              {br.toFixed(1)}
            </Box>
          );
        })}
      </Box>
      
      {/* 提示文字 */}
      <Typography
        variant="caption"
        sx={{
          color: '#737373',
          mt: 1,
          display: 'block',
          fontSize: '0.75rem',
        }}
      >
        点击单选 · 拖动多选 · 点击已选中项全选
      </Typography>
    </Box>
  );
}
