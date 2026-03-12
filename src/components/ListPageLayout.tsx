import { type ReactNode } from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import Navbar from './Navbar';
import VehicleFilter from './VehicleFilter';
import type { TypeOption } from './VehicleFilter';
import GameModeSelector from './GameModeSelector';
import MonthRangeSelector from './MonthSelector';
import type { GameMode, Nation, StatsMonthRange } from '../types';

export interface ListPageLayoutProps<T extends string = string> {
  // --- Filter state ---
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  selectedNations: Nation[];
  onNationsChange: (nations: Nation[]) => void;
  brRange: [number, number];
  onBrRangeChange: (range: [number, number]) => void;
  selectedType: T | 'all';
  onTypeChange: (type: T | 'all') => void;
  showUnreleased: boolean;
  onShowUnreleasedChange: (show: boolean) => void;
  showGhost: boolean;
  onShowGhostChange: (show: boolean) => void;
  availableBRs: number[];

  // --- Month range ---
  statsMonthRange: StatsMonthRange;
  onStatsMonthRangeChange: (range: StatsMonthRange) => void;

  // --- Optional: ground BR toggle (aircraft / helicopter) ---
  showGroundBRToggle?: boolean;
  useGroundBR?: boolean;
  onUseGroundBRChange?: (value: boolean) => void;

  // --- Type options (defaults to ground vehicle types) ---
  typeOptions?: TypeOption<T>[];

  // --- Display ---
  loading: boolean;
  filteredCount: number;
  countLabel: string; // e.g. "个载具", "架飞机", "艘舰船"

  // --- Content ---
  children: ReactNode;
}

export default function ListPageLayout<T extends string = string>({
  gameMode,
  onGameModeChange,
  selectedNations,
  onNationsChange,
  brRange,
  onBrRangeChange,
  selectedType,
  onTypeChange,
  showUnreleased,
  onShowUnreleasedChange,
  showGhost,
  onShowGhostChange,
  availableBRs,
  statsMonthRange,
  onStatsMonthRangeChange,
  showGroundBRToggle,
  useGroundBR,
  onUseGroundBRChange,
  typeOptions,
  loading,
  filteredCount,
  countLabel,
  children,
}: ListPageLayoutProps<T>) {
  // If the page has ground BR toggle, put MonthRangeSelector inside VehicleFilter
  // via extraControls (to keep it on the same row). Otherwise render it separately.
  const hasGroundBR = showGroundBRToggle === true;

  const monthSelector = (
    <MonthRangeSelector
      currentRange={statsMonthRange}
      onRangeChange={onStatsMonthRangeChange}
    />
  );

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Navbar />

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ pt: 12, pb: 4 }}>
        {/* Mode Selector */}
        <Box sx={{ mb: 2 }}>
          <GameModeSelector
            currentMode={gameMode}
            onModeChange={onGameModeChange}
          />
        </Box>

        <VehicleFilter
          selectedNations={selectedNations}
          onNationsChange={onNationsChange}
          brRange={brRange}
          onBrRangeChange={onBrRangeChange}
          selectedType={selectedType}
          onTypeChange={onTypeChange}
          showUnreleased={showUnreleased}
          onShowUnreleasedChange={onShowUnreleasedChange}
          showGhost={showGhost}
          onShowGhostChange={onShowGhostChange}
          typeOptions={typeOptions}
          showGroundBRToggle={showGroundBRToggle}
          useGroundBR={useGroundBR}
          onUseGroundBRChange={onUseGroundBRChange}
          availableBRs={availableBRs}
          extraControls={hasGroundBR ? monthSelector : undefined}
        />
        {!hasGroundBR && monthSelector}

        {/* Results Count */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: '#737373' }}>
            {loading ? '加载中...' : `显示 ${filteredCount} ${countLabel}`}
          </Typography>
        </Box>

        {/* Content Area */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          children
        )}
      </Container>

      {/* Footer */}
      <Box sx={{ borderTop: '1px solid #262626', py: 3, mt: 4 }}>
        <Container maxWidth="xl">
          <Typography variant="caption" sx={{ color: '#525252', textAlign: 'center', display: 'block' }}>
            数据来源: StatShark API & War Thunder Datamine | 仅供学习交流使用
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
