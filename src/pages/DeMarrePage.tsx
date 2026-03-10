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
  Switch,
  FormControlLabel,
} from '@mui/material';
import { ArrowBack, Calculate } from '@mui/icons-material';
import Navbar from '../components/Navbar';
import {
  calculateDeMarreAP,
  calculateDeMarreAPCR,
  calcKnap,
  velocityAtDistance,
  wtAngledPenetration,
  slopeEffectAtNormal,
  generateDistanceCurve,
  generateAngleTable,
  type CurveParams,
} from '../utils/deMarre';

type ShellMode = 'AP' | 'APCR';

export default function DeMarrePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Initialize from URL params (from VehicleDetailPage)
  const initCaliber = parseFloat(searchParams.get('caliber') || '0');
  const initMass = parseFloat(searchParams.get('mass') || '0');
  const initVelocity = parseFloat(searchParams.get('velocity') || '0');
  const initExplosive = parseFloat(searchParams.get('explosive') || '0');
  const initIsApcbc = searchParams.get('apcbc') === '1';
  const initCx = parseFloat(searchParams.get('cx') || '0.3');
  const initGamePen = parseFloat(searchParams.get('gamePen') || '0');
  const vehicleName = searchParams.get('vehicle') || '';
  const ammoName = searchParams.get('ammo') || '';
  const initIsApcr = searchParams.get('apcr') === '1';
  const initCoreCaliber = parseFloat(searchParams.get('coreCaliber') || '0');
  const initCoreMass = parseFloat(searchParams.get('coreMass') || '0');

  // Shell mode
  const [shellMode, setShellMode] = useState<ShellMode>(initIsApcr ? 'APCR' : 'AP');

  // AP params
  const [caliber, setCaliber] = useState(initCaliber > 0 ? initCaliber : 75);
  const [mass, setMass] = useState(initMass > 0 ? initMass : 6.3);
  const [velocity, setVelocity] = useState(initVelocity > 0 ? initVelocity : 740);
  const [explosiveMass, setExplosiveMass] = useState(initExplosive >= 0 ? initExplosive : 0);
  const [isApcbc, setIsApcbc] = useState(initIsApcbc);
  const [cx, setCx] = useState(initCx > 0 ? initCx : 0.3);

  // APCR params
  const [coreCaliber, setCoreCaliber] = useState(initCoreCaliber > 0 ? initCoreCaliber : 28);
  const [coreMass, setCoreMass] = useState(initCoreMass > 0 ? initCoreMass : 0.95);

  // Angle
  const [natoAngle, setNatoAngle] = useState(0);

  // Distance slider for chart
  const [selectedDistance, setSelectedDistance] = useState(0);

  // Calculate knap for display
  const knap = useMemo(() => calcKnap(explosiveMass, mass), [explosiveMass, mass]);
  const tntPct = mass > 0 ? (explosiveMass / mass) * 100 : 0;

  // Base penetration at muzzle velocity (0°)
  const basePen0 = useMemo(() => {
    if (shellMode === 'APCR') {
      return calculateDeMarreAPCR({
        coreCaliberMm: coreCaliber,
        shellMassKg: mass,
        coreMassKg: coreMass,
        velocityMs: velocity,
      });
    }
    return calculateDeMarreAP({
      caliberMm: caliber,
      massKg: mass,
      velocityMs: velocity,
      explosiveMassKg: explosiveMass,
      isApcbc,
    });
  }, [shellMode, caliber, mass, velocity, explosiveMass, isApcbc, coreCaliber, coreMass]);

  // Display penetration (with angle)
  const displayPen = useMemo(
    () => wtAngledPenetration(basePen0, natoAngle),
    [basePen0, natoAngle],
  );

  // Curve params
  const curveParams: CurveParams = useMemo(() => ({
    caliberMm: caliber,
    massKg: mass,
    v0Ms: velocity,
    explosiveMassKg: explosiveMass,
    isApcbc,
    cx,
    natoAngle,
    isApcr: shellMode === 'APCR',
    coreCaliberMm: coreCaliber,
    coreMassKg: coreMass,
  }), [caliber, mass, velocity, explosiveMass, isApcbc, cx, natoAngle, shellMode, coreCaliber, coreMass]);

  // Distance-penetration curve
  const distanceCurve = useMemo(
    () => generateDistanceCurve(curveParams),
    [curveParams],
  );

  // Angle table
  const angleTable = useMemo(
    () => generateAngleTable(curveParams),
    [curveParams],
  );

  // Selected distance point
  const selectedPoint = useMemo(() => {
    if (distanceCurve.length === 0) return null;
    const dragCaliber = shellMode === 'APCR' && coreCaliber > 0 ? coreCaliber : caliber;
    const vMs = velocityAtDistance(velocity, selectedDistance, mass, dragCaliber, cx);

    let pen0: number;
    if (shellMode === 'APCR') {
      pen0 = calculateDeMarreAPCR({
        coreCaliberMm: coreCaliber,
        shellMassKg: mass,
        coreMassKg: coreMass,
        velocityMs: vMs,
      });
    } else {
      pen0 = calculateDeMarreAP({
        caliberMm: caliber,
        massKg: mass,
        velocityMs: vMs,
        explosiveMassKg: explosiveMass,
        isApcbc,
      });
    }

    if (pen0 > 0) {
      return {
        distance: selectedDistance,
        penetration: wtAngledPenetration(pen0, natoAngle),
        pen0deg: pen0,
        velocityMs: vMs,
      };
    }
    return null;
  }, [selectedDistance, distanceCurve.length, shellMode, caliber, mass, velocity, explosiveMass, isApcbc, cx, natoAngle, coreCaliber, coreMass]);

  // Chart dimensions
  const chartWidth = 600;
  const chartHeight = 300;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };
  const chartInner = {
    width: chartWidth - padding.left - padding.right,
    height: chartHeight - padding.top - padding.bottom,
  };

  // Chart scales
  const dRange: [number, number] = [0, distanceCurve.length > 0 ? Math.max(...distanceCurve.map(d => d.distance)) : 4000];
  const pRange: [number, number] = distanceCurve.length > 0
    ? [0, Math.max(...distanceCurve.map(d => d.penetration)) * 1.1]
    : [0, 300];

  const scaleX = (d: number) => padding.left + ((d - dRange[0]) / (dRange[1] - dRange[0])) * chartInner.width;
  const scaleY = (p: number) => padding.top + chartInner.height - ((p - pRange[0]) / (pRange[1] - pRange[0])) * chartInner.height;

  const pathD = distanceCurve.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${scaleX(d.distance).toFixed(1)} ${scaleY(d.penetration).toFixed(1)}`
  ).join(' ');

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => pRange[0] + (pRange[1] - pRange[0]) * i / yTicks);

  // X-axis ticks
  const xTicks = 4;
  const xTickValues = Array.from({ length: xTicks + 1 }, (_, i) => dRange[0] + (dRange[1] - dRange[0]) * i / xTicks);

  const isValid = basePen0 > 0;
  const accentColor = shellMode === 'APCR' ? '#7c3aed' : '#2563eb';

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Navbar />

      <Container maxWidth="lg" sx={{ pt: 10, pb: 4 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(-1)}
          sx={{ color: '#525252', mb: 2, '&:hover': { color: '#171717' } }}
        >
          返回
        </Button>

        <Typography variant="h4" sx={{ color: '#171717', fontWeight: 700, mb: 1 }}>
          Jacob de Marre 穿深计算器
        </Typography>
        <Typography variant="body2" sx={{ color: '#737373', mb: 3 }}>
          基于 Jacob de Marre 公式计算传统动能弹穿透深度 (AP / APC / APBC / APCBC / APHE / APCR)
        </Typography>

        {vehicleName && (
          <Alert severity="info" sx={{ mb: 2 }}>
            已加载 <strong>{vehicleName}</strong> 的弹药参数{ammoName ? ` (${ammoName})` : ''}
            {initGamePen > 0 && ` — 游戏内穿深: ${initGamePen.toFixed(0)} mm`}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* ═══ Left: Parameters ═══ */}
          <Grid item xs={12} md={5}>
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
              {/* Shell mode selector */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>弹种模式</InputLabel>
                  <Select
                    value={shellMode}
                    label="弹种模式"
                    onChange={(e) => setShellMode(e.target.value as ShellMode)}
                  >
                    <MenuItem value="AP">AP 系 (AP/APC/APBC/APCBC/APHE)</MenuItem>
                    <MenuItem value="APCR">APCR (次口径高速穿甲弹)</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* === AP params === */}
              <Typography variant="subtitle2" sx={{ color: '#171717', fontWeight: 600, mb: 2 }}>
                弹丸参数
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="全径口径 (mm)"
                    type="number"
                    size="small"
                    fullWidth
                    value={caliber}
                    onChange={(e) => setCaliber(parseFloat(e.target.value) || 0)}
                    helperText="火炮口径 (bullet.caliber)"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="弹丸质量 (kg)"
                    type="number"
                    size="small"
                    fullWidth
                    value={mass}
                    onChange={(e) => setMass(parseFloat(e.target.value) || 0)}
                  />
                </Grid>

                {shellMode === 'APCR' && (
                  <>
                    <Grid item xs={6}>
                      <TextField
                        label="弹芯口径 (mm)"
                        type="number"
                        size="small"
                        fullWidth
                        value={coreCaliber}
                        onChange={(e) => setCoreCaliber(parseFloat(e.target.value) || 0)}
                        helperText="damageCaliber"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        label="弹芯质量 (kg)"
                        type="number"
                        size="small"
                        fullWidth
                        value={coreMass}
                        onChange={(e) => setCoreMass(parseFloat(e.target.value) || 0)}
                        helperText="damageMass"
                      />
                    </Grid>
                  </>
                )}

                {shellMode === 'AP' && (
                  <>
                    <Grid item xs={6}>
                      <TextField
                        label="炸药填充 (kg)"
                        type="number"
                        size="small"
                        fullWidth
                        value={explosiveMass}
                        onChange={(e) => setExplosiveMass(parseFloat(e.target.value) || 0)}
                        helperText={`填充率 ${tntPct.toFixed(2)}% · knap=${knap.toFixed(3)}`}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', pl: 1 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={isApcbc}
                              onChange={(e) => setIsApcbc(e.target.checked)}
                              color="primary"
                              size="small"
                            />
                          }
                          label={
                            <Typography sx={{ fontSize: '0.8rem', color: '#525252' }}>
                              被帽 (APC/APCBC)
                            </Typography>
                          }
                        />
                      </Box>
                    </Grid>
                  </>
                )}
              </Grid>

              {/* Velocity slider */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ color: '#525252', mb: 1 }}>
                  炮口初速: <strong>{velocity.toFixed(0)} m/s</strong>
                </Typography>
                <Slider
                  value={velocity}
                  min={100}
                  max={1500}
                  step={1}
                  onChange={(_, v) => setVelocity(v as number)}
                  sx={{
                    color: accentColor,
                    '& .MuiSlider-thumb': { width: 16, height: 16 },
                  }}
                />
              </Box>

              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={6}>
                  <TextField
                    label="阻力系数 (Cx)"
                    type="number"
                    size="small"
                    fullWidth
                    value={cx}
                    onChange={(e) => setCx(parseFloat(e.target.value) || 0)}
                    helperText="来自 WT datamine"
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* Angle */}
              <Typography variant="subtitle2" sx={{ color: '#171717', fontWeight: 600, mb: 2 }}>
                入射角度
              </Typography>
              <Typography variant="body2" sx={{ color: '#525252', mb: 1 }}>
                NATO 入射角: <strong>{natoAngle}°</strong>
              </Typography>
              <Slider
                value={natoAngle}
                min={0}
                max={75}
                step={1}
                onChange={(_, v) => setNatoAngle(v as number)}
                sx={{
                  color: '#3b82f6',
                  '& .MuiSlider-thumb': { width: 16, height: 16 },
                }}
              />

              {/* Formula explanation */}
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" sx={{ color: '#a3a3a3', lineHeight: 1.5, display: 'block' }}>
                {shellMode === 'AP'
                  ? 'P = (v¹·⁴³ × m⁰·⁷¹) / (K_fbr¹·⁴³ × (d/100)¹·⁰⁷) × 100 × knap × K_apcbc'
                  : 'P = (v¹·⁴³ × m_calc⁰·⁷¹) / (K_fbr¹·⁴³ × (d_core/10000)¹·⁰⁷)'}
                <br />
                {shellMode === 'AP'
                  ? `K_fbr=1900, K_apcbc=${isApcbc ? '1.0' : '0.9'}, knap=${knap.toFixed(3)}`
                  : `K_fbr=3000, 芯体占比=${mass > 0 ? ((coreMass / mass) * 100).toFixed(1) : '0'}%`}
              </Typography>
            </Paper>
          </Grid>

          {/* ═══ Right: Results ═══ */}
          <Grid item xs={12} md={7}>
            {/* Result Card */}
            <Paper
              elevation={2}
              sx={{
                p: 3,
                borderRadius: 2,
                mb: 3,
                background: isValid
                  ? 'linear-gradient(135deg, #1e3a5f 0%, #1a2744 100%)'
                  : 'linear-gradient(135deg, #525252 0%, #404040 100%)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Calculate sx={{ color: '#fff', fontSize: 28 }} />
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                  计算结果
                </Typography>
              </Box>

              {isValid ? (
                <Box>
                  {(() => {
                    const penDisplay = selectedPoint ? selectedPoint.penetration : displayPen;
                    const pen0Display = selectedPoint ? selectedPoint.pen0deg : basePen0;
                    const vDisplay = selectedPoint ? selectedPoint.velocityMs : velocity;
                    const dDisplay = selectedPoint ? selectedDistance : 0;
                    return (
                      <>
                        <Typography sx={{ color: '#fff', fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.2 }}>
                          {penDisplay.toFixed(1)} mm
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', mt: 0.5 }}>
                          {shellMode === 'APCR' ? 'APCR' : isApcbc ? 'APCBC' : 'AP'}
                          {natoAngle > 0 ? ` @ ${natoAngle}°` : ''}
                          {' '}· {dDisplay} m · {vDisplay.toFixed(0)} m/s
                        </Typography>
                        {natoAngle > 0 && (
                          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', mt: 0.5 }}>
                            0° 穿深: {pen0Display.toFixed(1)} mm · slopeEffect: {slopeEffectAtNormal(90 - natoAngle).toFixed(3)}
                          </Typography>
                        )}
                      </>
                    );
                  })()}

                  {initGamePen > 0 && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                      {(() => {
                        const curPen = selectedPoint ? selectedPoint.penetration : displayPen;
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
              ) : (
                <Typography sx={{ color: '#fca5a5', fontSize: '0.85rem' }}>
                  • 请输入有效的弹丸参数（口径、质量、速度需大于 0）
                </Typography>
              )}

              {/* Intermediate values */}
              {isValid && (
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <Grid container spacing={1}>
                    {shellMode === 'AP' ? (
                      <>
                        {[
                          { label: 'K_apcbc', value: isApcbc ? '1.0' : '0.9' },
                          { label: 'knap (炸药减弱)', value: knap.toFixed(3) },
                          { label: '炸药填充率', value: `${tntPct.toFixed(2)}%` },
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
                      </>
                    ) : (
                      <>
                        {[
                          { label: '芯体占比', value: `${mass > 0 ? ((coreMass / mass) * 100).toFixed(1) : '0'}%` },
                          { label: 'kf_pallet', value: mass > 0 && (coreMass / mass * 100 > 36) ? '0.5' : '0.4' },
                          { label: 'K_fbr', value: '3000' },
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
                      </>
                    )}
                  </Grid>
                </Box>
              )}
            </Paper>

            {/* Distance vs Penetration Chart */}
            <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#171717', fontWeight: 600 }}>
                  距离-穿深曲线{natoAngle > 0 ? ` (${natoAngle}° slopeEffect)` : ''}
                </Typography>
                {selectedPoint && (
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ color: accentColor, fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.1 }}>
                      {selectedPoint.penetration.toFixed(0)} mm
                    </Typography>
                    <Typography sx={{ color: '#737373', fontSize: '0.75rem' }}>
                      @ {selectedDistance} m · {selectedPoint.velocityMs.toFixed(0)} m/s
                      {natoAngle > 0 && ` · ${natoAngle}°`}
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
                            x1={padding.left} y1={scaleY(val)}
                            x2={chartWidth - padding.right} y2={scaleY(val)}
                            stroke="#e5e5e5" strokeWidth={1}
                          />
                          <text x={padding.left - 8} y={scaleY(val) + 4}
                            textAnchor="end" fontSize={11} fill="#737373">
                            {val.toFixed(0)}
                          </text>
                        </g>
                      ))}
                      {xTickValues.map((val, i) => (
                        <g key={`x-${i}`}>
                          <line
                            x1={scaleX(val)} y1={padding.top}
                            x2={scaleX(val)} y2={chartHeight - padding.bottom}
                            stroke="#e5e5e5" strokeWidth={1}
                          />
                          <text x={scaleX(val)} y={chartHeight - padding.bottom + 16}
                            textAnchor="middle" fontSize={11} fill="#737373">
                            {val.toFixed(0)}
                          </text>
                        </g>
                      ))}

                      {/* Axis labels */}
                      <text x={chartWidth / 2} y={chartHeight - 4}
                        textAnchor="middle" fontSize={12} fill="#525252">
                        距离 (m)
                      </text>
                      <text x={14} y={chartHeight / 2}
                        textAnchor="middle" fontSize={12} fill="#525252"
                        transform={`rotate(-90, 14, ${chartHeight / 2})`}>
                        穿深 (mm)
                      </text>

                      {/* Curve */}
                      <path d={pathD} fill="none" stroke={accentColor}
                        strokeWidth={2.5} strokeLinejoin="round" />

                      {/* Selected distance marker */}
                      {selectedPoint && selectedDistance <= dRange[1] && (
                        <>
                          <line
                            x1={scaleX(selectedDistance)} y1={padding.top}
                            x2={scaleX(selectedDistance)} y2={chartHeight - padding.bottom}
                            stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2"
                          />
                          <circle
                            cx={scaleX(selectedDistance)}
                            cy={scaleY(selectedPoint.penetration)}
                            r={5} fill="#ef4444" stroke="#fff" strokeWidth={2}
                          />
                        </>
                      )}
                    </svg>

                    {/* Distance slider */}
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
                      WT 弹道模型 (Cx={cx}, 口径={shellMode === 'APCR' ? coreCaliber : caliber}mm, 海平面标准大气)
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography sx={{ color: '#a3a3a3', textAlign: 'center', py: 4 }}>
                  调整参数后将显示距离-穿深曲线
                </Typography>
              )}
            </Paper>

            {/* Multi-angle penetration table */}
            {angleTable.length > 0 && (
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
                  数值 = de Marre 0° 穿深 / WT slopeEffect(apcbc)，与游戏资料卡一致
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
