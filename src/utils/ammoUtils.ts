/**
 * Ammunition priority & sorting utilities.
 *
 * Central place for ammo-type priority so that every UI surface
 * (hero banner, ammo list, vehicle card) uses the same ordering.
 *
 * Priority is based on *player preference* — "which round would a
 * player load first?", blending penetration capability with practical
 * usefulness (post-pen damage, reliability against ERA, etc.).
 */

import type { Ammunition } from '../types';

// ═══════════════════════════════════════════════════════════════════
// 1. Priority table  (lower number = higher priority)
// ═══════════════════════════════════════════════════════════════════

/**
 * Canonical priority for every known bulletType string from the datamine.
 * Lower value = more desirable round.
 *
 * Ordering rationale
 * ──────────────────
 *  1  APFSDS        – top-tier kinetic, high pen + good angle performance
 *  2  APHE / APHEBC – "one-shot" post-pen, player favourite at low-mid tiers
 *  3  ATGM tandem   – ignores ERA, very high pen
 *  4  ATGM          – high pen, long range
 *  5  HEAT-FS       – pen unaffected by distance, common mid-tier main round
 *  6  APCBC         – ballistic-cap bonus, WWII mainstay
 *  7  APDS          – sub-caliber, cold-war transition round
 *  8  HEAT          – similar to HEAT-FS but less accurate
 *  9  APCR          – high pen on paper but awful angled performance & post-pen
 * 10  AP / APC / APBC – basic solid shot
 * 11  HESH          – niche anti-light-armor
 * 12  SAP           – semi-armor-piercing
 * 13  HE family     – anti-light / open-top
 * 14  ATGM-KE       – kinetic ATGM (rare, niche)
 * 15  SAM           – anti-air missile
 * 16  Autocannon    – SPAAG / IFV belt rounds
 * 17  Utility       – smoke, shrapnel, practice, napalm
 * 99  Unknown       – fallback
 */
const AMMO_TYPE_PRIORITY: Record<string, number> = {
  // ── 1: APFSDS ──
  apds_fs_tank: 1,
  apds_fs_long_tank: 1,
  apds_fs_long_l30_tank: 1,
  apds_fs_tungsten_l10_l15_tank: 1,
  apds_fs_tungsten_l10_l15_tank_navy: 1,
  apds_fs_tungsten_l10_l15_navy: 1,
  apds_fs_tungsten_caliber_fins_tank: 1,
  apds_fs_tungsten_small_core_tank: 1,
  apds_fs_full_body_steel_tank: 1,

  // ── 2: APHE / APHEBC ──
  aphe: 2,
  aphe_tank: 2,
  aphebc_tank: 2,
  ap_he_tank: 2,

  // ── 3: ATGM tandem ──
  atgm_tandem_tank: 3,

  // ── 4: ATGM ──
  atgm_tank: 4,

  // ── 5: HEAT-FS ──
  heat_fs_tank: 5,

  // ── 6: APCBC ──
  apcbc_tank: 6,
  apcbc_solid_medium_caliber_tank: 6,

  // ── 7: APDS ──
  apds_early_tank: 7,
  apds_tank: 7,
  apds_l15_tank: 7,
  apds_autocannon: 7,

  // ── 8: HEAT ──
  heat_tank: 8,
  heat_grenade_tank: 8,
  heat_mp_vt_tank: 8,

  // ── 9: APCR ──
  apcr_tank: 9,
  apcr_t: 9,

  // ── 10: AP / APC / APBC ──
  ap_tank: 10,
  ap_t: 10,
  ap_i: 10,
  ap_i_t: 10,
  ap_ball: 10,
  ap_ball_M2: 10,
  ap_i_ball: 10,
  ap_i_ball_M8: 10,
  ap_i_t_ball: 10,
  ap_i_t_ball_M20: 10,
  ap_t_ball: 10,
  apc_tank: 10,
  apc_t: 10,
  apc_solid_medium_caliber_tank: 10,
  apbc_tank: 10,
  apbc_usa_tank: 10,
  sapcbc_tank: 10,

  // ── 11: HESH ──
  hesh_tank: 11,

  // ── 12: SAP ──
  sap_hei_tank: 12,

  // ── 13: HE family ──
  he_frag_tank: 13,
  he_frag_fs_tank: 13,
  he_frag_radio_fuse: 13,
  he_frag_dist_fuse: 13,
  he_frag_i_t: 13,
  he_grenade_tank: 13,
  he_i_t: 13,
  he_or_tank: 13,
  he_tf: 13,
  he_ball: 13,
  he_dp: 13,
  he_frag_vog: 13,
  he_i_mine: 13,

  // ── 14: ATGM-KE ──
  atgm_ke_tank: 14,

  // ── 15: SAM ──
  sam_tank: 15,

  // ── 16: Autocannon / rockets ──
  ac_shell_tank: 16,
  ahead: 16,
  ahead_tank: 16,
  frag_i_t: 16,
  sapi: 16,
  rocket_tank: 16,

  // ── 17: Utility ──
  ball: 17,
  i_t_ball: 17,
  smoke_tank: 17,
  shrapnel_tank: 17,
  practice_tank: 17,
  napalm_tank: 17,
};

const DEFAULT_PRIORITY = 99;

/**
 * Get the display priority for a bullet type.
 * Lower = more important / more desirable.
 */
export function getAmmoPriority(bulletType: string): number {
  return AMMO_TYPE_PRIORITY[bulletType] ?? DEFAULT_PRIORITY;
}

// ═══════════════════════════════════════════════════════════════════
// 2. Sorting
// ═══════════════════════════════════════════════════════════════════

/**
 * Sort ammunition array by player-preference priority.
 * Within the same priority tier, higher penetration comes first.
 * Returns a **new** sorted array (does not mutate the input).
 */
export function sortAmmunitionByPriority(ammos: Ammunition[]): Ammunition[] {
  return [...ammos].sort((a, b) => {
    const pa = getAmmoPriority(a.type);
    const pb = getAmmoPriority(b.type);
    if (pa !== pb) return pa - pb;
    // Same tier → higher penetration first
    return (b.penetration0m ?? b.armorPower ?? 0) - (a.penetration0m ?? a.armorPower ?? 0);
  });
}

// ═══════════════════════════════════════════════════════════════════
// 3. "Best round" selection (for hero banner / vehicle card)
// ═══════════════════════════════════════════════════════════════════

/**
 * Pick the single best "representative" round from an ammo list.
 *
 * Algorithm:
 *  1. If `heroValue` is given, try to match the exact penetration first
 *     (keeps the label consistent with the displayed number).
 *  2. Otherwise, pick the round with the **highest priority** (lowest
 *     priority number). Ties broken by penetration descending.
 */
export function getBestRound(
  ammunitions: Ammunition[] | undefined,
  heroValue?: number,
): Ammunition | null {
  if (!ammunitions || ammunitions.length === 0) return null;

  // 1) Match hero value if given
  if (heroValue && heroValue > 0) {
    for (const a of ammunitions) {
      const pen = a.penetration0m ?? a.armorPower ?? 0;
      if (Math.abs(pen - heroValue) < 0.5) return a;
    }
  }

  // 2) Sort by priority then take first
  const sorted = sortAmmunitionByPriority(ammunitions);
  // Skip rounds with 0 penetration if possible
  const withPen = sorted.filter(a => (a.penetration0m ?? a.armorPower ?? 0) > 0);
  return withPen.length > 0 ? withPen[0] : sorted[0];
}
