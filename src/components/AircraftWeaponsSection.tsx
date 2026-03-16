/**
 * Aircraft Weapons Section - displays fixed weapons and payloads
 * Styled to match ArmamentsSection for ground vehicles
 */
import { Box, Typography, Paper, Chip, Collapse, Tooltip } from '@mui/material';
import { Adjust, Build, ExpandMore, ExpandLess } from '@mui/icons-material';
import { useState } from 'react';
import type { AircraftWeapons, AircraftBulletData } from '../types';

interface AircraftWeaponsSectionProps {
  weapons: AircraftWeapons;
}

/** Value chip matching ArmamentsSection style */
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

/** Info row for weapon stats */
function InfoRow({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.3 }}>
      <Typography sx={{ color: '#737373', fontSize: '0.8rem' }}>{label}</Typography>
      <ValueChip value={value} suffix={suffix} />
    </Box>
  );
}

/** Format bullet type to readable name */
function formatBulletType(type: string): string {
  const typeMap: Record<string, string> = {
    't_ball': 'T',        // Tracer
    'ball': 'Ball',       // Ball
    'i_ball': 'I',        // Incendiary
    'ap_ball': 'AP',      // Armor Piercing
    'i_t_ball': 'I-T',    // Incendiary Tracer
    'ap_i': 'AP-I',       // Armor Piercing Incendiary
    'he': 'HE',           // High Explosive
    'he_t': 'HE-T',       // HE Tracer
    'fi': 'FI',           // Fragmentation Incendiary
    'aphe': 'APHE',       // AP High Explosive
    'hvap': 'HVAP',       // High Velocity AP
    'apcr': 'APCR',       // AP Composite Rigid
    'apds': 'APDS',       // AP Discarding Sabot
    'mineng': 'Mineng',   // Mine shell
  };
  return typeMap[type] || type.replace(/_/g, '-').toUpperCase();
}

/** Belt item showing bullet sequence */
function BeltItem({ belt }: { belt: { key: string; name: string; bullets: string[]; bulletsData?: AircraftBulletData[] } }) {
  const [expanded, setExpanded] = useState(false);

  if (!belt.bullets || belt.bullets.length === 0) {
    return (
      <Chip
        label={belt.name}
        size="small"
        sx={{
          height: 24,
          fontSize: '0.75rem',
          fontWeight: 500,
          backgroundColor: 'rgba(22, 163, 74, 0.1)',
          color: '#16a34a',
        }}
      />
    );
  }

  return (
    <Box>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          '&:hover': { opacity: 0.8 },
        }}
      >
        <Chip
          label={belt.name}
          size="small"
          sx={{
            height: 24,
            fontSize: '0.75rem',
            fontWeight: 500,
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
            color: '#16a34a',
          }}
        />
        <Typography sx={{ color: '#9ca3af', fontSize: '0.7rem' }}>
          ({belt.bullets.length}发)
        </Typography>
        {expanded ? (
          <ExpandLess sx={{ fontSize: 16, color: '#9ca3af' }} />
        ) : (
          <ExpandMore sx={{ fontSize: 16, color: '#9ca3af' }} />
        )}
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          {/* Bullet sequence chips */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {belt.bullets.map((bullet, idx) => (
              <Typography
                key={idx}
                sx={{
                  fontSize: '0.7rem',
                  fontFamily: 'monospace',
                  color: '#525252',
                  backgroundColor: '#fff',
                  px: 0.5,
                  py: 0.25,
                  borderRadius: 0.5,
                  border: '1px solid #e5e5e5',
                }}
              >
                {formatBulletType(bullet)}
              </Typography>
            ))}
          </Box>
          
          {/* Detailed bullet data table */}
          {belt.bulletsData && belt.bulletsData.length > 0 && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 0.5,
              backgroundColor: '#fff',
              borderRadius: 1,
              p: 1,
              border: '1px solid #e5e5e5',
            }}>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'minmax(60px, auto) repeat(5, minmax(50px, 1fr))',
                gap: 0.5,
                fontSize: '0.65rem',
                color: '#737373',
                borderBottom: '1px solid #f0f0f0',
                pb: 0.5,
                mb: 0.5,
              }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 600 }}>类型</Typography>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, textAlign: 'right' }}>质量</Typography>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, textAlign: 'right' }}>初速</Typography>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, textAlign: 'right' }}>穿深</Typography>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, textAlign: 'right' }}>装药</Typography>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, textAlign: 'right' }}>起火</Typography>
              </Box>
              {belt.bulletsData.map((bullet, idx) => (
                <BulletDataRow key={idx} bullet={bullet} index={idx} />
              ))}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

/** Single bullet data row */
function BulletDataRow({ bullet, index }: { bullet: AircraftBulletData; index: number }) {
  const displayName = bullet.localizedName || formatBulletType(bullet.type);
  
  return (
    <Box sx={{ 
      display: 'grid', 
      gridTemplateColumns: 'minmax(60px, auto) repeat(5, minmax(50px, 1fr))',
      gap: 0.5,
      alignItems: 'center',
      backgroundColor: index % 2 === 0 ? '#fafafa' : 'transparent',
      borderRadius: 0.5,
      px: 0.5,
      py: 0.25,
    }}>
      <Tooltip title={bullet.type} arrow placement="top">
        <Typography sx={{ 
          fontSize: '0.7rem', 
          fontWeight: 500, 
          color: '#374151',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {displayName}
        </Typography>
      </Tooltip>
      
      <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', textAlign: 'right', color: '#525252' }}>
        {bullet.mass ? `${(bullet.mass * 1000).toFixed(1)}` : '-'}
      </Typography>
      
      <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', textAlign: 'right', color: '#525252' }}>
        {bullet.speed ? `${bullet.speed}` : '-'}
      </Typography>
      
      <Tooltip 
        title={bullet.penetration ? `穿深: ${bullet.penetration}mm @ 0m` : '无穿深数据'} 
        arrow 
        placement="top"
      >
        <Typography sx={{ 
          fontSize: '0.7rem', 
          fontFamily: 'monospace', 
          textAlign: 'right', 
          color: bullet.penetration ? '#059669' : '#9ca3af',
          fontWeight: bullet.penetration ? 600 : 400,
        }}>
          {bullet.penetration ? `${bullet.penetration}` : '-'}
        </Typography>
      </Tooltip>
      
      <Tooltip 
        title={bullet.tntEquivalent ? `${bullet.tntEquivalent * 1000}g TNT当量 (${bullet.explosiveType || 'TNT'})` : '无装药'} 
        arrow 
        placement="top"
      >
        <Typography sx={{ 
          fontSize: '0.7rem', 
          fontFamily: 'monospace', 
          textAlign: 'right', 
          color: bullet.explosiveMass ? '#dc2626' : '#9ca3af',
          fontWeight: bullet.explosiveMass ? 600 : 400,
        }}>
          {bullet.explosiveMass ? `${(bullet.explosiveMass * 1000).toFixed(1)}` : '-'}
        </Typography>
      </Tooltip>
      
      <Typography sx={{ 
        fontSize: '0.7rem', 
        fontFamily: 'monospace', 
        textAlign: 'right', 
        color: bullet.fireChance ? '#f59e0b' : '#9ca3af',
        fontWeight: bullet.fireChance ? 600 : 400,
      }}>
        {bullet.fireChance ? `×${bullet.fireChance}` : '-'}
      </Typography>
    </Box>
  );
}

export default function AircraftWeaponsSection({ weapons }: AircraftWeaponsSectionProps) {
  const fixedWeapons = weapons.fixed_weapons ?? [];
  const payloads = weapons.payloads ?? [];

  if (!fixedWeapons.length && !payloads.length) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
      {/* Fixed Weapons Cards */}
      {fixedWeapons.map((w, i) => (
        <Paper
          key={`fixed-${w.name}-${i}`}
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
            py: 1.25,
            backgroundColor: '#fafafa',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}>
            <Adjust sx={{ color: '#16a34a', fontSize: 20 }} />
            <Typography sx={{ fontWeight: 600, color: '#171717', fontSize: '0.95rem', flex: 1 }}>
              {w.localizedName || w.name}
            </Typography>
            {w.count > 1 && (
              <Chip
                label={`×${w.count}`}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(37,99,235,0.1)',
                  color: '#2563eb',
                  minWidth: 32,
                }}
              />
            )}
          </Box>

          {/* Stats */}
          <Box sx={{ px: 2, py: 1 }}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <InfoRow label="口径" value={w.caliber ? `${w.caliber}` : '-'} suffix="mm" />
              <InfoRow label="弹药" value={w.bullets.toLocaleString()} suffix="发" />
              <InfoRow label="射速" value={w.fireRate ? w.fireRate.toLocaleString() : '-'} suffix="发/分" />
            </Box>

            {/* Belts */}
            {w.belts && w.belts.length > 0 && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #e5e5e5' }}>
                <Typography sx={{ color: '#737373', fontSize: '0.75rem', fontWeight: 500, mb: 1 }}>
                  可用弹链:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {w.belts.map((belt) => (
                    <BeltItem key={belt.key} belt={belt} />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Paper>
      ))}

      {/* Payload Cards */}
      {payloads.map((p, i) => (
        <Paper
          key={`payload-${p.name}-${i}`}
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
            py: 1.25,
            backgroundColor: '#fafafa',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}>
            <Build sx={{ color: '#16a34a', fontSize: 20 }} />
            <Typography sx={{ fontWeight: 600, color: '#171717', fontSize: '0.95rem' }}>
              {p.name}
            </Typography>
          </Box>

          {/* Weapons list */}
          <Box sx={{ px: 1, py: 1 }}>
            {p.weapons.map((w, j) => (
              <Box
                key={`${w.name}-${j}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.5,
                  px: 1.5,
                  borderRadius: 1,
                  transition: 'background-color 0.15s',
                  '&:hover': { backgroundColor: 'rgba(0,0,0,0.02)' },
                }}
              >
                <Typography sx={{
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: '#171717',
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {w.localizedName || w.name}
                </Typography>
                <ValueChip value={`${w.count}`} suffix="个" color="#525252" />
              </Box>
            ))}
          </Box>
        </Paper>
      ))}
    </Box>
  );
}
