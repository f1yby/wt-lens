import {
  Box,
  Typography,
  ToggleButton,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { NATIONS, BATTLE_RATINGS, type Nation } from '../types';

/** Type option for the filter */
export interface TypeOption<T extends string = string> {
  value: T | 'all';
  label: string;
}

interface VehicleFilterProps<T extends string = string> {
  selectedNations: Nation[];
  onNationsChange: (nations: Nation[]) => void;
  brRange: [number, number];
  onBrRangeChange: (range: [number, number]) => void;
  selectedType: T | 'all';
  onTypeChange: (type: T | 'all') => void;
  showUnreleased: boolean;
  onShowUnreleasedChange: (show: boolean) => void;
  /** Custom type options. Defaults to ground vehicle types. */
  typeOptions?: TypeOption<T>[];
  /** Show ground combined BR toggle */
  showGroundBRToggle?: boolean;
  /** Ground combined BR state */
  useGroundBR?: boolean;
  /** Ground combined BR toggle callback */
  onUseGroundBRChange?: (value: boolean) => void;
  /** Extra controls to render in the first row (e.g., month selector) */
  extraControls?: ReactNode;
}

const GROUND_VEHICLE_TYPES: TypeOption[] = [
  { value: 'all', label: '全部' },
  { value: 'light_tank', label: '轻坦' },
  { value: 'medium_tank', label: '中坦' },
  { value: 'heavy_tank', label: '重坦' },
  { value: 'tank_destroyer', label: '坦歼' },
  { value: 'spaa', label: '防空' },
];

export default function VehicleFilter<T extends string = string>({
  selectedNations,
  onNationsChange,
  brRange,
  onBrRangeChange,
  selectedType,
  onTypeChange,
  showUnreleased,
  onShowUnreleasedChange,
  typeOptions,
  showGroundBRToggle = false,
  useGroundBR = false,
  onUseGroundBRChange,
  extraControls,
}: VehicleFilterProps<T>) {
  const types = (typeOptions ?? GROUND_VEHICLE_TYPES) as TypeOption<T>[];

  const handleNationClick = (nationId: Nation) => {
    // 未选择任何国家时 -> 单选该国家
    if (selectedNations.length === 0) {
      onNationsChange([nationId]);
      return;
    }
    
    // 已选择该国家且是唯一选择 -> 全选（清空选择）
    if (selectedNations.length === 1 && selectedNations[0] === nationId) {
      onNationsChange([]);
      return;
    }
    
    // 已选择该国家但不是唯一选择 -> 取消选择
    if (selectedNations.includes(nationId)) {
      onNationsChange(selectedNations.filter(n => n !== nationId));
      return;
    }
    
    // 未选择该国家 -> 添加到选择
    onNationsChange([...selectedNations, nationId]);
  };

  return (
    <Box sx={{ mb: 2 }}>
      {/* 第一行：国家 + 载具类型 + 未实装开关 */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <ToggleButton
          value="all"
          selected={selectedNations.length === 0}
          onChange={() => onNationsChange([])}
          size="small"
          sx={{
            px: 1.5,
            py: 0.25,
            height: 30,
            borderRadius: 1,
            border: '1px solid #d4d4d4',
            backgroundColor: selectedNations.length === 0 ? 'rgba(22, 163, 74, 0.1)' : '#ffffff',
            color: selectedNations.length === 0 ? '#16a34a' : '#525252',
            textTransform: 'none',
            fontSize: '0.8rem',
            '&:hover': {
              backgroundColor: selectedNations.length === 0 ? 'rgba(22, 163, 74, 0.2)' : '#f5f5f5',
            },
          }}
        >
          全部
        </ToggleButton>
        {NATIONS.map(nation => {
          const isSelected = selectedNations.includes(nation.id);
          return (
            <ToggleButton
              key={nation.id}
              value={nation.id}
              selected={isSelected}
              onChange={() => handleNationClick(nation.id)}
              size="small"
              sx={{
                minWidth: 0,
                width: 44,
                height: 30,
                borderRadius: 1,
                border: isSelected ? '2px solid #16a34a' : '1px solid #d4d4d4',
                backgroundImage: `url(${nation.flagImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                textTransform: 'none',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: '#16a34a',
                },
                '&.Mui-selected': {
                  border: '2px solid #16a34a',
                },
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? 'rgba(22, 163, 74, 0.15)' : 'rgba(0, 0, 0, 0.35)',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: isSelected ? 'rgba(22, 163, 74, 0.1)' : 'rgba(0, 0, 0, 0.25)',
                  },
                }}
              >
                <Typography
                  sx={{
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                  }}
                >
                  {nation.nameZh}
                </Typography>
              </Box>
            </ToggleButton>
          );
        })}

        <Box sx={{ width: '1px', height: 24, backgroundColor: '#e5e5e5', mx: 0.5 }} />

        {types.length > 0 && (
          <>
            {types.map(type => (
              <ToggleButton
                key={type.value}
                value={type.value}
                selected={selectedType === type.value}
                onChange={() => onTypeChange(type.value)}
                size="small"
                sx={{
                  px: 1.5,
                  py: 0.25,
                  height: 30,
                  borderRadius: 1,
                  border: '1px solid #d4d4d4',
                  backgroundColor: selectedType === type.value ? 'rgba(37, 99, 235, 0.1)' : '#ffffff',
                  color: selectedType === type.value ? '#2563eb' : '#525252',
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  '&:hover': {
                    backgroundColor: selectedType === type.value ? 'rgba(37, 99, 235, 0.2)' : '#f5f5f5',
                  },
                }}
              >
                {type.label}
              </ToggleButton>
            ))}

            <Box sx={{ width: '1px', height: 24, backgroundColor: '#e5e5e5', mx: 0.5 }} />
          </>
        )}

        <FormControlLabel
          control={
            <Switch
              checked={showUnreleased}
              onChange={(e) => onShowUnreleasedChange(e.target.checked)}
              size="small"
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#f97316' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#f97316' },
              }}
            />
          }
          label={
            <Typography sx={{ color: '#525252', fontSize: '0.8rem' }}>
              未实装
            </Typography>
          }
          sx={{ m: 0 }}
        />

        {showGroundBRToggle && (
          <>
            <Box sx={{ width: '1px', height: 24, backgroundColor: '#e5e5e5', mx: 0.5 }} />
            <FormControlLabel
              control={
                <Switch
                  checked={useGroundBR}
                  onChange={(_, checked) => onUseGroundBRChange?.(checked)}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#16a34a' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#16a34a' },
                  }}
                />
              }
              label={
                <Typography sx={{ color: useGroundBR ? '#16a34a' : '#525252', fontSize: '0.8rem', fontWeight: useGroundBR ? 600 : 400 }}>
                  联合作战 BR
                </Typography>
              }
              sx={{ m: 0 }}
            />
          </>
        )}

        {extraControls && (
          <>
            <Box sx={{ width: '1px', height: 24, backgroundColor: '#e5e5e5', mx: 0.5 }} />
            {extraControls}
          </>
        )}
      </Box>

      {/* 第二行：BR 网格 */}
      <BRGridSelector brRange={brRange} onBrRangeChange={onBrRangeChange} />
    </Box>
  );
}

// BR 网格选择器组件
export interface BRGridSelectorProps {
  brRange: [number, number];
  onBrRangeChange: (range: [number, number]) => void;
}

export function BRGridSelector({ brRange, onBrRangeChange }: BRGridSelectorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasDragged = useRef(false);

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
    <Box sx={{ mb: 1 }}>
      <Box
        ref={containerRef}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.25,
          userSelect: 'none',
          alignItems: 'center',
        }}
      >
        <Typography
          sx={{
            color: '#737373',
            fontSize: '0.7rem',
            fontWeight: 500,
            mr: 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          BR {rangeText}
        </Typography>
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
                height: 26,
                minWidth: 36,
                px: 0.5,
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
                fontSize: '0.65rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.08s ease',
                transform: isDragging && dragStart === index ? 'scale(0.96)' : 'scale(1)',
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
      
      {!isAllSelected && (
        <Typography
          component="span"
          onClick={handleReset}
          sx={{
            color: '#16a34a',
            fontSize: '0.7rem',
            cursor: 'pointer',
            ml: 0.5,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          重置
        </Typography>
      )}
    </Box>
  );
}
