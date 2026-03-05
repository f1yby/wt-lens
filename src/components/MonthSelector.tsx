import { useState, useMemo } from 'react';
import { Box, Typography, Popover } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import type { StatsMonthId, StatsMonthConfig, StatsMonthRange } from '../types';
import { getStatsMonthConfig, getMonthRangeLabel, getStatsMonthIndex } from '../types';
import { getStatsMonthsReversed } from '../utils/statsMonth';

interface MonthRangeSelectorProps {
  currentRange: StatsMonthRange;
  onRangeChange: (range: StatsMonthRange) => void;
}

/** Extract year from month id (e.g., "diff_2025_march_april" -> "2025") */
function getYearFromMonthId(monthId: string): string {
  return monthId.split('_')[1];
}

/** Group months by year */
function groupMonthsByYear(months: StatsMonthConfig[]): Map<string, StatsMonthConfig[]> {
  const groups = new Map<string, StatsMonthConfig[]>();
  for (const month of months) {
    const year = getYearFromMonthId(month.id);
    if (!groups.has(year)) {
      groups.set(year, []);
    }
    groups.get(year)!.push(month);
  }
  return groups;
}

type SelectionMode = 'start' | 'end';

/**
 * Month range selector as a popup grid.
 * Shows a trigger button with current range, click to open a popover with month grid.
 * User selects start month first, then end month.
 */
export default function MonthRangeSelector({
  currentRange,
  onRangeChange,
}: MonthRangeSelectorProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('start');
  const [pendingStart, setPendingStart] = useState<StatsMonthId | null>(null);
  const open = Boolean(anchorEl);

  const months = getStatsMonthsReversed();
  const rangeLabel = getMonthRangeLabel(currentRange);
  
  // Group months by year (maintain reverse chronological order)
  const monthsByYear = useMemo(() => groupMonthsByYear(months), [months]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setSelectionMode('start');
    setPendingStart(null);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSelectionMode('start');
    setPendingStart(null);
  };

  const handleSelect = (monthId: StatsMonthId) => {
    if (selectionMode === 'start') {
      // First click: select start month
      setPendingStart(monthId);
      setSelectionMode('end');
    } else {
      // Second click: select end month
      if (!pendingStart) return;
      
      const startIndex = getStatsMonthIndex(pendingStart);
      const endIndex = getStatsMonthIndex(monthId);
      
      // Ensure start <= end (swap if needed)
      const finalRange: StatsMonthRange = startIndex <= endIndex
        ? { startMonth: pendingStart, endMonth: monthId }
        : { startMonth: monthId, endMonth: pendingStart };
      
      onRangeChange(finalRange);
      handleClose();
    }
  };

  // Check if a month is in the selection range (for highlighting)
  const isInRange = (monthId: StatsMonthId): boolean => {
    if (selectionMode === 'start') {
      // Show current range
      const startIndex = getStatsMonthIndex(currentRange.startMonth);
      const endIndex = getStatsMonthIndex(currentRange.endMonth);
      const monthIndex = getStatsMonthIndex(monthId);
      return monthIndex >= startIndex && monthIndex <= endIndex;
    } else if (pendingStart) {
      // Show pending selection (just the start month)
      return monthId === pendingStart;
    }
    return false;
  };

  const isStartMonth = (monthId: StatsMonthId): boolean => {
    if (selectionMode === 'end' && pendingStart) {
      return monthId === pendingStart;
    }
    return monthId === currentRange.startMonth;
  };

  const isEndMonth = (monthId: StatsMonthId): boolean => {
    if (selectionMode === 'end') {
      return false; // No end selected yet
    }
    return monthId === currentRange.endMonth;
  };

  return (
    <Box sx={{ userSelect: 'none' }}>
      {/* Trigger Button */}
      <Box
        onClick={handleOpen}
        sx={{
          height: 26,
          px: 1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          border: '1px solid',
          borderColor: open ? '#16a34a' : '#e5e5e5',
          borderRadius: 0.5,
          backgroundColor: open ? 'rgba(22, 163, 74, 0.05)' : '#ffffff',
          cursor: 'pointer',
          transition: 'all 0.1s ease',
          '&:hover': {
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22, 163, 74, 0.05)',
          },
        }}
      >
        <Typography
          sx={{
            color: '#737373',
            fontSize: '0.7rem',
            fontWeight: 500,
          }}
        >
          时间
        </Typography>
        <Typography
          sx={{
            color: '#16a34a',
            fontSize: '0.7rem',
            fontWeight: 600,
          }}
        >
          {rangeLabel}
        </Typography>
        <KeyboardArrowDownIcon
          sx={{
            fontSize: '1rem',
            color: '#737373',
            transition: 'transform 0.15s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </Box>

      {/* Popover with Month Grid */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              p: 1.5,
              borderRadius: 1,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
              minWidth: 280,
            },
          },
        }}
      >
        {/* Selection Mode Hint */}
        <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: selectionMode === 'start' ? '#16a34a' : '#a3a3a3',
              fontWeight: selectionMode === 'start' ? 600 : 400,
            }}
          >
            ① 选择起始月份
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#d4d4d4' }}>→</Typography>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: selectionMode === 'end' ? '#16a34a' : '#a3a3a3',
              fontWeight: selectionMode === 'end' ? 600 : 400,
            }}
          >
            ② 选择结束月份
          </Typography>
        </Box>

        {/* Month Grid by Year */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {Array.from(monthsByYear.entries()).map(([year, yearMonths]) => (
            <Box key={year}>
              {/* Year Header */}
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: '#a3a3a3',
                  mb: 0.75,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {year}年
              </Typography>
              
              {/* Month Buttons Grid */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 0.5,
                }}
              >
                {yearMonths.map((month) => {
                  const inRange = isInRange(month.id);
                  const isStart = isStartMonth(month.id);
                  const isEnd = isEndMonth(month.id);
                  const isBoundary = isStart || isEnd;
                  
                  // Extract just the month part (e.g., "2月" from "25年2月")
                  const monthLabel = month.shortLabel.replace(/^\d+年/, '');
                  
                  return (
                    <Box
                      key={month.id}
                      onClick={() => handleSelect(month.id)}
                      sx={{
                        height: 28,
                        px: 0.75,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid',
                        borderColor: isBoundary ? '#16a34a' : inRange ? '#86efac' : '#e5e5e5',
                        borderRadius: 0.5,
                        backgroundColor: isBoundary
                          ? 'rgba(22, 163, 74, 0.15)'
                          : inRange
                            ? 'rgba(22, 163, 74, 0.05)'
                            : '#ffffff',
                        color: isBoundary ? '#16a34a' : inRange ? '#22c55e' : '#525252',
                        fontSize: '0.7rem',
                        fontWeight: isBoundary ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.08s ease',
                        whiteSpace: 'nowrap',
                        position: 'relative',
                        '&:hover': {
                          backgroundColor: isBoundary
                            ? 'rgba(22, 163, 74, 0.2)'
                            : inRange
                              ? 'rgba(22, 163, 74, 0.1)'
                              : '#f5f5f5',
                          borderColor: '#16a34a',
                        },
                      }}
                    >
                      {monthLabel}
                      {/* Start/End indicators */}
                      {isStart && !isEnd && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            backgroundColor: '#16a34a',
                          }}
                        />
                      )}
                      {isEnd && !isStart && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 2,
                            right: 2,
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            backgroundColor: '#16a34a',
                          }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Quick selection shortcuts */}
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #e5e5e5' }}>
          <Typography
            sx={{
              fontSize: '0.6rem',
              color: '#a3a3a3',
              mb: 0.75,
            }}
          >
            快捷选择
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {[
              { label: '最近1月', months: 1 },
              { label: '最近3月', months: 3 },
              { label: '最近6月', months: 6 },
              { label: '全部', months: 0 },
            ].map(({ label, months: monthCount }) => (
              <Box
                key={label}
                onClick={() => {
                  // Get chronologically ordered months (oldest first)
                  const chronologicalMonths = [...months].reverse();
                  if (monthCount === 0) {
                    // All months
                    onRangeChange({
                      startMonth: chronologicalMonths[0].id,
                      endMonth: chronologicalMonths[chronologicalMonths.length - 1].id,
                    });
                  } else {
                    // Recent N months
                    const endIdx = chronologicalMonths.length - 1;
                    const startIdx = Math.max(0, endIdx - monthCount + 1);
                    onRangeChange({
                      startMonth: chronologicalMonths[startIdx].id,
                      endMonth: chronologicalMonths[endIdx].id,
                    });
                  }
                  handleClose();
                }}
                sx={{
                  px: 1,
                  py: 0.25,
                  fontSize: '0.6rem',
                  color: '#737373',
                  backgroundColor: '#f5f5f5',
                  borderRadius: 0.5,
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                  '&:hover': {
                    backgroundColor: '#e5e5e5',
                    color: '#525252',
                  },
                }}
              >
                {label}
              </Box>
            ))}
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}

// ============================================================================
// Legacy single month selector (for backward compatibility)
// ============================================================================

interface LegacyMonthSelectorProps {
  currentMonth: StatsMonthId;
  onMonthChange: (month: StatsMonthId) => void;
}

/**
 * @deprecated Use MonthRangeSelector instead
 * Legacy month selector for backward compatibility
 */
export function LegacyMonthSelector({
  currentMonth,
  onMonthChange,
}: LegacyMonthSelectorProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const months = getStatsMonthsReversed();
  const currentMonthConfig = getStatsMonthConfig(currentMonth);
  
  // Group months by year (maintain reverse chronological order)
  const monthsByYear = useMemo(() => groupMonthsByYear(months), [months]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (monthId: StatsMonthId) => {
    onMonthChange(monthId);
    handleClose();
  };

  return (
    <Box sx={{ userSelect: 'none' }}>
      {/* Trigger Button */}
      <Box
        onClick={handleOpen}
        sx={{
          height: 26,
          px: 1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          border: '1px solid',
          borderColor: open ? '#16a34a' : '#e5e5e5',
          borderRadius: 0.5,
          backgroundColor: open ? 'rgba(22, 163, 74, 0.05)' : '#ffffff',
          cursor: 'pointer',
          transition: 'all 0.1s ease',
          '&:hover': {
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22, 163, 74, 0.05)',
          },
        }}
      >
        <Typography
          sx={{
            color: '#737373',
            fontSize: '0.7rem',
            fontWeight: 500,
          }}
        >
          月份
        </Typography>
        <Typography
          sx={{
            color: '#16a34a',
            fontSize: '0.7rem',
            fontWeight: 600,
          }}
        >
          {currentMonthConfig?.shortLabel || currentMonth}
        </Typography>
        <KeyboardArrowDownIcon
          sx={{
            fontSize: '1rem',
            color: '#737373',
            transition: 'transform 0.15s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </Box>

      {/* Popover with Month Grid */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              p: 1.5,
              borderRadius: 1,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
              minWidth: 280,
            },
          },
        }}
      >
        {/* Month Grid by Year */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {Array.from(monthsByYear.entries()).map(([year, yearMonths]) => (
            <Box key={year}>
              {/* Year Header */}
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: '#a3a3a3',
                  mb: 0.75,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {year}年
              </Typography>
              
              {/* Month Buttons Grid */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 0.5,
                }}
              >
                {yearMonths.map((month) => {
                  const isSelected = currentMonth === month.id;
                  // Extract just the month part (e.g., "2-3月" from "25年2-3月")
                  const monthLabel = month.shortLabel.replace(/^\d+年/, '');
                  
                  return (
                    <Box
                      key={month.id}
                      onClick={() => handleSelect(month.id)}
                      sx={{
                        height: 28,
                        px: 0.75,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid',
                        borderColor: isSelected ? '#16a34a' : '#e5e5e5',
                        borderRadius: 0.5,
                        backgroundColor: isSelected
                          ? 'rgba(22, 163, 74, 0.1)'
                          : '#ffffff',
                        color: isSelected ? '#16a34a' : '#525252',
                        fontSize: '0.7rem',
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.08s ease',
                        whiteSpace: 'nowrap',
                        '&:hover': {
                          backgroundColor: isSelected
                            ? 'rgba(22, 163, 74, 0.15)'
                            : '#f5f5f5',
                          borderColor: '#16a34a',
                        },
                      }}
                    >
                      {monthLabel}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>
      </Popover>
    </Box>
  );
}
