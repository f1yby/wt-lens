import { Box, Typography } from '@mui/material';
import { RotateRight } from '@mui/icons-material';

/** Color constants - white with shadow works on all backgrounds */
const COLOR_HAS_VALUE = '#ffffff';
const COLOR_NO_VALUE = 'rgba(255,255,255,0.4)';

export interface ReloadTimeStatItemProps {
  reloadTime: number;
  mainGun?: {
    autoLoader?: boolean;
    reloadTimes?: { base: number; expert: number; ace: number };
    rateOfFire?: number;
    beltReloadTime?: number;
  } | null;
}

/**
 * Reload time stat item with auto-loader indicator and crew skill levels.
 * Handles both traditional cannons and autocannons.
 */
export function ReloadTimeStatItem({ reloadTime, mainGun }: ReloadTimeStatItemProps) {
  const isAutoLoader = mainGun?.autoLoader ?? false;
  const reloadTimes = mainGun?.reloadTimes;
  const rateOfFire = mainGun?.rateOfFire;
  const beltReloadTime = mainGun?.beltReloadTime;
  const isAutocannon = rateOfFire != null && rateOfFire > 0;
  const hasData = reloadTime > 0;
  const color = hasData ? COLOR_HAS_VALUE : COLOR_NO_VALUE;

  // Format reload time display
  const formatTime = (t: number) => t.toFixed(1) + 's';

  // Generate sub-label for traditional cannons
  let subLabel = '';
  if (hasData && !isAutocannon) {
    if (isAutoLoader) {
      subLabel = '自动装填';
    } else if (reloadTimes) {
      subLabel = `${formatTime(reloadTimes.base)} → ${formatTime(reloadTimes.ace)}`;
    }
  }

  const subTextSx = {
    color: 'rgba(255,255,255,0.85)',
    fontSize: { xs: '0.55rem', sm: '0.6rem', md: '0.65rem' },
    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  } as const;

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.25,
      py: { xs: 0.75, sm: 1 },
    }}>
      <RotateRight sx={{ color, fontSize: { xs: 18, sm: 20, md: 22 }, mb: 0.25 }} />
      <Typography sx={{
        color,
        fontWeight: 700,
        fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1rem' },
        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
        lineHeight: 1.2,
      }}>
        {hasData ? formatTime(reloadTime) : '-'}
      </Typography>
      {isAutocannon ? (
        <>
          {/* Autocannon: show belt reload time range + rate of fire */}
          {reloadTimes && beltReloadTime != null && (
            <Typography sx={subTextSx}>
              {formatTime(reloadTimes.base)} → {formatTime(reloadTimes.ace)} 换弹链
            </Typography>
          )}
          <Typography sx={subTextSx}>
            射速 {rateOfFire} 发/分
          </Typography>
        </>
      ) : (
        <>
          {/* Traditional cannon: auto-loader or crew skill range */}
          {subLabel && (
            <Typography sx={{
              ...subTextSx,
              color: isAutoLoader ? '#4ade80' : 'rgba(255,255,255,0.85)',
            }}>
              {subLabel}
            </Typography>
          )}
        </>
      )}
      <Typography sx={{
        color: 'rgba(255,255,255,0.85)',
        fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.7rem' },
        fontWeight: 500,
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}>
        装填时间
      </Typography>
    </Box>
  );
}

export default ReloadTimeStatItem;
