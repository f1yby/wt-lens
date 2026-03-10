import { useState } from 'react';
import { Box, Typography, Paper, Divider, Chip, Tooltip, Collapse } from '@mui/material';
import {
  Speed,
  DirectionsCar,
  LocalGasStation,
  FitnessCenter,
  People,
  Autorenew,
  ExpandMore,
} from '@mui/icons-material';
import type { Vehicle } from '../types';

/** Engine type display names */
const ENGINE_TYPE_LABELS: Record<string, string> = {
  gasturbine: '燃气轮机',
  carburetor: '汽油机',
  diesel: '柴油机',
  electric: '电动机',
};

/** Steer type display names */
const STEER_TYPE_LABELS: Record<string, string> = {
  clutch_braking: '离合制动',
  differential: '差速转向',
  fixed_differential: '固定差速',
  differential_steering: '差速转向',
};

/** Transmission type display names */
const TRANS_TYPE_LABELS: Record<string, string> = {
  auto: '自动',
  manual: '手动',
  hydrostatic: '液力',
  hydraulic: '液力',
};

/** Format model name: replace underscores with spaces and title-case */
function formatModelName(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

/** A single row in the section */
function InfoRow({
  icon,
  label,
  children,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  tooltip?: string;
}) {
  const content = (
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

  return tooltip ? (
    <Tooltip title={tooltip} arrow placement="left">
      {content}
    </Tooltip>
  ) : content;
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

interface MobilitySectionProps {
  performance: Vehicle['performance'];
}

export default function MobilitySection({ performance: perf }: MobilitySectionProps) {
  const hasEngineInfo = perf.engineManufacturer || perf.engineModel || perf.engineType;
  const hasTransInfo = perf.transmissionManufacturer || perf.transmissionModel;
  const hasGearSpeeds = !!(perf.forwardGearSpeeds || perf.reverseGearSpeeds);
  const [gearsOpen, setGearsOpen] = useState(false);

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
        <Speed sx={{ color: '#3b82f6', fontSize: 20 }} />
        <Typography sx={{ fontWeight: 600, color: '#171717', fontSize: '0.95rem' }}>
          机动性
        </Typography>
      </Box>

      <Box sx={{ px: 0.5, py: 0.5 }}>
        {/* Speed + Transmission (clickable to toggle gear details) */}
        <Box
          onClick={hasGearSpeeds ? () => setGearsOpen((v) => !v) : undefined}
          sx={{
            cursor: hasGearSpeeds ? 'pointer' : 'default',
            userSelect: 'none',
            borderRadius: 1,
            transition: 'background-color 0.15s',
            '&:hover': hasGearSpeeds ? { backgroundColor: 'rgba(0,0,0,0.03)' } : {},
          }}
        >
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            py: 1,
            px: 1.5,
          }}>
            <Box sx={{ color: '#737373', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <DirectionsCar sx={{ fontSize: 18 }} />
            </Box>
            <Typography sx={{ color: '#525252', fontSize: '0.85rem', minWidth: 90, flexShrink: 0 }}>
              最高速度
            </Typography>
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <ValueChip
                value={perf.maxSpeed > 0 ? `${Math.round(perf.maxSpeed)}` : '-'}
                suffix="km/h 前进"
                color="#16a34a"
                bgColor="rgba(22,163,106,0.08)"
              />
              <ValueChip
                value={perf.maxReverseSpeed > 0 ? `${Math.round(perf.maxReverseSpeed)}` : '-'}
                suffix="km/h 倒退"
                color="#dc2626"
                bgColor="rgba(220,38,38,0.08)"
              />
              {hasGearSpeeds && (
                <ExpandMore sx={{
                  fontSize: 18,
                  color: '#a3a3a3',
                  transition: 'transform 0.2s',
                  transform: gearsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }} />
              )}
            </Box>
          </Box>
        </Box>

        {/* Per-gear speed table (collapsible) */}
        <Collapse in={gearsOpen} timeout={200}>
          {hasGearSpeeds && (
            <Box sx={{ px: 1.5, pb: 0.75, pt: 0.25 }}>
              {/* Transmission info header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 4, mb: 0.5 }}>
                {perf.transmissionType && (
                  <Chip
                    label={TRANS_TYPE_LABELS[perf.transmissionType] ?? perf.transmissionType}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(107,114,128,0.1)',
                      color: '#9ca3af',
                    }}
                  />
                )}
                {hasTransInfo && (
                  <Typography sx={{ color: '#a3a3a3', fontSize: '0.7rem' }}>
                    {[
                      perf.transmissionManufacturer ? formatModelName(perf.transmissionManufacturer) : '',
                      perf.transmissionModel ? formatModelName(perf.transmissionModel) : '',
                    ].filter(Boolean).join(' ')}
                  </Typography>
                )}
              </Box>
              {/* Gear speed chips */}
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', pl: 4 }}>
                {[...(perf.forwardGearSpeeds ?? [])].reverse().map((speed, i, arr) => {
                  const gearNum = arr.length - i; // descending gear number
                  return (
                    <Box
                      key={`fwd-${gearNum}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 0.25,
                        backgroundColor: i === 0
                          ? 'rgba(22,163,106,0.08)'
                          : 'rgba(0,0,0,0.03)',
                        borderRadius: 0.75,
                        px: 0.75,
                        py: 0.2,
                      }}
                    >
                      <Typography sx={{
                        color: '#a3a3a3',
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        lineHeight: 1,
                      }}>
                        {gearNum}
                      </Typography>
                      <Typography sx={{
                        color: i === 0 ? '#16a34a' : '#525252',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        lineHeight: 1,
                      }}>
                        {speed}
                      </Typography>
                    </Box>
                  );
                })}
                {[...(perf.reverseGearSpeeds ?? [])].map((speed, i) => (
                  <Box
                    key={`rev-${i}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 0.25,
                      backgroundColor: 'rgba(220,38,38,0.06)',
                      borderRadius: 0.75,
                      px: 0.75,
                      py: 0.2,
                    }}
                  >
                    <Typography sx={{
                      color: '#a3a3a3',
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      lineHeight: 1,
                    }}>
                      R{perf.reverseGearSpeeds!.length > 1 ? i + 1 : ''}
                    </Typography>
                    <Typography sx={{
                      color: '#dc2626',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      lineHeight: 1,
                    }}>
                      {speed}
                    </Typography>
                  </Box>
                ))}
                <Typography sx={{ color: '#a3a3a3', fontSize: '0.6rem', alignSelf: 'center' }}>
                  km/h
                </Typography>
              </Box>
            </Box>
          )}
        </Collapse>

        {/* Weight */}
        <InfoRow
          icon={<FitnessCenter sx={{ fontSize: 18 }} />}
          label="重量"
          tooltip="战斗全重 / 空车重量"
        >
          <ValueChip
            value={perf.weight > 0 ? perf.weight.toFixed(1) : '-'}
            suffix="t 战斗全重"
          />
          {perf.emptyWeight && perf.emptyWeight > 0 && (
            <ValueChip
              value={perf.emptyWeight.toFixed(1)}
              suffix="t 空重"
              color="#737373"
            />
          )}
        </InfoRow>

        {/* Power-to-weight */}
        <InfoRow
          icon={<Speed sx={{ fontSize: 18 }} />}
          label="功重比"
          tooltip="发动机马力 / 战斗全重"
        >
          <ValueChip
            value={perf.powerToWeight > 0 ? perf.powerToWeight.toFixed(1) : '-'}
            suffix="hp/t"
            color="#2563eb"
            bgColor="rgba(37,99,235,0.08)"
          />
        </InfoRow>

        {/* Crew */}
        <InfoRow
          icon={<People sx={{ fontSize: 18 }} />}
          label="乘员"
        >
          <ValueChip value={perf.crewCount > 0 ? `${perf.crewCount}` : '-'} suffix="人" />
        </InfoRow>

        <Divider sx={{ mx: 1 }} />

        {/* Engine */}
        <InfoRow
          icon={<LocalGasStation sx={{ fontSize: 18 }} />}
          label="发动机"
          tooltip={hasEngineInfo
            ? `${formatModelName(perf.engineManufacturer ?? '')} ${formatModelName(perf.engineModel ?? '')}`
            : undefined}
        >
          {perf.engineType && (
            <Chip
              label={ENGINE_TYPE_LABELS[perf.engineType] ?? perf.engineType}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 600,
                backgroundColor: 'rgba(59,130,246,0.1)',
                color: '#3b82f6',
              }}
            />
          )}
          <ValueChip
            value={perf.horsepower > 0 ? `${Math.round(perf.horsepower)}` : '-'}
            suffix="hp"
            color="#d97706"
            bgColor="rgba(217,119,6,0.08)"
          />
          {perf.engineMaxRpm && perf.engineMaxRpm > 0 && (
            <ValueChip
              value={`${Math.round(perf.engineMaxRpm)}`}
              suffix="rpm"
              color="#737373"
            />
          )}
        </InfoRow>

        {hasEngineInfo && (
          <Box sx={{ px: 1.5, pb: 0.5 }}>
            <Typography sx={{ color: '#9ca3af', fontSize: '0.75rem', pl: 4 }}>
              {[
                perf.engineManufacturer ? formatModelName(perf.engineManufacturer) : '',
                perf.engineModel ? formatModelName(perf.engineModel) : '',
              ].filter(Boolean).join(' ')}
            </Typography>
          </Box>
        )}

        {/* Steer type */}
        {perf.steerType && (
          <InfoRow
            icon={<Autorenew sx={{ fontSize: 18 }} />}
            label="转向方式"
          >
            <Chip
              label={STEER_TYPE_LABELS[perf.steerType] ?? perf.steerType}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 600,
                backgroundColor: 'rgba(0,0,0,0.04)',
                color: '#525252',
              }}
            />
          </InfoRow>
        )}
      </Box>
    </Paper>
  );
}
