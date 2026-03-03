/**
 * Lanz-Odermatt penetration calculation utilities.
 * Based on Willy Odermatt's 2000 paper on long-rod penetrator performance.
 */

// ===== Lanz-Odermatt Constants =====
export const LO_CONSTANTS = {
  b0: 0.283,
  b1: 0.0656,
  m: -0.224,
  // Tungsten perforation
  a_t: 0.994,
  c0_t: 134.5,
  c1_t: -0.148,
  // Tungsten penetration (semi-infinite target)
  a_sit: 0.921,
  c0_sit: 138,
  c1_sit: -0.100,
  // DU perforation
  a_d: 0.825,
  c0_d: 90.0,
  c1_d: -0.0849,
  // Steel perforation
  a_s: 1.104,
  c0_s: 9874.0,
  k_s: 0.3598,
  n_s: -0.2342,
};

export type PenetratorMaterial = 'Tungsten' | 'DU' | 'Steel';
export type CalculationMode = 'Perforation' | 'Penetration';

export interface LOParams {
  // Penetrator
  pLen: number;      // Total length (mm)
  dia: number;       // Diameter (mm)
  fLen: number;      // Frustum length (mm)
  df: number;        // Upper frustum diameter (mm)
  rhop: number;      // Density (kg/m³)
  bhnp: number;      // Brinell hardness (penetrator, steel only)
  velocity: number;  // Impact velocity (km/s)
  // Target
  rhot: number;      // Target density (kg/m³)
  bhnt: number;      // Target Brinell hardness
  nato: number;      // NATO obliquity (°)
}

export interface LOResult {
  penetration: number;
  mode: CalculationMode;
  material: PenetratorMaterial;
  workingLength: number;
  aspectRatio: number;
  minVelocity: number;
  errors: string[];
}

/**
 * Calculate penetration using the Lanz-Odermatt equation.
 */
export function calculateLO(params: LOParams, mode: CalculationMode, material: PenetratorMaterial): LOResult {
  const errors: string[] = [];
  const LO = LO_CONSTANTS;
  const { pLen, dia, fLen, df, rhop, bhnp, velocity, rhot, bhnt, nato } = params;

  // Working length
  const lw = pLen - fLen * (1 - (1 + df / dia * (1 + df / dia)) / 3);
  const lwd = lw / dia; // Aspect ratio

  // Basic validations
  if (pLen <= 0) errors.push('弹芯总长度必须大于 0 mm');
  if (dia <= 0) errors.push('弹芯直径必须大于 0 mm');
  if (df > dia) errors.push('截锥体上底直径不能大于弹芯直径');
  if (lwd < 4) errors.push(`长径比 (${lwd.toFixed(1)}) 必须 ≥ 4`);
  if (rhot < 7700 || rhot > 8000) errors.push('靶板密度应在 7700-8000 kg/m³ 之间');
  if (mode === 'Perforation' && nato > 75) errors.push('NATO 入射角必须 ≤ 75°');

  // Aspect ratio correction
  const elwd = 1 / Math.tanh(LO.b0 + LO.b1 * lwd);

  // Obliquity correction
  const enato = Math.pow(Math.cos(nato / 180 * Math.PI), LO.m);

  // Density correction
  const edens = Math.pow(rhop / rhot, 0.5);

  const vt_s = velocity; // km/s

  let penetration = 0;
  let minVelocity = 0;

  if (material === 'Tungsten' && mode === 'Perforation') {
    if (bhnt < 150) errors.push('靶板硬度应 ≥ 150 BHN');
    if (bhnt > 500) errors.push('靶板硬度应 ≤ 500 BHN');
    if (rhop < 16500) errors.push('弹芯密度应 > 16500 kg/m³');
    if (rhop > 19300) errors.push('弹芯密度应 < 19300 kg/m³');

    const eterm5 = Math.exp(-(LO.c0_t + LO.c1_t * bhnt) * bhnt / rhop / vt_s / vt_s);
    minVelocity = Math.pow((LO.c0_t + LO.c1_t * bhnt) * bhnt / rhop / 1.5, 0.5);
    if (velocity < minVelocity) errors.push(`撞击速度低于最小侵蚀速度 (${minVelocity.toFixed(3)} km/s)`);

    if (errors.length === 0) {
      penetration = LO.a_t * lw * elwd * enato * edens * eterm5;
    }
  } else if (material === 'Tungsten' && mode === 'Penetration') {
    if (bhnt < 200) errors.push('靶板硬度应 ≥ 200 BHN');
    if (bhnt > 600) errors.push('靶板硬度应 ≤ 600 BHN');
    if (rhop < 16500) errors.push('弹芯密度应 > 16500 kg/m³');
    if (rhop > 19300) errors.push('弹芯密度应 < 19300 kg/m³');

    const eterm5 = Math.exp(-(LO.c0_sit + LO.c1_sit * bhnt) * bhnt / rhop / vt_s / vt_s);
    minVelocity = Math.pow((LO.c0_sit + LO.c1_sit * bhnt) * bhnt / rhop / 1.8, 0.5);
    if (velocity < minVelocity) errors.push(`撞击速度低于最小侵蚀速度 (${minVelocity.toFixed(3)} km/s)`);

    if (errors.length === 0) {
      penetration = LO.a_sit * lw * elwd * edens * eterm5; // No obliquity for penetration
    }
  } else if (material === 'DU' && mode === 'Perforation') {
    if (bhnt < 150) errors.push('靶板硬度应 ≥ 150 BHN');
    if (bhnt > 500) errors.push('靶板硬度应 ≤ 500 BHN');
    if (rhop < 16500) errors.push('弹芯密度应 > 16500 kg/m³');
    if (rhop > 19100) errors.push('弹芯密度应 < 19100 kg/m³');

    const eterm5 = Math.exp(-(LO.c0_d + LO.c1_d * bhnt) * bhnt / rhop / vt_s / vt_s);
    minVelocity = Math.pow((LO.c0_t + LO.c1_t * bhnt) * bhnt / rhop / 1.5, 0.5);
    if (velocity < minVelocity) errors.push(`撞击速度低于最小侵蚀速度 (${minVelocity.toFixed(3)} km/s)`);

    if (errors.length === 0) {
      penetration = LO.a_d * lw * elwd * enato * edens * eterm5;
    }
  } else if (material === 'DU' && mode === 'Penetration') {
    errors.push('半无限靶板穿透计算仅支持钨合金材质');
  } else if (material === 'Steel' && mode === 'Perforation') {
    if (bhnt < 120) errors.push('靶板硬度应 ≥ 120 BHN');
    if (bhnt > 550) errors.push('靶板硬度应 ≤ 550 BHN');
    if (bhnp < 200) errors.push('弹芯硬度应 ≥ 200 BHN');
    if (bhnp > 750) errors.push('弹芯硬度应 ≤ 750 BHN');
    if (rhop < 7700) errors.push('弹芯密度应 > 7700 kg/m³');
    if (rhop > 8500) errors.push('弹芯密度应 < 8500 kg/m³');

    const eterm5 = Math.exp(-LO.c0_s * Math.pow(bhnt, LO.k_s) * Math.pow(bhnp, LO.n_s) / rhop / vt_s / vt_s);
    minVelocity = Math.pow(LO.c0_s * Math.pow(bhnt, LO.k_s) * Math.pow(bhnp, LO.n_s) / rhop / 1.5, 0.5);
    if (velocity < minVelocity) errors.push(`撞击速度低于最小侵蚀速度 (${minVelocity.toFixed(3)} km/s)`);

    if (errors.length === 0) {
      penetration = LO.a_s * lw * elwd * enato * edens * eterm5;
    }
  } else if (material === 'Steel' && mode === 'Penetration') {
    errors.push('半无限靶板穿透计算仅支持钨合金材质');
  }

  return {
    penetration,
    mode,
    material,
    workingLength: lw,
    aspectRatio: lwd,
    minVelocity,
    errors,
  };
}

// ===== WT slopeEffect table (apds_fs_long preset) =====
// Angle is measured from armor normal: 0° = grazing, 90° = perpendicular
// NATO obliquity = 90° - normal angle
// Stat card penetration = base_penetration_0deg / slopeEffect(90° - NATO)
export const SLOPE_EFFECT_APDS_FS_LONG: [number, number][] = [
  [0,  20.0],
  [10, 5.3],
  [20, 2.4],
  [30, 1.73],
  [50, 1.305],
  [70, 1.064],
  [90, 1.0],
];

/** Linearly interpolate the slopeEffect table for a given normal angle (0-90°) */
export function slopeEffectAtNormal(normalAngleDeg: number): number {
  const table = SLOPE_EFFECT_APDS_FS_LONG;
  if (normalAngleDeg <= table[0][0]) return table[0][1];
  if (normalAngleDeg >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 0; i < table.length - 1; i++) {
    const [a0, v0] = table[i];
    const [a1, v1] = table[i + 1];
    if (normalAngleDeg >= a0 && normalAngleDeg <= a1) {
      const t = (normalAngleDeg - a0) / (a1 - a0);
      return v0 + t * (v1 - v0);
    }
  }
  return 1.0;
}

/** Convert NATO obliquity (0° = head-on) to equivalent penetration using WT slopeEffect
 *  eqPen = pen_0deg / slopeEffect(90° - NATO)
 */
export function wtAngledPenetration(pen0deg: number, natoAngleDeg: number): number {
  if (natoAngleDeg <= 0) return pen0deg;
  const normalAngle = 90 - natoAngleDeg;
  const se = slopeEffectAtNormal(normalAngle);
  return pen0deg / se;
}

// ===== Ballistic velocity decay model =====
// War Thunder uses: v(d) = v0 * exp(-Cx * rho_air * A / (2 * m) * d)
// where Cx is from datamine, A = pi * (damageCaliber/2)^2 (penetrator diameter, NOT bore diameter)
export const RHO_AIR = 1.225; // kg/m³ at sea level

/** Calculate projectile velocity at distance using WT's drag model */
export function velocityAtDistance(
  v0_ms: number,         // Muzzle velocity (m/s)
  distance_m: number,    // Distance (m)
  mass_kg: number,       // Projectile mass (kg)
  caliber_mm: number,    // Penetrator diameter / damageCaliber (mm)
  cx: number,            // WT drag coefficient (Cx)
): number {
  const area = Math.PI * Math.pow(caliber_mm / 2000, 2); // m²
  const k = cx * RHO_AIR * area / (2 * mass_kg);
  return v0_ms * Math.exp(-k * distance_m);
}

export interface DistanceCurvePoint {
  distance: number;
  penetration: number;
  pen0deg: number;
  velocity_ms: number;
}

/** Generate penetration vs distance curve
 *  Uses L-O at 0° for base penetration, then applies WT slopeEffect for angled values
 */
export function generateDistanceCurve(
  params: LOParams,
  mode: CalculationMode,
  material: PenetratorMaterial,
  v0_ms: number,
  mass_kg: number,
  caliber_mm: number,
  cx: number,
  maxDistance: number = 4000,
  steps: number = 80,
): DistanceCurvePoint[] {
  const data: DistanceCurvePoint[] = [];
  const step = maxDistance / steps;

  for (let d = 0; d <= maxDistance; d += step) {
    const v_ms = velocityAtDistance(v0_ms, d, mass_kg, caliber_mm, cx);
    const v_kms = v_ms / 1000;
    // Always compute L-O at 0° to get base penetration
    const result0 = calculateLO({ ...params, velocity: v_kms, nato: 0 }, mode, material);
    if (result0.errors.length === 0 && result0.penetration > 0) {
      const angledPen = wtAngledPenetration(result0.penetration, params.nato);
      data.push({
        distance: d,
        penetration: angledPen,        // what game stat card shows
        pen0deg: result0.penetration,  // L-O base (0°)
        velocity_ms: v_ms,
      });
    }
  }
  return data;
}

export interface AngleTableRow {
  distance: number;
  angles: { angle: number; penetration: number }[];
}

/** Generate multi-angle penetration table at key distances (like game stat card)
 *  Uses L-O at 0° then applies WT slopeEffect for each angle
 */
export function generateAngleTable(
  params: LOParams,
  mode: CalculationMode,
  material: PenetratorMaterial,
  v0_ms: number,
  mass_kg: number,
  caliber_mm: number,
  cx: number,
): AngleTableRow[] {
  const distances = [10, 100, 500, 1000, 1500, 2000, 2500, 3000];
  const angles = [0, 30, 60];
  const table: AngleTableRow[] = [];

  for (const dist of distances) {
    const v_ms = velocityAtDistance(v0_ms, dist, mass_kg, caliber_mm, cx);
    const v_kms = v_ms / 1000;
    // Compute L-O at 0° for base penetration
    const res0 = calculateLO({ ...params, velocity: v_kms, nato: 0 }, mode, material);
    const row: { angle: number; penetration: number }[] = [];

    for (const angle of angles) {
      if (res0.errors.length === 0 && res0.penetration > 0) {
        row.push({ angle, penetration: wtAngledPenetration(res0.penetration, angle) });
      } else {
        row.push({ angle, penetration: 0 });
      }
    }
    table.push({ distance: dist, angles: row });
  }
  return table;
}
