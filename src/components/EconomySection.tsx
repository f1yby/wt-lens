import { Box, Typography, Paper, Divider, Chip, Tooltip } from '@mui/material';
import {
  Science,
  ShoppingCart,
  Build,
  Star,
  EmojiEvents,
  AttachMoney,
} from '@mui/icons-material';
import type { EconomyData, GameMode } from '../types';

/** Format number with thousands separator (e.g., 260000 → "260,000") */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Format SL (Silver Lions) value */
function formatSL(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)}M`;
  }
  return formatNumber(n);
}

/** Game mode display names */
const MODE_LABELS: Record<string, string> = {
  arcade: '街机',
  realistic: '历史',
  simulator: '全真',
};

const MODE_COLORS: Record<string, string> = {
  arcade: '#3b82f6',
  realistic: '#16a34a',
  simulator: '#dc2626',
};

interface EconomySectionProps {
  economy: EconomyData;
  gameMode?: GameMode;
}

/** A single economy stat row */
function EconRow({
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
      gap: 1,
      py: 0.5,
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

/** Value display chip */
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

export default function EconomySection({ economy, gameMode = 'historical' }: EconomySectionProps) {
  // Map gameMode to the correct key in economy data
  const modeKey = gameMode === 'historical' ? 'realistic' : gameMode;

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
        <AttachMoney sx={{ color: '#16a34a', fontSize: 20 }} />
        <Typography sx={{ fontWeight: 600, color: '#171717', fontSize: '0.95rem' }}>
          经济数据
        </Typography>
      </Box>

      <Box sx={{ px: 0.5, py: 0.5 }}>
        {/* Research & Purchase */}
        {(economy.researchCost !== undefined || economy.purchaseCost !== undefined) && (
          <>
            <EconRow
              icon={<Science sx={{ fontSize: 18 }} />}
              label="研发费用"
              tooltip="解锁该载具所需的研发经验（RP）"
            >
              {economy.researchCost !== undefined && (
                <ValueChip value={formatNumber(economy.researchCost)} suffix="RP" color="#2563eb" />
              )}
            </EconRow>

            <EconRow
              icon={<ShoppingCart sx={{ fontSize: 18 }} />}
              label="购买价格"
              tooltip="购买该载具所需的银狮或金鹰"
            >
              {economy.purchaseCost !== undefined && economy.purchaseCost > 0 && (
                <ValueChip value={formatSL(economy.purchaseCost)} suffix="SL" color="#525252" />
              )}
              {economy.purchaseCostGold !== undefined && (
                <ValueChip value={formatNumber(economy.purchaseCostGold)} suffix="GE" color="#d97706" bgColor="rgba(217,119,6,0.08)" />
              )}
            </EconRow>

            <Divider sx={{ mx: 1 }} />
          </>
        )}

        {/* Crew Training */}
        {(economy.crewTraining !== undefined || economy.expertTraining !== undefined) && (
          <>
            <EconRow
              icon={<Build sx={{ fontSize: 18 }} />}
              label="训练费"
              tooltip="基础乘员训练费用（SL）"
            >
              {economy.crewTraining !== undefined && (
                <ValueChip value={formatSL(economy.crewTraining)} suffix="SL" />
              )}
            </EconRow>

            <EconRow
              icon={<Star sx={{ fontSize: 18 }} />}
              label="专家训练"
              tooltip="专家级乘员训练费用（SL）"
            >
              {economy.expertTraining !== undefined && (
                <ValueChip value={formatSL(economy.expertTraining)} suffix="SL" />
              )}
            </EconRow>

            <EconRow
              icon={<EmojiEvents sx={{ fontSize: 18 }} />}
              label="王牌训练"
              tooltip="王牌级乘员训练费用（金鹰 / 研发经验）"
            >
              {economy.aceTrainingGE !== undefined && (
                <ValueChip value={formatNumber(economy.aceTrainingGE)} suffix="GE" color="#d97706" bgColor="rgba(217,119,6,0.08)" />
              )}
              {economy.aceTrainingRP !== undefined && (
                <ValueChip value={formatNumber(economy.aceTrainingRP)} suffix="RP" color="#2563eb" />
              )}
            </EconRow>

            <Divider sx={{ mx: 1 }} />
          </>
        )}

        {/* Repair Cost - show for selected game mode */}
        {economy.repairCost && (
          <>
            <Box sx={{ px: 1.5, pt: 0.5, pb: 0.25 }}>
              <Typography sx={{ color: '#737373', fontSize: '0.75rem', fontWeight: 500, mb: 0.25 }}>
                维修费用（银狮）
              </Typography>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 0.5,
              }}>
                {(['arcade', 'realistic', 'simulator'] as const).map((mode) => {
                  const costs = economy.repairCost?.[mode];
                  if (!costs) return null;
                  const isActive = mode === modeKey;
                  return (
                    <Box
                      key={mode}
                      sx={{
                        textAlign: 'center',
                        p: 0.75,
                        borderRadius: 1,
                        backgroundColor: isActive ? `${MODE_COLORS[mode]}10` : 'transparent',
                        border: isActive ? `1px solid ${MODE_COLORS[mode]}30` : '1px solid transparent',
                      }}
                    >
                      <Chip
                        label={MODE_LABELS[mode]}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          mb: 0.25,
                          backgroundColor: `${MODE_COLORS[mode]}15`,
                          color: MODE_COLORS[mode],
                        }}
                      />
                      <Typography sx={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#171717',
                        fontFamily: 'monospace',
                      }}>
                        {formatNumber(costs[0])}
                      </Typography>
                      {costs[0] !== costs[1] && (
                        <Typography sx={{
                          fontSize: '0.65rem',
                          color: '#9ca3af',
                        }}>
                          → {formatNumber(costs[1])}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
              <Typography sx={{ color: '#a3a3a3', fontSize: '0.65rem', mt: 0.25, textAlign: 'center' }}>
                基础 → 改满
              </Typography>
            </Box>

            <Divider sx={{ mx: 1 }} />
          </>
        )}

        {/* Reward Multipliers */}
        {economy.rewardMultiplier && (
          <Box sx={{ px: 1.5, pt: 1, pb: 1 }}>
            <Typography sx={{ color: '#737373', fontSize: '0.75rem', fontWeight: 500, mb: 0.5 }}>
              奖励倍率
            </Typography>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
            }}>
              {(['arcade', 'realistic', 'simulator'] as const).map((mode) => {
                const mul = economy.rewardMultiplier?.[mode];
                if (mul === undefined) return null;
                const isActive = mode === modeKey;
                return (
                  <Box
                    key={mode}
                    sx={{
                      textAlign: 'center',
                      p: 1,
                      borderRadius: 1,
                      backgroundColor: isActive ? `${MODE_COLORS[mode]}10` : 'transparent',
                      border: isActive ? `1px solid ${MODE_COLORS[mode]}30` : '1px solid transparent',
                    }}
                  >
                    <Chip
                      label={MODE_LABELS[mode]}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        mb: 0.5,
                        backgroundColor: `${MODE_COLORS[mode]}15`,
                        color: MODE_COLORS[mode],
                      }}
                    />
                    <Typography sx={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#171717',
                      fontFamily: 'monospace',
                    }}>
                      ×{mul.toFixed(2)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
            {economy.expMultiplier !== undefined && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
                <Tooltip title="研发经验加成倍率（RP multiplier）" arrow>
                  <Chip
                    label={`经验倍率 ×${economy.expMultiplier.toFixed(2)}`}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(37,99,235,0.08)',
                      color: '#2563eb',
                    }}
                  />
                </Tooltip>
              </Box>
            )}
          </Box>
        )}

        {/* Free Repairs */}
        {economy.freeRepairs !== undefined && economy.freeRepairs > 0 && (
          <>
            <Divider sx={{ mx: 1 }} />
            <Box sx={{ px: 1.5, py: 0.5, textAlign: 'center' }}>
              <Chip
                label={`免费维修 ${economy.freeRepairs} 次`}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(245,158,11,0.1)',
                  color: '#d97706',
                }}
              />
            </Box>
          </>
        )}
      </Box>
    </Paper>
  );
}
