import { Box, Typography, Paper, Divider, Chip, Tooltip } from '@mui/material';
import {
  GpsFixed,
  SwapVert,
  SyncAlt,
  RotateRight,
  FlashOn,
  Adjust,
} from '@mui/icons-material';
import type { Vehicle, Ammunition } from '../types';
import { sortAmmunitionByPriority } from '../utils/ammoUtils';

/** Generate Lanz-Odermatt calculator URL from ammo data */
function generateLOUrl(ammo: Ammunition, vehicleName: string): string | null {
  if (!ammo.lanzOdermatt) return null;
  const lo = ammo.lanzOdermatt;
  const params = new URLSearchParams({
    wl: lo.workingLength.toString(),
    density: lo.density.toString(),
    caliber: ammo.caliber.toString(),
    mass: ammo.mass.toString(),
    cx: (lo.Cx || 0).toString(),
    velocity: (ammo.muzzleVelocity / 1000).toFixed(3),
    gamePen: (ammo.penetration0m ?? 0).toString(),
    vehicle: vehicleName,
    ammo: ammo.localizedName ?? ammo.name,
  });
  return `/lo-calculator?${params.toString()}`;
}

/** Generate de Marre calculator URL from ammo data */
function generateDeMarreUrl(ammo: Ammunition, vehicleName: string): string | null {
  if (!ammo.deMarre) return null;
  const dm = ammo.deMarre;
  const p: Record<string, string> = {
    caliber: dm.fullCaliber.toString(),
    mass: ammo.mass.toString(),
    velocity: ammo.muzzleVelocity.toString(),
    explosive: dm.explosiveMass.toString(),
    apcbc: dm.isApcbc ? '1' : '0',
    cx: (dm.Cx || 0.3).toString(),
    gamePen: (ammo.penetration0m ?? 0).toString(),
    vehicle: vehicleName,
    ammo: ammo.localizedName ?? ammo.name,
  };
  if (dm.isApcr) {
    p.apcr = '1';
    if (dm.coreCaliber) p.coreCaliber = dm.coreCaliber.toString();
    if (dm.coreMass) p.coreMass = dm.coreMass.toString();
  }
  return `/demarre-calculator?${new URLSearchParams(p).toString()}`;
}

/** Ammo type display names (keyed by raw bulletType from datamine) */
const AMMO_TYPE_LABELS: Record<string, string> = {
  // ── APFSDS family ──
  apds_fs_tank: 'APFSDS',
  apds_fs_long_tank: 'APFSDS',
  apds_fs_long_l30_tank: 'APFSDS',
  apds_fs_tungsten_l10_l15_tank: 'APFSDS',
  apds_fs_tungsten_l10_l15_tank_navy: 'APFSDS',
  apds_fs_tungsten_l10_l15_navy: 'APFSDS',
  apds_fs_tungsten_caliber_fins_tank: 'APFSDS',
  apds_fs_tungsten_small_core_tank: 'APFSDS',
  apds_fs_full_body_steel_tank: 'APFSDS',
  // ── APDS family ──
  apds_early_tank: 'APDS',
  apds_tank: 'APDS',
  apds_l15_tank: 'APDS',
  apds_autocannon: 'APDS',
  // ── AP / APC / APCBC / APBC ──
  ap_tank: 'AP',
  ap_t: 'AP-T',
  ap_i: 'AP-I',
  ap_i_t: 'AP-I-T',
  ap_ball: 'AP',
  ap_ball_M2: 'AP',
  ap_i_ball: 'AP-I',
  ap_i_ball_M8: 'AP-I',
  ap_i_t_ball: 'AP-I-T',
  ap_i_t_ball_M20: 'AP-I-T',
  ap_t_ball: 'AP-T',
  apc_tank: 'APC',
  apc_t: 'APC-T',
  apc_solid_medium_caliber_tank: 'APC',
  apbc_tank: 'APBC',
  apbc_usa_tank: 'APBC',
  apcbc_tank: 'APCBC',
  apcbc_solid_medium_caliber_tank: 'APCBC',
  sapcbc_tank: 'SAP',
  // ── APCR ──
  apcr_tank: 'APCR',
  apcr_t: 'APCR-T',
  // ── APHE family ──
  aphe: 'APHE',
  aphe_tank: 'APHE',
  aphebc_tank: 'APHEBC',
  // ── HEAT family ──
  heat_tank: 'HEAT',
  heat_fs_tank: 'HEAT-FS',
  heat_grenade_tank: 'HEAT',
  heat_mp_vt_tank: 'HEAT-MP-VT',
  // ── HE family ──
  he_frag_tank: 'HE',
  he_frag_fs_tank: 'HE-FS',
  he_frag_radio_fuse: 'HE-VT',
  he_frag_dist_fuse: 'HE-TF',
  he_frag_i_t: 'HE-I-T',
  he_grenade_tank: 'HE',
  he_i_t: 'HE-I-T',
  he_or_tank: 'HE-OR',
  he_tf: 'HE-TF',
  // ── HESH ──
  hesh_tank: 'HESH',
  // ── Missiles ──
  atgm_tank: 'ATGM',
  atgm_tandem_tank: 'ATGM',
  atgm_ke_tank: 'ATGM-KE',
  sam_tank: 'SAM',
  rocket_tank: '火箭弹',
  // ── Autocannon / SPAAG ──
  ac_shell_tank: 'AC',
  ahead: 'AHEAD',
  ahead_tank: 'AHEAD',
  frag_i_t: 'FRAG-I-T',
  sapi: 'SAPI',
  sap_hei_tank: 'SAP-HEI',
  // ── Machine gun / small caliber ──
  ball: 'Ball',
  i_t_ball: 'I-T',
  he_ball: 'HE',
  he_dp: 'HE-DP',
  he_frag_vog: 'HE-FRAG',
  he_i_mine: 'HE-I',
  // ── Utility ──
  smoke_tank: '烟雾弹',
  shrapnel_tank: '榴霰弹',
  practice_tank: '训练弹',
  napalm_tank: '凝固汽油弹',
};

/**
 * Ammo type → color category.
 */
const AMMO_TYPE_COLORS: Record<string, string> = {
  // APFSDS – red
  apds_fs_tank: '#dc2626',
  apds_fs_long_tank: '#dc2626',
  apds_fs_long_l30_tank: '#dc2626',
  apds_fs_tungsten_l10_l15_tank: '#dc2626',
  apds_fs_tungsten_l10_l15_tank_navy: '#dc2626',
  apds_fs_tungsten_l10_l15_navy: '#dc2626',
  apds_fs_tungsten_caliber_fins_tank: '#dc2626',
  apds_fs_tungsten_small_core_tank: '#dc2626',
  apds_fs_full_body_steel_tank: '#dc2626',
  // APDS – purple
  apds_early_tank: '#7c3aed',
  apds_tank: '#7c3aed',
  apds_l15_tank: '#7c3aed',
  apds_autocannon: '#7c3aed',
  // AP/APC/APCBC/APBC – blue
  ap_tank: '#3b82f6',
  ap_t: '#3b82f6',
  ap_i: '#3b82f6',
  ap_i_t: '#3b82f6',
  ap_ball: '#3b82f6',
  ap_ball_M2: '#3b82f6',
  ap_i_ball: '#3b82f6',
  ap_i_ball_M8: '#3b82f6',
  ap_i_t_ball: '#3b82f6',
  ap_i_t_ball_M20: '#3b82f6',
  ap_t_ball: '#3b82f6',
  apc_tank: '#2563eb',
  apc_t: '#2563eb',
  apc_solid_medium_caliber_tank: '#2563eb',
  apbc_tank: '#2563eb',
  apbc_usa_tank: '#2563eb',
  apcbc_tank: '#2563eb',
  apcbc_solid_medium_caliber_tank: '#2563eb',
  sapcbc_tank: '#2563eb',
  // APCR – violet
  apcr_tank: '#7c3aed',
  apcr_t: '#7c3aed',
  // APHE – indigo
  aphe: '#4f46e5',
  aphe_tank: '#4f46e5',
  aphebc_tank: '#4f46e5',
  // HEAT – amber
  heat_tank: '#d97706',
  heat_fs_tank: '#d97706',
  heat_grenade_tank: '#d97706',
  heat_mp_vt_tank: '#d97706',
  // HE – green
  he_frag_tank: '#16a34a',
  he_frag_fs_tank: '#16a34a',
  he_frag_radio_fuse: '#16a34a',
  he_frag_dist_fuse: '#16a34a',
  he_frag_i_t: '#16a34a',
  he_grenade_tank: '#16a34a',
  he_i_t: '#16a34a',
  he_or_tank: '#16a34a',
  he_tf: '#16a34a',
  // HESH – teal
  hesh_tank: '#059669',
  // Missiles – rose
  atgm_tank: '#e11d48',
  atgm_tandem_tank: '#e11d48',
  atgm_ke_tank: '#e11d48',
  sam_tank: '#be123c',
  rocket_tank: '#e11d48',
  // Autocannon / SPAAG – orange
  ac_shell_tank: '#ea580c',
  ahead: '#ea580c',
  ahead_tank: '#ea580c',
  frag_i_t: '#ea580c',
  sapi: '#ea580c',
  sap_hei_tank: '#ea580c',
  // Machine gun / small caliber – slate
  ball: '#64748b',
  i_t_ball: '#64748b',
  he_ball: '#16a34a',
  he_dp: '#16a34a',
  he_frag_vog: '#16a34a',
  he_i_mine: '#16a34a',
  // Utility – gray
  smoke_tank: '#6b7280',
  shrapnel_tank: '#6b7280',
  practice_tank: '#9ca3af',
  napalm_tank: '#ea580c',
};

/** Stabilizer type labels */
const STABILIZER_LABELS: Record<string, string> = {
  both: '双向稳定器',
  horizontal: '水平稳定器',
  vertical: '垂直稳定器',
  none: '无',
};

const STABILIZER_COLORS: Record<string, string> = {
  both: '#16a34a',
  horizontal: '#d97706',
  vertical: '#d97706',
  none: '#9ca3af',
};

/** Format weapon name for display */
function formatWeaponName(raw: string): string {
  return raw
    .replace(/^(\d+)_(\d+)mm/, '$1.$2mm')
    .replace(/_/g, ' ')
    .trim();
}

/** Guidance type labels */
const GUIDANCE_LABELS: Record<string, string> = {
  optical: '光电制导',
  laser: '激光制导',
  ir: '红外制导',
  saclos: 'SACLOS',
  wire: '线导',
  radio: '无线电制导',
  radar: '雷达制导',
  inertial: '惯性制导',
};

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
      py: 0.75,
      px: 1.5,
      borderRadius: 1,
      transition: 'background-color 0.15s',
      '&:hover': { backgroundColor: 'rgba(0,0,0,0.02)' },
    }}>
      <Box sx={{ color: '#737373', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {icon}
      </Box>
      <Typography sx={{ color: '#525252', fontSize: '0.85rem', minWidth: 70, flexShrink: 0 }}>
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

/** Ammo table row */
function AmmoRow({ ammo, vehicleName, onNavigate }: { ammo: Ammunition; vehicleName?: string; onNavigate?: (url: string) => void }) {
  const typeLabel = AMMO_TYPE_LABELS[ammo.type] ?? ammo.type;
  const typeColor = AMMO_TYPE_COLORS[ammo.type] ?? '#6b7280';
  const pen = ammo.penetration0m;
  const tnt = ammo.tntEquivalent;

  // Determine calculator link
  const calcUrl = vehicleName
    ? (generateLOUrl(ammo, vehicleName) ?? generateDeMarreUrl(ammo, vehicleName))
    : null;
  const calcLabel = ammo.lanzOdermatt ? 'L-O' : ammo.deMarre ? 'de Marre' : null;
  const calcColor = ammo.lanzOdermatt ? '#16a34a' : '#2563eb';

  const handlePenClick = () => {
    if (calcUrl && onNavigate) onNavigate(calcUrl);
  };

  return (
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
      <Chip
        label={typeLabel}
        size="small"
        sx={{
          height: 20,
          fontSize: '0.6rem',
          fontWeight: 700,
          minWidth: 56,
          backgroundColor: `${typeColor}15`,
          color: typeColor,
        }}
      />
      <Typography sx={{
        fontSize: '0.8rem',
        fontWeight: 500,
        color: '#171717',
        flex: 1,
        minWidth: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {ammo.localizedName ?? ammo.name}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
        {pen != null && pen > 0 ? (
          <Tooltip title={calcLabel ? `穿深 @ 0m / 0° (${calcLabel}) — 点击打开计算器` : `穿深 @ 0m / 0°`} arrow>
            <Box
              onClick={calcUrl ? handlePenClick : undefined}
              sx={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 0.3,
                backgroundColor: `${typeColor}10`,
                borderRadius: 1,
                px: 0.75,
                py: 0.2,
                ...(calcUrl ? {
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': {
                    backgroundColor: `${typeColor}20`,
                    boxShadow: `0 0 0 1px ${typeColor}40`,
                  },
                } : {}),
              }}
            >
              <Typography sx={{ color: typeColor, fontWeight: 700, fontSize: '0.8rem', fontFamily: 'monospace' }}>
                {Math.round(pen)}
              </Typography>
              <Typography sx={{ color: '#9ca3af', fontSize: '0.6rem' }}>mm</Typography>
              {calcLabel && (
                <Typography sx={{
                  color: calcColor,
                  fontSize: '0.5rem',
                  fontWeight: 600,
                  ml: 0.3,
                  opacity: 0.7,
                }}>
                  {calcLabel}
                </Typography>
              )}
            </Box>
          </Tooltip>
        ) : tnt != null && tnt > 0 ? (
          <Tooltip title="TNT 当量" arrow>
            <Box sx={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 0.3,
              backgroundColor: `${typeColor}10`,
              borderRadius: 1,
              px: 0.75,
              py: 0.2,
            }}>
              <Typography sx={{ color: typeColor, fontWeight: 700, fontSize: '0.8rem', fontFamily: 'monospace' }}>
                {tnt >= 1 ? tnt.toFixed(2) : (tnt * 1000).toFixed(0)}
              </Typography>
              <Typography sx={{ color: '#9ca3af', fontSize: '0.6rem' }}>{tnt >= 1 ? 'kg' : 'g'} TNT</Typography>
            </Box>
          </Tooltip>
        ) : null}
        {ammo.muzzleVelocity > 0 && (
          <Tooltip title="炮口初速" arrow>
            <Typography sx={{ color: '#9ca3af', fontSize: '0.7rem', fontFamily: 'monospace', minWidth: 45, textAlign: 'right' }}>
              {Math.round(ammo.muzzleVelocity)}m/s
            </Typography>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

interface ArmamentsSectionProps {
  performance: Vehicle['performance'];
  vehicleName?: string;
  onNavigate?: (url: string) => void;
}

export default function ArmamentsSection({ performance: perf, vehicleName, onNavigate }: ArmamentsSectionProps) {
  const mainGun = perf.mainGun;
  const ammunitions = perf.ammunitions;
  const hasSecondary = perf.secondaryWeapons && perf.secondaryWeapons.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* ═══════ Main Gun Card ═══════ */}
      {mainGun && (
        <Paper
          elevation={0}
          sx={{
            border: '1px solid #e5e5e5',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Header: gun name + caliber + ammo count */}
          <Box sx={{
            px: 2,
            py: 1.25,
            backgroundColor: '#fafafa',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}>
            <Adjust sx={{ color: '#dc2626', fontSize: 20 }} />
            <Typography sx={{ fontWeight: 600, color: '#171717', fontSize: '0.95rem', flex: 1 }}>
              {formatWeaponName(mainGun.name)}
            </Typography>
            {perf.mainGunAmmo && perf.mainGunAmmo > 0 && (
              <ValueChip value={`${perf.mainGunAmmo}`} suffix="发" color="#525252" />
            )}
          </Box>

          <Box sx={{ px: 0.5, py: 0.5 }}>
            {/* Reload info: only base → ace */}
            <InfoRow
              icon={<RotateRight sx={{ fontSize: 18 }} />}
              label="装填"
              tooltip={perf.autoLoader ? '自动装弹机（所有乘员等级相同）' : '手动装填（受乘员技能影响）'}
            >
              {perf.autoLoader && (
                <Chip
                  label="自动装弹"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    backgroundColor: 'rgba(22,163,106,0.1)',
                    color: '#16a34a',
                  }}
                />
              )}
              {mainGun.reloadTimes && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Tooltip title="白板乘员" arrow>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ color: '#a3a3a3', fontSize: '0.55rem' }}>白板</Typography>
                      <Typography sx={{ color: '#737373', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 600 }}>
                        {mainGun.reloadTimes.base.toFixed(1)}s
                      </Typography>
                    </Box>
                  </Tooltip>
                  <Typography sx={{ color: '#d4d4d4', alignSelf: 'center' }}>→</Typography>
                  <Tooltip title="王牌乘员" arrow>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ color: '#a3a3a3', fontSize: '0.55rem' }}>王牌</Typography>
                      <Typography sx={{ color: '#d97706', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700 }}>
                        {mainGun.reloadTimes.ace.toFixed(1)}s
                      </Typography>
                    </Box>
                  </Tooltip>
                </Box>
              )}
            </InfoRow>

            {/* Rate of fire for autocannons */}
            {mainGun.rateOfFire && mainGun.rateOfFire > 0 && (
              <InfoRow
                icon={<FlashOn sx={{ fontSize: 18 }} />}
                label="射速"
              >
                <ValueChip
                  value={`${mainGun.rateOfFire}`}
                  suffix="发/分"
                  color="#d97706"
                  bgColor="rgba(217,119,6,0.08)"
                />
              </InfoRow>
            )}

            {/* Turret traverse */}
            <InfoRow
              icon={<SyncAlt sx={{ fontSize: 18 }} />}
              label="方向机"
              tooltip="炮塔水平旋转速度 / 射界范围"
            >
              <ValueChip
                value={perf.traverseSpeed > 0 ? perf.traverseSpeed.toFixed(1) : '-'}
                suffix="°/s"
                color="#2563eb"
                bgColor="rgba(37,99,235,0.08)"
              />
              {perf.traverseRange[1] > perf.traverseRange[0] && (
                <Typography sx={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                  {perf.traverseRange[0] === -180 && perf.traverseRange[1] === 180
                    ? '360° 全向'
                    : `${perf.traverseRange[0]}° ~ ${perf.traverseRange[1]}°`}
                </Typography>
              )}
            </InfoRow>

            {/* Elevation */}
            <InfoRow
              icon={<SwapVert sx={{ fontSize: 18 }} />}
              label="高低机"
              tooltip="火炮俯仰速度 / 俯仰范围"
            >
              <ValueChip
                value={perf.elevationSpeed > 0 ? perf.elevationSpeed.toFixed(1) : '-'}
                suffix="°/s"
                color="#2563eb"
                bgColor="rgba(37,99,235,0.08)"
              />
              {perf.elevationRange[1] > perf.elevationRange[0] && (
                <Typography sx={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                  {perf.elevationRange[0]}° ~ +{perf.elevationRange[1]}°
                </Typography>
              )}
            </InfoRow>

            {/* Stabilizer */}
            <InfoRow
              icon={<GpsFixed sx={{ fontSize: 18 }} />}
              label="稳定器"
            >
              <Chip
                label={STABILIZER_LABELS[perf.stabilizerType] ?? perf.stabilizerType}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor: `${STABILIZER_COLORS[perf.stabilizerType] ?? '#9ca3af'}15`,
                  color: STABILIZER_COLORS[perf.stabilizerType] ?? '#9ca3af',
                }}
              />
            </InfoRow>

            {/* Ammunition list */}
            {ammunitions && ammunitions.length > 0 && (
              <>
                <Divider sx={{ mx: 1, my: 0.5 }} />
                <Box sx={{ px: 1, pb: 0.5 }}>
                  <Typography sx={{ color: '#737373', fontSize: '0.75rem', fontWeight: 500, mb: 0.25, px: 0.5 }}>
                    可用弹药
                  </Typography>
                  {sortAmmunitionByPriority(ammunitions).map((ammo, i) => (
                    <AmmoRow key={`${ammo.name}-${i}`} ammo={ammo} vehicleName={vehicleName} onNavigate={onNavigate} />
                  ))}
                </Box>
              </>
            )}
          </Box>
        </Paper>
      )}

      {/* ═══════ Secondary Weapon Cards ═══════ */}
      {hasSecondary && (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 1.5,
        }}>
      {perf.secondaryWeapons!.map((w, i) => {
        const isRich = !!(w.penetration || w.maxDistance || w.guidanceType);
        const typeLabel = w.bulletType ? (AMMO_TYPE_LABELS[w.bulletType] ?? w.bulletType) : '';
        const typeColor = w.bulletType ? (AMMO_TYPE_COLORS[w.bulletType] ?? '#737373') : '#737373';
        const headerColor = isRich ? typeColor : '#737373';

        return (
          <Paper
            key={`sec-${w.name}-${i}`}
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
              <GpsFixed sx={{ color: headerColor, fontSize: 20 }} />
              <Typography sx={{ fontWeight: 600, color: '#171717', fontSize: '0.95rem', flex: 1 }}>
                {formatWeaponName(w.name)}
              </Typography>
              {w.ammo > 0 && (
                <ValueChip value={`${w.ammo.toLocaleString()}`} suffix="发" color="#525252" />
              )}
            </Box>

            {/* Details — show only if we have meaningful data */}
            {(isRich || (w.rateOfFire && w.rateOfFire > 0)) && (
              <Box sx={{ px: 0.5, py: 0.5 }}>
                {/* Type + Guidance + Penetration row */}
                {(typeLabel || w.penetration || w.guidanceType) && (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 0.75,
                    px: 1.5,
                  }}>
                    {typeLabel && (
                      <Chip
                        label={typeLabel}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          backgroundColor: `${typeColor}15`,
                          color: typeColor,
                        }}
                      />
                    )}
                    {w.guidanceType && (
                      <Chip
                        label={GUIDANCE_LABELS[w.guidanceType] ?? w.guidanceType}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.6rem',
                          fontWeight: 600,
                          backgroundColor: 'rgba(107,114,128,0.1)',
                          color: '#6b7280',
                        }}
                      />
                    )}
                    <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
                      {w.penetration && w.penetration > 0 && (
                        <Tooltip title="穿深" arrow>
                          <Box>
                            <ValueChip
                              value={`${w.penetration}`}
                              suffix="mm"
                              color={typeColor}
                              bgColor={`${typeColor}10`}
                            />
                          </Box>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                )}

                {/* Range + Speed row (missiles/rockets only, when no guidance to merge) */}
                {(w.maxDistance || w.maxSpeed) && (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 0.5,
                    px: 1.5,
                  }}>
                    <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
                      {w.maxDistance && w.maxDistance > 0 && (
                        <ValueChip
                          value={w.maxDistance >= 1000 ? `${(w.maxDistance / 1000).toFixed(1)}` : `${w.maxDistance}`}
                          suffix={w.maxDistance >= 1000 ? 'km' : 'm'}
                          color="#525252"
                        />
                      )}
                      {w.maxSpeed && w.maxSpeed > 0 && (
                        <ValueChip value={`${w.maxSpeed}`} suffix="m/s" color="#737373" />
                      )}
                    </Box>
                  </Box>
                )}

                {/* Rate of fire (machine guns / autocannons) */}
                {w.rateOfFire && w.rateOfFire > 0 && !isRich && (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 0.5,
                    px: 1.5,
                  }}>
                    <FlashOn sx={{ fontSize: 16, color: '#9ca3af' }} />
                    <Typography sx={{ color: '#737373', fontSize: '0.8rem' }}>射速</Typography>
                    <Box sx={{ ml: 'auto' }}>
                      <ValueChip value={`${w.rateOfFire}`} suffix="发/分" color="#737373" />
                    </Box>
                  </Box>
                )}

                {/* Reload time (missiles) */}
                {isRich && w.reloadTime && w.reloadTime > 0 && (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 0.5,
                    px: 1.5,
                  }}>
                    <RotateRight sx={{ fontSize: 16, color: '#9ca3af' }} />
                    <Typography sx={{ color: '#737373', fontSize: '0.8rem' }}>装填</Typography>
                    <Box sx={{ ml: 'auto' }}>
                      <ValueChip value={`${w.reloadTime}`} suffix="s" color="#d97706" bgColor="rgba(217,119,6,0.08)" />
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        );
      })}
        </Box>
      )}
    </Box>
  );
}
