import { Box, Typography, Paper, Chip } from '@mui/material';
import {
  Visibility,
  Check,
  Close,
  CenterFocusStrong,
  NightsStay,
} from '@mui/icons-material';
import type { Vehicle } from '../types';

/** Thermal generation guess from resolution */
function getThermalGen(resolution: [number, number] | undefined | null): string | null {
  if (!resolution || resolution[0] <= 0) return null;
  const diag = Math.sqrt(resolution[0] ** 2 + resolution[1] ** 2);
  if (diag >= 1200) return '三代';
  if (diag >= 800) return '二代';
  return '一代';
}

/** A single row in the section */
function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      py: 1,
      px: 1.5,
      borderRadius: 1,
      transition: 'background-color 0.15s',
      '&:hover': { backgroundColor: 'rgba(0,0,0,0.02)' },
    }}>
      <Box sx={{ color: '#737373', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {icon}
      </Box>
      <Typography sx={{ color: '#525252', fontSize: '0.85rem', minWidth: 90, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {children}
      </Box>
    </Box>
  );
}

/** Value chip */
function ValueChip({
  value,
  suffix,
  color = '#171717',
  bgColor = 'rgba(0,0,0,0.04)',
}: {
  value: string;
  suffix?: string;
  color?: string;
  bgColor?: string;
}) {
  return (
    <Box sx={{
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: 0.3,
      backgroundColor: bgColor,
      borderRadius: 1,
      px: 1,
      py: 0.25,
    }}>
      <Typography sx={{ color, fontWeight: 600, fontSize: '0.85rem', fontFamily: 'monospace' }}>
        {value}
      </Typography>
      {suffix && (
        <Typography sx={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 500 }}>
          {suffix}
        </Typography>
      )}
    </Box>
  );
}

/** Boolean feature chip (✓ / ✗) */
function FeatureChip({
  hasFeature,
  label,
}: {
  hasFeature: boolean;
  label: string;
}) {
  return (
    <Chip
      icon={hasFeature ? <Check sx={{ fontSize: 14 }} /> : <Close sx={{ fontSize: 14 }} />}
      label={label}
      size="small"
      sx={{
        height: 24,
        fontSize: '0.7rem',
        fontWeight: 600,
        backgroundColor: hasFeature ? 'rgba(22,163,106,0.08)' : 'rgba(0,0,0,0.04)',
        color: hasFeature ? '#16a34a' : '#a3a3a3',
        '& .MuiChip-icon': {
          color: hasFeature ? '#16a34a' : '#a3a3a3',
        },
      }}
    />
  );
}

interface OpticsSectionProps {
  performance: Vehicle['performance'];
}

export default function OpticsSection({ performance: perf }: OpticsSectionProps) {
  const gunnerThermalRes = perf.gunnerThermalResolution;
  const commanderThermalRes = perf.commanderThermalResolution;
  const driverNv = perf.driverNvResolution;

  const hasGunnerThermal = gunnerThermalRes && gunnerThermalRes[0] > 0;
  const hasCommanderThermal = commanderThermalRes && commanderThermalRes[0] > 0;
  const hasDriverNv = driverNv && driverNv[0] > 0;

  const gunnerGen = getThermalGen(gunnerThermalRes);
  const commanderGen = getThermalGen(commanderThermalRes);

  // Fallback: detect smoke grenades from secondary weapons if flag is missing
  const hasSmokeGrenades = (perf.hasSmokeGrenades ?? false)
    || (perf.secondaryWeapons?.some(w => w.name.toLowerCase().includes('smoke_grenade')) ?? false);

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid #e5e5e5',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 2,
        py: 1.5,
        backgroundColor: '#fafafa',
        borderBottom: '1px solid #e5e5e5',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}>
        <Visibility sx={{ color: '#7c3aed', fontSize: 20 }} />
        <Typography sx={{ fontWeight: 600, color: '#171717', fontSize: '0.95rem' }}>
          光学与防护设备
        </Typography>
      </Box>

      <Box sx={{ px: 0.5, py: 0.5 }}>
        {/* Gunner Thermal */}
        <InfoRow
          icon={<CenterFocusStrong sx={{ fontSize: 18 }} />}
          label="炮手热成像"
        >
          {hasGunnerThermal ? (
            <>
              {gunnerGen && (
                <Chip
                  label={gunnerGen}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    backgroundColor: 'rgba(124,58,237,0.1)',
                    color: '#7c3aed',
                  }}
                />
              )}
              <ValueChip
                value={`${gunnerThermalRes[0]}×${gunnerThermalRes[1]}`}
                suffix="px"
                color="#7c3aed"
                bgColor="rgba(124,58,237,0.08)"
              />
            </>
          ) : (
            <Typography sx={{ color: '#a3a3a3', fontSize: '0.85rem' }}>无</Typography>
          )}
        </InfoRow>

        {/* Commander Thermal */}
        <InfoRow
          icon={<CenterFocusStrong sx={{ fontSize: 18 }} />}
          label="车长热成像"
        >
          {hasCommanderThermal ? (
            <>
              {commanderGen && (
                <Chip
                  label={commanderGen}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    backgroundColor: 'rgba(124,58,237,0.1)',
                    color: '#7c3aed',
                  }}
                />
              )}
              <ValueChip
                value={`${commanderThermalRes[0]}×${commanderThermalRes[1]}`}
                suffix="px"
                color="#7c3aed"
                bgColor="rgba(124,58,237,0.08)"
              />
            </>
          ) : (
            <Typography sx={{ color: '#a3a3a3', fontSize: '0.85rem' }}>无</Typography>
          )}
        </InfoRow>

        {/* Driver Night Vision */}
        <InfoRow
          icon={<NightsStay sx={{ fontSize: 18 }} />}
          label="驾驶员夜视"
        >
          {hasDriverNv ? (
            <ValueChip
              value={`${driverNv[0]}×${driverNv[1]}`}
              suffix="px"
              color="#525252"
            />
          ) : (
            <Typography sx={{ color: '#a3a3a3', fontSize: '0.85rem' }}>无</Typography>
          )}
        </InfoRow>

        {/* Feature chips row */}
        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          px: 1.5,
          py: 1.5,
        }}>
          <FeatureChip
            hasFeature={perf.hasLaserRangefinder ?? false}
            label="激光测距仪"
          />
          <FeatureChip
            hasFeature={hasSmokeGrenades}
            label="烟雾弹"
          />
          <FeatureChip
            hasFeature={perf.hasEss ?? false}
            label="发动机烟幕"
          />
        </Box>
      </Box>
    </Paper>
  );
}
