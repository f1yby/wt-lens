import { Box, Typography } from '@mui/material';
import { FlashOn } from '@mui/icons-material';
import type { Ammunition } from '../../types';

/** Color constants - white with shadow works on all backgrounds */
const COLOR_HAS_VALUE = '#ffffff';
const COLOR_NO_VALUE = 'rgba(255,255,255,0.4)';

/** Ammo type labels */
const AMMO_TYPE_LABELS: Record<string, string> = {
  'apds_fs_tank': 'APFSDS',
  'apds_fs_long_tank': '长杆APFSDS',
  'apds_fs_long_l30_tank': 'L30长杆APFSDS',
  'apds_fs_tungsten_l10_l15_tank': '钨芯APFSDS',
  'apds_fs_tungsten_l10_l15_tank_navy': '钨芯APFSDS',
  'apds_fs_tungsten_l10_l15_navy': '钨芯APFSDS',
  'apds_fs_tungsten_caliber_fins_tank': '尾翼钨芯APFSDS',
  'apds_fs_tungsten_small_core_tank': '细钨芯APFSDS',
  'apds_early_tank': '早期APDS',
  'apds_tank': 'APDS',
  'apcbc_tank': 'APCBC',
  'apcbc_solid_medium_caliber_tank': 'APCBC',
  'apcr_tank': 'APCR',
  'ap_tank': 'AP',
  'ap_he_tank': 'APHE',
  'aphe_tank': 'APHE',
  'aphebc_tank': 'APHEBC',
  'apbc_usa_tank': 'APBC',
  'apc_solid_medium_caliber_tank': 'APC',
  'heat_tank': 'HEAT',
  'heat_fs_tank': 'HEAT-FS',
  'he_frag_tank': 'HE',
  'he_frag_fs_tank': 'HE-FS',
  'he_frag_radio_fuse': 'HE-VT',
  'he_frag_dist_fuse': 'HE-TF',
  'hesh_tank': 'HESH',
  'smoke_tank': '烟雾弹',
  'atgm_tank': '反坦克导弹',
  'atgm_tandem_tank': '串联反坦克导弹',
  'sam_tank': '防空导弹',
  'sap_hei_tank': '半穿甲弹',
  'shrapnel_tank': '榴霰弹',
  'practice_tank': '训练弹',
};

interface BestKineticRoundInfo {
  type: string;
  name: string;
  penetration: number;
  isLO: boolean;
  loParams?: {
    workingLength: number;
    density: number;
    caliber: number;
    mass: number;
    velocity: number;
    Cx: number;
  };
}

/** Get the best kinetic round info from ammunitions */
function getBestKineticRound(ammunitions?: Ammunition[]): BestKineticRoundInfo | null {
  if (!ammunitions || ammunitions.length === 0) return null;

  // Find the round with the highest penetration
  let bestRound: Ammunition | null = null;
  let bestPen = 0;

  for (const a of ammunitions) {
    const pen = a.penetration0m || a.armorPower || 0;
    if (pen > bestPen) {
      bestPen = pen;
      bestRound = a;
    }
  }

  if (!bestRound) return null;

  return {
    type: AMMO_TYPE_LABELS[bestRound.type] || bestRound.type || 'Unknown',
    name: bestRound.localizedName || bestRound.name || 'Unknown',
    penetration: bestPen,
    isLO: !!bestRound.lanzOdermatt,
    loParams: bestRound.lanzOdermatt ? {
      workingLength: bestRound.lanzOdermatt.workingLength,
      density: bestRound.lanzOdermatt.density,
      caliber: bestRound.caliber,
      mass: bestRound.mass,
      velocity: bestRound.muzzleVelocity,
      Cx: bestRound.lanzOdermatt.Cx || 0,
    } : undefined,
  };
}

/** Generate Lanz-Odermatt calculator internal URL with parameters */
function generateLOCalculatorUrl(
  loParams: NonNullable<BestKineticRoundInfo['loParams']>,
  roundName: string,
  penetration: number,
  vehicleName: string
): string {
  const params = new URLSearchParams({
    wl: loParams.workingLength.toString(),
    density: loParams.density.toString(),
    caliber: loParams.caliber.toString(),
    mass: loParams.mass.toString(),
    cx: loParams.Cx.toString(),
    velocity: (loParams.velocity / 1000).toFixed(3), // m/s -> km/s
    gamePen: penetration.toString(),
    vehicle: vehicleName,
    ammo: roundName,
  });
  return `/lo-calculator?${params.toString()}`;
}

export interface PenetrationStatItemProps {
  penetration: number;
  ammunitions?: Ammunition[];
  vehicleName: string;
  onNavigate: (url: string) => void;
}

/**
 * Penetration stat item with ammo details.
 * Shows best kinetic round info and links to Lanz-Odermatt calculator.
 */
export function PenetrationStatItem({ penetration, ammunitions, vehicleName, onNavigate }: PenetrationStatItemProps) {
  const color = penetration > 0 ? COLOR_HAS_VALUE : COLOR_NO_VALUE;
  const roundInfo = getBestKineticRound(ammunitions);

  const handleLOClick = () => {
    if (roundInfo?.isLO && roundInfo.loParams) {
      const url = generateLOCalculatorUrl(roundInfo.loParams, roundInfo.name, penetration, vehicleName);
      onNavigate(url);
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.25,
      py: { xs: 0.75, sm: 1 },
    }}>
      <FlashOn sx={{ color, fontSize: { xs: 18, sm: 20, md: 22 }, mb: 0.25 }} />
      <Typography sx={{
        color,
        fontWeight: 700,
        fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1rem' },
        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
        lineHeight: 1.2,
      }}>
        {penetration > 0 ? `${penetration.toFixed(0)}mm` : '-'}
      </Typography>
      {roundInfo && (
        <>
          <Typography sx={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: { xs: '0.5rem', sm: '0.55rem', md: '0.6rem' },
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            lineHeight: 1,
            fontWeight: 500,
          }}>
            {roundInfo.type}
          </Typography>
          {roundInfo.isLO && roundInfo.loParams ? (
            <>
              <Typography sx={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: { xs: '0.5rem', sm: '0.55rem', md: '0.6rem' },
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                lineHeight: 1,
                fontWeight: 400,
              }}>
                {roundInfo.name}
              </Typography>
              <Typography
                onClick={handleLOClick}
                sx={{
                  color: '#4ade80',
                  fontSize: { xs: '0.5rem', sm: '0.55rem', md: '0.6rem' },
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  lineHeight: 1,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(74, 222, 128, 0.5)',
                  '&:hover': {
                    textDecorationColor: '#4ade80',
                  },
                }}
              >
                Lanz-Odermatt
              </Typography>
            </>
          ) : (
            <Typography sx={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: { xs: '0.5rem', sm: '0.55rem', md: '0.6rem' },
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              lineHeight: 1,
              fontWeight: 400,
            }}>
              {roundInfo.name}
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
        穿深
      </Typography>
    </Box>
  );
}

export default PenetrationStatItem;
