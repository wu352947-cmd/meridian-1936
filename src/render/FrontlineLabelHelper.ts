/**
 * Handwritten curved labels (LXGW WenKai) along frontlines & offensive arrows with
 * local left-to-right orientation, curvature guard, and collision avoidance against cities & counters.
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Pt } from './frontlineGeometry';

export type ScreenBox = [number, number, number, number];

export interface LabelViewTransform {
  zoom: number;
  minX: number;
  minY: number;
  vw: number;
  vh: number;
}

/** Draw clean diagonal staff-pencil hatch lines clipped inside closed polygon rings. */
export function drawPolygonPencilHatch(
  g: Graphics,
  rings: readonly Pt[][],
  color: number,
  spacingWorld: number,
  strokeW: number,
  alpha = 0.42,
): void {
  for (const ring of rings) {
    if (ring.length < 3) continue;
    let minU = Infinity, maxU = -Infinity;
    const rot: Array<[number, number]> = [];
    for (const [x, y] of ring) {
      const u = x + y;
      const v = y - x;
      rot.push([u, v]);
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
    }

    const step = Math.max(4, spacingWorld * 1.414);
    for (let u = minU + step * 0.5; u < maxU; u += step) {
      const xs: number[] = [];
      for (let i = 0; i < rot.length; i++) {
        const [u0, v0] = rot[i]!;
        const [u1, v1] = rot[(i + 1) % rot.length]!;
        if ((u0 <= u && u1 > u) || (u1 <= u && u0 > u)) {
          const t = (u - u0) / (u1 - u0);
          xs.push(v0 + (v1 - v0) * t);
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const va = xs[k]!, vb = xs[k + 1]!;
        if (vb - va < 3) continue;
        g.moveTo((u - va) * 0.5, (u + va) * 0.5).lineTo((u - vb) * 0.5, (u + vb) * 0.5);
      }
    }
    g.stroke({ width: strokeW, color, alpha, cap: 'round' });
    g.moveTo(ring[0]![0], ring[0]![1]);
    for (let i = 1; i < ring.length; i++) g.lineTo(ring[i]![0], ring[i]![1]);
    g.closePath();
    g.stroke({ width: strokeW * 1.2, color, alpha: alpha * 0.9, join: 'round' });
  }
}

function sampleCurveAtDist(pts: readonly Pt[], cum: readonly number[], dist: number): { x: number; y: number; angle: number } {
  const total = cum[cum.length - 1] ?? 1;
  const d = Math.max(0, Math.min(total, dist));
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1]! < d) i++;
  const segLen = Math.max(0.001, cum[i + 1]! - cum[i]!);
  const t = (d - cum[i]!) / segLen;
  const a = pts[i]!, b = pts[i + 1]!;
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}

function overlapsAny(box: ScreenBox, placed: readonly ScreenBox[]): boolean {
  for (const [ax0, ay0, ax1, ay1] of placed) {
    if (box[0] < ax1 && box[2] > ax0 && box[1] < ay1 && box[3] > ay0) return true;
  }
  return false;
}

/**
 * Place a handwritten LXGW WenKai label curved along a world-space polyline.
 * Guarantees local left-to-right reading order, avoids tight bends, hides at LOD 0, and never overlaps cities/counters.
 */
export function tryPlaceCurvedStaffLabel(
  parent: Container,
  rawPts: readonly Pt[],
  labelText: string,
  accentColor: string,
  view: LabelViewTransform,
  placedBoxes: ScreenBox[],
  normalOffsetWorld = 0,
): boolean {
  if (view.zoom < 1.05 || rawPts.length < 2 || !labelText) return false;

  const cum: number[] = [0];
  for (let i = 1; i < rawPts.length; i++) {
    cum.push(cum[i - 1]! + Math.hypot(rawPts[i]![0] - rawPts[i - 1]![0], rawPts[i]![1] - rawPts[i - 1]![1]));
  }
  const totalWorld = cum[cum.length - 1]!;
  const chars = Array.from(labelText);
  const fontPx = view.zoom >= 2.2 ? 12.5 : 11.5;
  const charStepWorld = (fontPx * 0.96) / view.zoom;
  const spanWorld = charStepWorld * (chars.length - 1);
  if (totalWorld < spanWorld + charStepWorld * 1.4) return false;

  const toSx = (wx: number) => (wx - view.minX) * view.zoom;
  const toSy = (wy: number) => (wy - view.minY) * view.zoom;
  const halfPx = fontPx * 0.58;

  for (const frac of [0.5, 0.35, 0.65, 0.24, 0.76]) {
    const startD = totalWorld * frac - spanWorld * 0.5;
    const endD = startD + spanWorld;
    if (startD < charStepWorld * 0.4 || endD > totalWorld - charStepWorld * 0.4) continue;

    // Determine LOCAL left-to-right reading direction strictly on this sub-span!
    const pA = sampleCurveAtDist(rawPts, cum, startD);
    const pB = sampleCurveAtDist(rawPts, cum, endD);
    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const chordLen = Math.hypot(dx, dy);
    if (chordLen < spanWorld * 0.64) continue;
    const reverseSpan = dx < -8 || (Math.abs(dx) <= 8 && dy < 0);

    for (const offSign of [1, -1]) {
      const glyphs: Array<{ ch: string; wx: number; wy: number; rot: number; box: ScreenBox }> = [];
      let blocked = false;
      let prevAngle: number | null = null;

      for (let i = 0; i < chars.length; i++) {
        const d = reverseSpan ? endD - i * charStepWorld : startD + i * charStepWorld;
        const sm = sampleCurveAtDist(rawPts, cum, d);
        let angle = reverseSpan ? sm.angle + Math.PI : sm.angle;
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        if (angle > Math.PI * 0.64 || angle < -Math.PI * 0.64) {
          blocked = true;
          break;
        }
        if (prevAngle !== null && Math.abs(angle - prevAngle) > 0.72) {
          blocked = true;
          break;
        }
        prevAngle = angle;

        const nx = Math.sin(angle) * offSign;
        const ny = -Math.cos(angle) * offSign;
        const wx = sm.x + nx * normalOffsetWorld;
        const wy = sm.y + ny * normalOffsetWorld;
        const sx = toSx(wx);
        const sy = toSy(wy);
        const box: ScreenBox = [sx - halfPx - 1, sy - halfPx - 1, sx + halfPx + 1, sy + halfPx + 1];
        if (box[0] < 16 || box[1] < 72 || box[2] > view.vw - 16 || box[3] > view.vh - 115) {
          blocked = true;
          break;
        }
        if (overlapsAny(box, placedBoxes)) {
          blocked = true;
          break;
        }
        glyphs.push({ ch: chars[i]!, wx, wy, rot: Math.max(-0.78, Math.min(0.78, angle)), box });
      }

      if (!blocked && glyphs.length === chars.length) {
        const style = new TextStyle({
          fontFamily: 'MeridianWenKai, "LXGW WenKai Screen", "Noto Serif CJK SC", serif',
          fontSize: fontPx,
          fontWeight: '600',
          fill: '#FCF5E5',
          stroke: { color: '#1B1511', width: 3.3, join: 'round' },
          dropShadow: { color: accentColor, alpha: 0.48, blur: 2, distance: 0.8, angle: Math.PI / 4 },
        });
        const inv = 1 / view.zoom;
        for (const g of glyphs) {
          const t = new Text({ text: g.ch, style });
          t.resolution = 2;
          t.anchor.set(0.5, 0.5);
          t.position.set(g.wx, g.wy);
          t.rotation = g.rot;
          t.scale.set(inv);
          parent.addChild(t);
          placedBoxes.push(g.box);
        }
        return true;
      }
      if (normalOffsetWorld === 0) break;
    }
  }
  return false;
}
