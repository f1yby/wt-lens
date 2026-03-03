import { Box, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';

/** Color constants - white with shadow works on all backgrounds */
const COLOR_HAS_VALUE = '#ffffff';
const COLOR_NO_VALUE = 'rgba(255,255,255,0.4)';

/** Check if value represents "no data" */
function hasNoValue(value: string | number): boolean {
  return value === '-' || value === '0' || value === '0.0' || value === '0s' || value === '';
}

export interface StatItemProps {
  icon: SvgIconComponent;
  value: string | number;
  subValue?: string;
  label: string;
}

/**
 * Unified stat item for the performance grid.
 * Displays an icon, primary value, optional sub-value, and label.
 */
export function StatItem({ icon: Icon, value, subValue, label }: StatItemProps) {
  const isEmpty = hasNoValue(value);
  const color = isEmpty ? COLOR_NO_VALUE : COLOR_HAS_VALUE;

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.25,
      py: { xs: 0.75, sm: 1 },
    }}>
      <Icon sx={{ color, fontSize: { xs: 18, sm: 20, md: 22 }, mb: 0.25 }} />
      <Typography sx={{
        color,
        fontWeight: 700,
        fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1rem' },
        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
        lineHeight: 1.2,
      }}>
        {value}
      </Typography>
      {subValue && (
        <Typography sx={{
          color,
          fontSize: { xs: '0.55rem', sm: '0.6rem', md: '0.65rem' },
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          lineHeight: 1,
        }}>
          {subValue}
        </Typography>
      )}
      <Typography sx={{
        color: 'rgba(255,255,255,0.85)',
        fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.7rem' },
        fontWeight: 500,
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}>
        {label}
      </Typography>
    </Box>
  );
}

export default StatItem;
