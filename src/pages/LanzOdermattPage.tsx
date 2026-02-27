import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Divider,
  Slider,
  Alert,
} from '@mui/material';
import { ArrowBack, Calculate } from '@mui/icons-material';
import Navbar from '../components/Navbar';

// ===== Lanz-Odermatt Constants =====
const LO = {
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

type PenetratorMaterial = 'Tungsten' | 'DU' | 'Steel';
type CalculationMode = 'Perforation' | 'Penetration';

interface LOParams {
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

interface LOResult {
  penetration: number;
  mode: CalculationMode;
  material: PenetratorMaterial;
  workingLength: number;
  aspectRatio: number;
  minVelocity: number;
  errors: string[];
}

function calculateLO(params: LOParams, mode: CalculationMode, material: PenetratorMaterial): LOResult {
  const errors: string[] = [];
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
const SLOPE_EFFECT_APDS_FS_LONG: [number, number][] = [
  [0,  20.0],
  [10, 5.3],
  [20, 2.4],
  [30, 1.73],
  [50, 1.305],
  [70, 1.064],
  [90, 1.0],
];

/** Linearly interpolate the slopeEffect table for a given normal angle (0-90°) */
function slopeEffectAtNormal(normalAngleDeg: number): number {
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
function wtAngledPenetration(pen0deg: number, natoAngleDeg: number): number {
  if (natoAngleDeg <= 0) return pen0deg;
  const normalAngle = 90 - natoAngleDeg;
  const se = slopeEffectAtNormal(normalAngle);
  return pen0deg / se;
}

// ===== Ballistic velocity decay model =====
// War Thunder uses: v(d) = v0 * exp(-Cx * rho_air * A / (2 * m) * d)
// where Cx is from datamine, A = pi * (damageCaliber/2)^2 (penetrator diameter, NOT bore diameter)
const RHO_AIR = 1.225; // kg/m³ at sea level

/** Calculate projectile velocity at distance using WT's drag model */
function velocityAtDistance(
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

/** Generate penetration vs distance curve
 *  Uses L-O at 0° for base penetration, then applies WT slopeEffect for angled values
 */
function generateDistanceCurve(
  params: LOParams,
  mode: CalculationMode,
  material: PenetratorMaterial,
  v0_ms: number,
  mass_kg: number,
  caliber_mm: number,
  cx: number,
  maxDistance: number = 4000,
  steps: number = 80,
): { distance: number; penetration: number; pen0deg: number; velocity_ms: number }[] {
  const data: { distance: number; penetration: number; pen0deg: number; velocity_ms: number }[] = [];
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

/** Generate multi-angle penetration table at key distances (like game stat card)
 *  Uses L-O at 0° then applies WT slopeEffect for each angle
 */
function generateAngleTable(
  params: LOParams,
  mode: CalculationMode,
  material: PenetratorMaterial,
  v0_ms: number,
  mass_kg: number,
  caliber_mm: number,
  cx: number,
): { distance: number; angles: { angle: number; penetration: number }[] }[] {
  const distances = [10, 100, 500, 1000, 1500, 2000, 2500, 3000];
  const angles = [0, 30, 60];
  const table: { distance: number; angles: { angle: number; penetration: number }[] }[] = [];

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

export default function LanzOdermattPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Initialize from URL params (from VehicleDetailPage)
  const initWL = parseFloat(searchParams.get('wl') || '0');
  const initDensity = parseFloat(searchParams.get('density') || '17200');
  const initCaliber = parseFloat(searchParams.get('caliber') || '27');
  const initMass = parseFloat(searchParams.get('mass') || '4.2');
  const initCx = parseFloat(searchParams.get('cx') || '0.843');
  const initVelocity = parseFloat(searchParams.get('velocity') || '1.737');
  const initGamePen = parseFloat(searchParams.get('gamePen') || '0');
  const vehicleName = searchParams.get('vehicle') || '';
  const ammoName = searchParams.get('ammo') || '';

  // Penetrator params
  const [pLen, setPLen] = useState(initWL > 0 ? initWL : 950);
  const [dia, setDia] = useState(initCaliber > 0 ? initCaliber : 27);
  const [fLen, setFLen] = useState(0);
  const [df, setDf] = useState(0);
  const [rhop, setRhop] = useState(initDensity > 0 ? initDensity : 17200);
  const [bhnp, setBhnp] = useState(0);
  const [velocity, setVelocity] = useState(initVelocity > 0 ? initVelocity : 1.737);
  const [projectileMass, setProjectileMass] = useState(initMass > 0 ? initMass : 4.2);
  const [dragCx, setDragCx] = useState(initCx > 0 ? initCx : 0.843);

  // Target params
  const [rhot, setRhot] = useState(7850);
  const [bhnt, setBhnt] = useState(260);
  const [nato, setNato] = useState(0);

  // Mode
  const [mode, setMode] = useState<CalculationMode>('Perforation');
  const [material, setMaterial] = useState<PenetratorMaterial>('Tungsten');

  const params: LOParams = { pLen, dia, fLen, df, rhop, bhnp, velocity, rhot, bhnt, nato };

  // Always compute L-O at 0° for base penetration; slopeEffect handles obliquity
  const result = useMemo(() => calculateLO({ ...params, nato: 0 }, mode, material), [
    pLen, dia, fLen, df, rhop, bhnp, velocity, rhot, bhnt, mode, material,
  ]);

  // Distance-penetration curve (shows equivalent vertical penetration)
  const distanceCurve = useMemo(() => {
    const v0_ms = velocity * 1000; // km/s -> m/s
    return generateDistanceCurve(params, mode, material, v0_ms, projectileMass, dia, dragCx);
  }, [pLen, dia, fLen, df, rhop, bhnp, velocity, rhot, bhnt, nato, mode, material, projectileMass, dragCx]);

  // Multi-angle penetration table (like game stat card)
  const angleTable = useMemo(() => {
    const v0_ms = velocity * 1000;
    return generateAngleTable(params, mode, material, v0_ms, projectileMass, dia, dragCx);
  }, [pLen, dia, fLen, df, rhop, bhnp, velocity, rhot, bhnt, nato, mode, material, projectileMass, dragCx]);

  // Chart dimensions
  const chartWidth = 600;
  const chartHeight = 300;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };

  const chartInner = {
    width: chartWidth - padding.left - padding.right,
    height: chartHeight - padding.top - padding.bottom,
  };

  // Chart scale helpers (distance on X, penetration on Y)
  const dRange: [number, number] = [0, distanceCurve.length > 0 ? Math.max(...distanceCurve.map(d => d.distance)) : 4000];
  const pRange: [number, number] = distanceCurve.length > 0
    ? [0, Math.max(...distanceCurve.map(d => d.penetration)) * 1.1]
    : [0, 1000];

  const scaleX = (d: number) => padding.left + ((d - dRange[0]) / (dRange[1] - dRange[0])) * chartInner.width;
  const scaleY = (p: number) => padding.top + chartInner.height - ((p - pRange[0]) / (pRange[1] - pRange[0])) * chartInner.height;

  // Build SVG path
  const pathD = distanceCurve.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${scaleX(d.distance).toFixed(1)} ${scaleY(d.penetration).toFixed(1)}`
  ).join(' ');

  // Distance slider for interactive readout
  const [selectedDistance, setSelectedDistance] = useState(0);

  // Find penetration at selected distance (using WT slopeEffect)
  const selectedPoint = useMemo(() => {
    if (distanceCurve.length === 0) return null;
    const v_ms = velocityAtDistance(velocity * 1000, selectedDistance, projectileMass, dia, dragCx);
    const v_kms = v_ms / 1000;
    const res0 = calculateLO({ ...params, velocity: v_kms, nato: 0 }, mode, material);
    if (res0.errors.length === 0 && res0.penetration > 0) {
      return {
        distance: selectedDistance,
        penetration: wtAngledPenetration(res0.penetration, nato),  // game stat card value
        pen0deg: res0.penetration,
        velocity_ms: v_ms,
      };
    }
    return null;
  }, [selectedDistance, pLen, dia, fLen, df, rhop, bhnp, velocity, rhot, bhnt, nato, mode, material, projectileMass, dragCx]);

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => pRange[0] + (pRange[1] - pRange[0]) * i / yTicks);

  // X-axis ticks (distances)
  const xTicks = 4;
  const xTickValues = Array.from({ length: xTicks + 1 }, (_, i) => dRange[0] + (dRange[1] - dRange[0]) * i / xTicks);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Navbar />

      <Container maxWidth="lg" sx={{ pt: 10, pb: 4 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(-1)}
          sx={{
            color: '#525252',
            mb: 2,
            '&:hover': { color: '#171717' },
          }}
        >
          返回
        </Button>

        <Typography variant="h4" sx={{ color: '#171717', fontWeight: 700, mb: 1 }}>
          Lanz-Odermatt 穿深计算器
        </Typography>
        <Typography variant="body2" sx={{ color: '#737373', mb: 3 }}>
          基于 Lanz-Odermatt 方程计算长杆穿甲弹穿透深度 (Willy Odermatt, 2000)
        </Typography>

        {vehicleName && (
          <Alert severity="info" sx={{ mb: 2 }}>
            已加载 <strong>{vehicleName}</strong> 的弹药参数{ammoName ? ` (${ammoName})` : ''}
            {initGamePen > 0 && ` — 游戏内穿深: ${initGamePen.toFixed(0)} mm`}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Left: Parameters */}
          <Grid item xs={12} md={5}>
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
              {/* Mode & Material */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>计算模式</InputLabel>
                  <Select
                    value={mode}
                    label="计算模式"
                    onChange={(e) => setMode(e.target.value as CalculationMode)}
                  >
                    <MenuItem value="Perforation">穿孔 (Perforation)</MenuItem>
                    <MenuItem value="Penetration">穿透 (Penetration)</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>弹芯材质</InputLabel>
                  <Select
                    value={material}
                    label="弹芯材质"
                    onChange={(e) => setMaterial(e.target.value as PenetratorMaterial)}
                  >
                    <MenuItem value="Tungsten">钨合金 (Tungsten)</MenuItem>
                    <MenuItem value="DU">贫铀 (DU)</MenuItem>
                    <MenuItem value="Steel">钢 (Steel)</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Penetrator Parameters */}
              <Typography variant="subtitle2" sx={{ color: '#171717', fontWeight: 600, mb: 2 }}>
                弹芯参数
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="弹芯长度 (mm)"
                    type="number"
                    size="small"
                    fullWidth
                    value={pLen}
                    onChange={(e) => setPLen(parseFloat(e.target.value) || 0)}
                    helperText={initWL > 0 ? '来自WT工作长度' : '总长度'}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="直径 (mm)"
                    type="number"
                    size="small"
                    fullWidth
                    value={dia}
                    onChange={(e) => setDia(parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="截锥体长度 (mm)"
                    type="number"
                    size="small"
                    fullWidth
                    value={fLen}
                    onChange={(e) => setFLen(parseFloat(e.target.value) || 0)}
                    helperText="WT已算入工作长度则填0"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="截锥上底直径 (mm)"
                    type="number"
                    size="small"
                    fullWidth
                    value={df}
                    onChange={(e) => setDf(parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="密度 (kg/m³)"
                    type="number"
                    size="small"
                    fullWidth
                    value={rhop}
                    onChange={(e) => setRhop(parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                {material === 'Steel' && (
                  <Grid item xs={6}>
                    <TextField
                      label="弹芯硬度 (BHN)"
                      type="number"
                      size="small"
                      fullWidth
                      value={bhnp}
                      onChange={(e) => setBhnp(parseFloat(e.target.value) || 0)}
                    />
                  </Grid>
                )}
              </Grid>

              {/* Velocity & Mass */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ color: '#525252', mb: 1 }}>
                  炮口初速: <strong>{velocity.toFixed(3)} km/s</strong> ({(velocity * 1000).toFixed(0)} m/s)
                </Typography>
                <Slider
                  value={velocity}
                  min={0.5}
                  max={2.5}
                  step={0.001}
                  onChange={(_, v) => setVelocity(v as number)}
                  sx={{
                    color: '#16a34a',
                    '& .MuiSlider-thumb': { width: 16, height: 16 },
                  }}
                />
              </Box>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={6}>
                  <TextField
                    label="弹丸质量 (kg)"
                    type="number"
                    size="small"
                    fullWidth
                    value={projectileMass}
                    onChange={(e) => setProjectileMass(parseFloat(e.target.value) || 0)}
                    helperText="含弹托总质量"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="阻力系数 (Cx)"
                    type="number"
                    size="small"
                    fullWidth
                    value={dragCx}
                    onChange={(e) => setDragCx(parseFloat(e.target.value) || 0)}
                    helperText="来自 WT datamine"
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* Target Parameters */}
              <Typography variant="subtitle2" sx={{ color: '#171717', fontWeight: 600, mb: 2 }}>
                靶板参数 (RHA钢)
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="靶板密度 (kg/m³)"
                    type="number"
                    size="small"
                    fullWidth
                    value={rhot}
                    onChange={(e) => setRhot(parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="靶板硬度 (BHN)"
                    type="number"
                    size="small"
                    fullWidth
                    value={bhnt}
                    onChange={(e) => setBhnt(parseFloat(e.target.value) || 0)}
                  />
                </Grid>
                {mode === 'Perforation' && (
                  <Grid item xs={12}>
                    <Typography variant="body2" sx={{ color: '#525252', mb: 1 }}>
                      NATO 入射角: <strong>{nato}°</strong>
                    </Typography>
                    <Slider
                      value={nato}
                      min={0}
                      max={75}
                      step={1}
                      onChange={(_, v) => setNato(v as number)}
                      sx={{
                        color: '#3b82f6',
                        '& .MuiSlider-thumb': { width: 16, height: 16 },
                      }}
                    />
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>

          {/* Right: Results */}
          <Grid item xs={12} md={7}>
            {/* Result Card */}
            <Paper
              elevation={2}
              sx={{
                p: 3,
                borderRadius: 2,
                mb: 3,
                background: result.errors.length === 0 && result.penetration > 0
                  ? 'linear-gradient(135deg, #065f46 0%, #064e3b 100%)'
                  : 'linear-gradient(135deg, #525252 0%, #404040 100%)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Calculate sx={{ color: '#fff', fontSize: 28 }} />
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                  计算结果
                </Typography>
              </Box>

              {result.errors.length > 0 ? (
                <Box>
                  {result.errors.map((err, i) => (
                    <Typography key={i} sx={{ color: '#fca5a5', fontSize: '0.85rem', mb: 0.5 }}>
                      • {err}
                    </Typography>
                  ))}
                </Box>
              ) : (
                <Box>
                  {(() => {
                    // Use selected distance point if available, otherwise use muzzle velocity result
                    const res0 = result; // result is already computed at muzzle velocity
                    const pen0 = selectedPoint ? selectedPoint.pen0deg : res0.penetration;
                    const displayPen = selectedPoint ? selectedPoint.penetration : wtAngledPenetration(res0.penetration, nato);
                    const displayVelocity = selectedPoint ? selectedPoint.velocity_ms : velocity * 1000;
                    const displayDistance = selectedPoint ? selectedDistance : 0;
                    return (
                      <>
                        <Typography sx={{ color: '#fff', fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.2 }}>
                          {displayPen.toFixed(1)} mm
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', mt: 0.5 }}>
                          {material === 'Tungsten' ? '钨合金' : material === 'DU' ? '贫铀' : '钢'}穿甲弹
                          {nato > 0 ? ` @ ${nato}°` : ''}
                          {' '}· {displayDistance} m · {displayVelocity.toFixed(0)} m/s
                        </Typography>
                        {nato > 0 && (
                          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', mt: 0.5 }}>
                            0° 穿深: {pen0.toFixed(1)} mm · slopeEffect: {slopeEffectAtNormal(90 - nato).toFixed(3)}
                          </Typography>
                        )}
                      </>
                    );
                  })()}

                  {initGamePen > 0 && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                      {(() => {
                        const curPen = selectedPoint ? selectedPoint.penetration : wtAngledPenetration(result.penetration, nato);
                        return (
                          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
                            游戏内穿深 (0m): <strong style={{ color: '#fde047' }}>{initGamePen.toFixed(0)} mm</strong>
                            {' '}(当前差异: {(curPen - initGamePen).toFixed(1)} mm,{' '}
                            {((curPen / initGamePen - 1) * 100).toFixed(1)}%)
                          </Typography>
                        );
                      })()}
                    </Box>
                  )}
                </Box>
              )}

              {/* Intermediate values */}
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <Grid container spacing={1}>
                  {[
                    { label: '工作长度', value: `${result.workingLength.toFixed(1)} mm` },
                    { label: '长径比', value: result.aspectRatio.toFixed(2) },
                    { label: '最小速度', value: `${result.minVelocity.toFixed(3)} km/s` },
                  ].map((item) => (
                    <Grid item xs={4} key={item.label}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
                        {item.label}
                      </Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 600 }}>
                        {item.value}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Paper>

            {/* Distance vs Penetration Chart */}
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#171717', fontWeight: 600 }}>
                  距离-穿深曲线{nato > 0 ? ` (${nato}° slopeEffect)` : ''}
                </Typography>
                {selectedPoint && (
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ color: '#16a34a', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.1 }}>
                      {selectedPoint.penetration.toFixed(0)} mm
                    </Typography>
                    <Typography sx={{ color: '#737373', fontSize: '0.75rem' }}>
                      @ {selectedDistance} m · {selectedPoint.velocity_ms.toFixed(0)} m/s
                      {nato > 0 && ` · ${nato}°`}
                    </Typography>
                  </Box>
                )}
              </Box>

              {distanceCurve.length > 0 ? (
                <Box sx={{ overflowX: 'auto' }}>
                  <Box sx={{ width: chartWidth, mx: 'auto' }}>
                    <svg width={chartWidth} height={chartHeight} style={{ display: 'block' }}>
                    {/* Grid lines */}
                    {yTickValues.map((val, i) => (
                      <g key={`y-${i}`}>
                        <line
                          x1={padding.left}
                          y1={scaleY(val)}
                          x2={chartWidth - padding.right}
                          y2={scaleY(val)}
                          stroke="#e5e5e5"
                          strokeWidth={1}
                        />
                        <text
                          x={padding.left - 8}
                          y={scaleY(val) + 4}
                          textAnchor="end"
                          fontSize={11}
                          fill="#737373"
                        >
                          {val.toFixed(0)}
                        </text>
                      </g>
                    ))}
                    {xTickValues.map((val, i) => (
                      <g key={`x-${i}`}>
                        <line
                          x1={scaleX(val)}
                          y1={padding.top}
                          x2={scaleX(val)}
                          y2={chartHeight - padding.bottom}
                          stroke="#e5e5e5"
                          strokeWidth={1}
                        />
                        <text
                          x={scaleX(val)}
                          y={chartHeight - padding.bottom + 16}
                          textAnchor="middle"
                          fontSize={11}
                          fill="#737373"
                        >
                          {val.toFixed(0)}
                        </text>
                      </g>
                    ))}

                    {/* Axis labels */}
                    <text
                      x={chartWidth / 2}
                      y={chartHeight - 4}
                      textAnchor="middle"
                      fontSize={12}
                      fill="#525252"
                    >
                      距离 (m)
                    </text>
                    <text
                      x={14}
                      y={chartHeight / 2}
                      textAnchor="middle"
                      fontSize={12}
                      fill="#525252"
                      transform={`rotate(-90, 14, ${chartHeight / 2})`}
                    >
                      穿深 (mm)
                    </text>

                    {/* Curve */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                    />

                    {/* Selected distance vertical marker */}
                    {selectedPoint && selectedDistance <= dRange[1] && (
                      <>
                        <line
                          x1={scaleX(selectedDistance)}
                          y1={padding.top}
                          x2={scaleX(selectedDistance)}
                          y2={chartHeight - padding.bottom}
                          stroke="#ef4444"
                          strokeWidth={1}
                          strokeDasharray="4 2"
                        />
                        <circle
                          cx={scaleX(selectedDistance)}
                          cy={scaleY(selectedPoint.penetration)}
                          r={5}
                          fill="#ef4444"
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      </>
                    )}
                  </svg>

                  {/* Distance slider - aligned with chart plot area */}
                  <Box sx={{ ml: `${padding.left}px`, mr: `${padding.right}px`, mt: -1 }}>
                    <Slider
                      value={selectedDistance}
                      min={0}
                      max={Math.round(dRange[1])}
                      step={50}
                      onChange={(_, v) => setSelectedDistance(v as number)}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => `${v} m`}
                      sx={{
                        color: '#ef4444',
                        '& .MuiSlider-thumb': { width: 14, height: 14 },
                        '& .MuiSlider-rail': { opacity: 0.2 },
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#a3a3a3', display: 'block', textAlign: 'center', mt: 0.5 }}>
                    WT 弹道模型 (Cx={dragCx}, 弹径={dia}mm, 海平面标准大气)
                  </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography sx={{ color: '#a3a3a3', textAlign: 'center', py: 4 }}>
                  调整参数后将显示距离-穿深曲线
                </Typography>
              )}
            </Paper>

            {/* Multi-angle penetration table (like game stat card) */}
            {mode === 'Perforation' && angleTable.length > 0 && (
              <Paper elevation={1} sx={{ p: 3, borderRadius: 2, mt: 3 }}>
                <Typography variant="subtitle2" sx={{ color: '#171717', fontWeight: 600, mb: 2 }}>
                  穿甲数据表 (等效垂直穿深 mm)
                </Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e5e5' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#525252', fontWeight: 600 }}>
                          距离
                        </th>
                        {angleTable[0]?.angles.map(a => (
                          <th key={a.angle} style={{ padding: '8px 12px', textAlign: 'center', color: '#525252', fontWeight: 600 }}>
                            {a.angle}°
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {angleTable.map((row) => (
                        <tr key={row.distance} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '6px 12px', color: '#737373', fontWeight: 500 }}>
                            {row.distance} m
                          </td>
                          {row.angles.map(a => (
                            <td key={a.angle} style={{
                              padding: '6px 12px',
                              textAlign: 'center',
                              color: a.penetration > 0 ? '#171717' : '#a3a3a3',
                              fontWeight: 600,
                              fontFamily: 'monospace',
                            }}>
                              {a.penetration > 0 ? Math.round(a.penetration) : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
                <Typography variant="caption" sx={{ color: '#a3a3a3', display: 'block', mt: 1.5 }}>
                  数值 = L-O 0° 穿深 / WT slopeEffect(apds_fs_long)，与游戏资料卡一致
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
