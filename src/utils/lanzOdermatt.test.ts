import { describe, it, expect } from 'vitest';
import {
  calculateLO,
  slopeEffectAtNormal,
  wtAngledPenetration,
  velocityAtDistance,
  LO_CONSTANTS,
  type LOParams,
} from './lanzOdermatt';

describe('Lanz-Odermatt calculations', () => {
  // Default params for tungsten APFSDS (similar to M829A2)
  const defaultParams: LOParams = {
    pLen: 570,      // Working length (mm)
    dia: 27,        // Diameter (mm)
    fLen: 0,        // Frustum length
    df: 0,          // Upper frustum diameter
    rhop: 17200,    // Tungsten density (kg/m³)
    bhnp: 0,        // Not used for tungsten
    velocity: 1.7,  // 1.7 km/s = 1700 m/s
    rhot: 7850,     // RHA steel density
    bhnt: 260,      // RHA hardness
    nato: 0,        // NATO obliquity
  };

  describe('calculateLO', () => {
    it('should calculate penetration for tungsten perforation', () => {
      const result = calculateLO(defaultParams, 'Perforation', 'Tungsten');
      expect(result.errors).toHaveLength(0);
      expect(result.penetration).toBeGreaterThan(0);
      expect(result.workingLength).toBe(570);
      expect(result.aspectRatio).toBeCloseTo(570 / 27, 1);
    });

    it('should return error for invalid aspect ratio', () => {
      const badParams = { ...defaultParams, pLen: 50 }; // L/D < 4
      const result = calculateLO(badParams, 'Perforation', 'Tungsten');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('长径比'))).toBe(true);
    });

    it('should return error for invalid target density', () => {
      const badParams = { ...defaultParams, rhot: 5000 };
      const result = calculateLO(badParams, 'Perforation', 'Tungsten');
      expect(result.errors.some(e => e.includes('靶板密度'))).toBe(true);
    });

    it('should return error for DU penetration mode', () => {
      const result = calculateLO(defaultParams, 'Penetration', 'DU');
      expect(result.errors.some(e => e.includes('半无限靶板'))).toBe(true);
    });

    it('should calculate working length with frustum', () => {
      const paramsWithFrustum = { ...defaultParams, fLen: 50, df: 20 };
      const result = calculateLO(paramsWithFrustum, 'Perforation', 'Tungsten');
      expect(result.workingLength).toBeLessThan(570);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('slopeEffectAtNormal', () => {
    it('should return 1.0 at 90° (perpendicular)', () => {
      expect(slopeEffectAtNormal(90)).toBe(1.0);
    });

    it('should return high value at low angles (grazing)', () => {
      expect(slopeEffectAtNormal(0)).toBe(20.0);
    });

    it('should interpolate between table values', () => {
      const effect = slopeEffectAtNormal(45); // Between 30° and 50°
      expect(effect).toBeGreaterThan(1.305); // Value at 50°
      expect(effect).toBeLessThan(1.73);     // Value at 30°
    });
  });

  describe('wtAngledPenetration', () => {
    it('should return base penetration at 0° NATO', () => {
      expect(wtAngledPenetration(500, 0)).toBe(500);
    });

    it('should return reduced penetration at angles', () => {
      const pen0 = 500;
      const pen30 = wtAngledPenetration(pen0, 30);
      expect(pen30).toBeLessThan(pen0);
    });

    it('should calculate consistent with slopeEffect', () => {
      const pen0 = 500;
      const nato = 30;
      const normalAngle = 90 - nato; // 60°
      const se = slopeEffectAtNormal(normalAngle);
      expect(wtAngledPenetration(pen0, nato)).toBeCloseTo(pen0 / se, 5);
    });
  });

  describe('velocityAtDistance', () => {
    const v0 = 1700;      // m/s
    const mass = 4.2;     // kg
    const caliber = 27;   // mm
    const cx = 0.843;

    it('should return muzzle velocity at 0m', () => {
      expect(velocityAtDistance(v0, 0, mass, caliber, cx)).toBe(v0);
    });

    it('should decrease velocity with distance', () => {
      const v500 = velocityAtDistance(v0, 500, mass, caliber, cx);
      const v1000 = velocityAtDistance(v0, 1000, mass, caliber, cx);
      expect(v500).toBeLessThan(v0);
      expect(v1000).toBeLessThan(v500);
    });

    it('should follow exponential decay', () => {
      const v1000 = velocityAtDistance(v0, 1000, mass, caliber, cx);
      const v2000 = velocityAtDistance(v0, 2000, mass, caliber, cx);
      // v(2000) / v(1000) should equal v(1000) / v(0)
      const ratio1 = v1000 / v0;
      const ratio2 = v2000 / v1000;
      expect(ratio2).toBeCloseTo(ratio1, 5);
    });
  });

  describe('LO_CONSTANTS', () => {
    it('should have all required constants', () => {
      expect(LO_CONSTANTS.b0).toBeDefined();
      expect(LO_CONSTANTS.b1).toBeDefined();
      expect(LO_CONSTANTS.a_t).toBeDefined();
      expect(LO_CONSTANTS.a_d).toBeDefined();
      expect(LO_CONSTANTS.a_s).toBeDefined();
    });
  });
});
