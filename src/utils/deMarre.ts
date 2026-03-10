/**
 * Jacob de Marre penetration calculation utilities.
 *
 * Implements the classic de Marre formula used in War Thunder for
 * AP / APC / APBC / APCBC / APHE / APHEBC / APCR kinetic shells.
 *
 * Reference: War Thunder Wiki - Calculation of Armour Penetration
 */

// ===== Constants =====

/** Base constant K_fbr for AP-family shells */
const K_FBR_AP = 1900;
/** Base constant K_fbr for APCR shells */
const K_FBR_APCR = 3000;

/** Air density at sea level (kg/m³) */
export const RHO_AIR = 1.225;

// ===== Knap (explosive filler reduction) =====

/**
 * Calculate the explosive filler reduction factor (knap).
 *
 * Based on the percentage of explosive mass relative to total shell mass.
 * A higher explosive filler % reduces penetration performance.
 *
 * Piecewise linear interpolation from WT Wiki:
 *   tnt% < 0.65  → 1.0
 *   0.65–1.6     → 1.0 → 0.93
 *   1.6–2.0      → 0.93 → 0.90
 *   2.0–3.0      → 0.90 → 0.85
 *   3.0–4.0      → 0.85 → 0.75
 *   ≥ 4.0        → 0.75
 */
export function calcKnap(explosiveMassKg: number, shellMassKg: number): number {
  if (shellMassKg <= 0) return 1.0;
  const pct = (explosiveMassKg / shellMassKg) * 100;
  if (pct < 0.65) return 1.0;
  if (pct < 1.6) return 1.0 + (pct - 0.65) * (0.93 - 1.0) / (1.6 - 0.65);
  if (pct < 2.0) return 0.93 + (pct - 1.6) * (0.90 - 0.93) / (2.0 - 1.6);
  if (pct < 3.0) return 0.90 + (pct - 2.0) * (0.85 - 0.90) / (3.0 - 2.0);
  if (pct < 4.0) return 0.85 + (pct - 3.0) * (0.75 - 0.85) / (4.0 - 3.0);
  return 0.75;
}

// ===== De Marre formulas =====

export interface DeMarreAPParams {
  caliberMm: number;       // full bore caliber (mm)
  massKg: number;          // shell mass (kg)
  velocityMs: number;      // muzzle velocity (m/s)
  explosiveMassKg: number; // raw explosive mass (kg)
  isApcbc: boolean;        // true → K_apcbc = 1.0, false → 0.9
}

/**
 * Calculate AP/APC/APBC/APCBC/APHE/APHEBC penetration at a given velocity.
 *
 * Formula:
 *   P = (v^1.43 × m^0.71) / (K_fbr^1.43 × (d/100)^1.07) × 100 × knap × K_apcbc
 *
 * Returns penetration in mm at 0° angle.
 */
export function calculateDeMarreAP(params: DeMarreAPParams): number {
  const { caliberMm, massKg, velocityMs, explosiveMassKg, isApcbc } = params;
  if (caliberMm <= 0 || massKg <= 0 || velocityMs <= 0) return 0;

  const kfApcbc = isApcbc ? 1.0 : 0.9;
  const knap = calcKnap(explosiveMassKg, massKg);

  return (
    (Math.pow(velocityMs, 1.43) * Math.pow(massKg, 0.71)) /
    (Math.pow(K_FBR_AP, 1.43) * Math.pow(caliberMm / 100, 1.07)) *
    100 * knap * kfApcbc
  );
}

export interface DeMarreAPCRParams {
  coreCaliberMm: number;   // sub-caliber core diameter (mm) — damageCaliber
  shellMassKg: number;     // total shell mass (kg)
  coreMassKg: number;      // core mass (kg) — damageMass
  velocityMs: number;      // muzzle velocity (m/s)
}

/**
 * Calculate APCR penetration at a given velocity.
 *
 * Formula:
 *   pallet_mass = shell_mass - core_mass
 *   kf_pallet   = 0.5 if core% > 36% else 0.4
 *   calc_mass   = core_mass + kf_pallet × pallet_mass
 *   P = (v^1.43 × calc_mass^0.71) / (K_fbr^1.43 × (d_core/10000)^1.07)
 *
 * Returns penetration in mm at 0° angle.
 */
export function calculateDeMarreAPCR(params: DeMarreAPCRParams): number {
  let { coreCaliberMm, shellMassKg, coreMassKg, velocityMs } = params;
  if (coreCaliberMm <= 0 || shellMassKg <= 0 || coreMassKg <= 0 || velocityMs <= 0) return 0;
  if (coreMassKg >= shellMassKg) coreMassKg = shellMassKg * 0.95;

  const palletMass = shellMassKg - coreMassKg;
  const corePercent = (coreMassKg / shellMassKg) * 100;
  const kfPallet = corePercent > 36 ? 0.5 : 0.4;
  const calculatedMass = coreMassKg + kfPallet * palletMass;

  return (
    (Math.pow(velocityMs, 1.43) * Math.pow(calculatedMass, 0.71)) /
    (Math.pow(K_FBR_APCR, 1.43) * Math.pow(coreCaliberMm / 10000, 1.07))
  );
}

// ===== Ballistic velocity decay =====

/**
 * Calculate projectile velocity at distance using WT's drag model.
 * v(d) = v0 × exp(-Cx × ρ_air × A / (2 × m) × d)
 */
export function velocityAtDistance(
  v0Ms: number,
  distanceM: number,
  massKg: number,
  caliberMm: number,
  cx: number,
): number {
  if (cx <= 0 || massKg <= 0) return v0Ms;
  const area = Math.PI * Math.pow(caliberMm / 2000, 2); // m²
  const k = cx * RHO_AIR * area / (2 * massKg);
  return v0Ms * Math.exp(-k * distanceM);
}

// ===== WT angle effect for conventional AP =====

/**
 * WT slopeEffect table for conventional AP shells (apcbc preset).
 * Angle is measured from the armor normal: 0° = grazing, 90° = perpendicular.
 * NATO obliquity = 90° - normal angle.
 */
export const SLOPE_EFFECT_AP: [number, number][] = [
  [0, 20.0],
  [10, 4.5],
  [20, 2.15],
  [30, 1.54],
  [50, 1.18],
  [70, 1.03],
  [90, 1.0],
];

/** Linearly interpolate the slopeEffect table for a given normal angle (0-90°) */
export function slopeEffectAtNormal(normalAngleDeg: number): number {
  const table = SLOPE_EFFECT_AP;
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

/**
 * Convert NATO obliquity (0° = head-on) to equivalent penetration using WT slopeEffect.
 * eqPen = pen_0deg / slopeEffect(90° - NATO)
 */
export function wtAngledPenetration(pen0deg: number, natoAngleDeg: number): number {
  if (natoAngleDeg <= 0) return pen0deg;
  const normalAngle = 90 - natoAngleDeg;
  const se = slopeEffectAtNormal(normalAngle);
  return pen0deg / se;
}

// ===== Distance-Penetration curve generation =====

export interface DistanceCurvePoint {
  distance: number;
  penetration: number;  // equivalent vertical pen at given angle
  pen0deg: number;      // base pen at 0°
  velocityMs: number;
}

/** Parameters needed to generate a distance-penetration curve */
export interface CurveParams {
  caliberMm: number;
  massKg: number;
  v0Ms: number;          // muzzle velocity (m/s)
  explosiveMassKg: number;
  isApcbc: boolean;
  cx: number;
  natoAngle: number;     // display angle
  // APCR-specific
  isApcr?: boolean;
  coreCaliberMm?: number;
  coreMassKg?: number;
}

/**
 * Generate penetration vs distance curve for an AP-family shell.
 * Uses the de Marre formula recalculated at each distance
 * with velocity decayed by WT's drag model.
 */
export function generateDistanceCurve(
  params: CurveParams,
  maxDistance: number = 4000,
  steps: number = 80,
): DistanceCurvePoint[] {
  const data: DistanceCurvePoint[] = [];
  const step = maxDistance / steps;

  // For drag model, use damageCaliber (sub-caliber) for APCR, full caliber otherwise
  const dragCaliber = params.isApcr && params.coreCaliberMm
    ? params.coreCaliberMm
    : params.caliberMm;

  for (let d = 0; d <= maxDistance; d += step) {
    const vMs = velocityAtDistance(params.v0Ms, d, params.massKg, dragCaliber, params.cx);

    let pen0: number;
    if (params.isApcr && params.coreCaliberMm && params.coreMassKg) {
      pen0 = calculateDeMarreAPCR({
        coreCaliberMm: params.coreCaliberMm,
        shellMassKg: params.massKg,
        coreMassKg: params.coreMassKg,
        velocityMs: vMs,
      });
    } else {
      pen0 = calculateDeMarreAP({
        caliberMm: params.caliberMm,
        massKg: params.massKg,
        velocityMs: vMs,
        explosiveMassKg: params.explosiveMassKg,
        isApcbc: params.isApcbc,
      });
    }

    if (pen0 > 0) {
      const angledPen = wtAngledPenetration(pen0, params.natoAngle);
      data.push({
        distance: d,
        penetration: angledPen,
        pen0deg: pen0,
        velocityMs: vMs,
      });
    }
  }
  return data;
}

export interface AngleTableRow {
  distance: number;
  angles: { angle: number; penetration: number }[];
}

/**
 * Generate multi-angle penetration table at key distances (like game stat card).
 */
export function generateAngleTable(params: CurveParams): AngleTableRow[] {
  const distances = [10, 100, 500, 1000, 1500, 2000, 2500, 3000];
  const angles = [0, 30, 60];
  const table: AngleTableRow[] = [];

  const dragCaliber = params.isApcr && params.coreCaliberMm
    ? params.coreCaliberMm
    : params.caliberMm;

  for (const dist of distances) {
    const vMs = velocityAtDistance(params.v0Ms, dist, params.massKg, dragCaliber, params.cx);

    let pen0: number;
    if (params.isApcr && params.coreCaliberMm && params.coreMassKg) {
      pen0 = calculateDeMarreAPCR({
        coreCaliberMm: params.coreCaliberMm,
        shellMassKg: params.massKg,
        coreMassKg: params.coreMassKg,
        velocityMs: vMs,
      });
    } else {
      pen0 = calculateDeMarreAP({
        caliberMm: params.caliberMm,
        massKg: params.massKg,
        velocityMs: vMs,
        explosiveMassKg: params.explosiveMassKg,
        isApcbc: params.isApcbc,
      });
    }

    const row: { angle: number; penetration: number }[] = [];
    for (const angle of angles) {
      row.push({
        angle,
        penetration: pen0 > 0 ? wtAngledPenetration(pen0, angle) : 0,
      });
    }
    table.push({ distance: dist, angles: row });
  }
  return table;
}
