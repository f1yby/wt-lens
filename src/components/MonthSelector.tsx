import { useState, useMemo } from 'react';
import { Box, Typography, Popover } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import type { StatsMonthId, StatsMonthConfig } from '../types';
import { getStatsMonthConfig } from '../types';
import { getStatsMonthsReversed } from '../utils/statsMonth';

interface MonthSelectorProps {
  currentMonth: StatsMonthId;
  onMonthChange: (month: StatsMonthId) => void;
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

/**
 * Month selector as a popup grid.
 * Shows a trigger button with current month, click to open a popover with month grid.
 */
export default function MonthSelector({
  currentMonth,
  onMonthChange,
}: MonthSelectorProps) {
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
