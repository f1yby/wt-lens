/**
 * Calculate BR gradient color based on distance from current vehicle BR.
 * Negative brDiff (lower BR) -> blue (hue 240)
 * Zero (same BR) -> green (hue 120)
 * Positive brDiff (higher BR) -> red (hue 0)
 */
export function getBRGradientColor(
  brDiff: number,
  lowerSpan: number = 1.0,
  upperSpan: number = 1.0,
): string {
  let normalized: number;
  if (brDiff <= 0) {
    normalized = Math.max(brDiff / Math.max(lowerSpan, 0.1), -1);
  } else {
    normalized = Math.min(brDiff / Math.max(upperSpan, 0.1), 1);
  }
  const hue = 120 - normalized * 120;
  return `hsl(${hue}, 75%, 50%)`;
}

/**
 * Render a star SVG polygon points string for scatter chart markers.
 */
export function starPolygonPoints(cx: number, cy: number, outerRadius: number = 8): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : outerRadius / 2.5;
    points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return points.join(' ');
}
