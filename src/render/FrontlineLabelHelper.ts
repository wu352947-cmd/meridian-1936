/**
 * Handwritten curved labels (LXGW WenKai) along frontlines & offensive arrows with
 * local left-to-right orientation, curvature guard, and collision avoidance against cities & counters.
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { OffsetSample, Pt } from './frontlineGeometry';

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

interface SpinePt {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

function smoothSpine(samples: readonly SpinePt[], passes = 4): SpinePt[] {
  if (samples.length <= 2) return samples.slice();
  let cur = samples.map((s) => ({ ...s }));
  for (let p = 0; p < passes; p++) {
    const next: SpinePt[] = [cur[0]!];
    for (let i = 1; i < cur.length - 1; i++) {
      const a = cur[i - 1]!, b = cur[i]!, c = cur[i + 1]!;
      const nx = a.nx * 0.25 + b.nx * 0.5 + c.nx * 0.25;
      const ny = a.ny * 0.25 + b.ny * 0.5 + c.ny * 0.25;
      const nl = Math.max(0.001, Math.hypot(nx, ny));
      next.push({
        x: a.x * 0.25 + b.x * 0.5 + c.x * 0.25,
        y: a.y * 0.25 + b.y * 0.5 + c.y * 0.25,
        nx: nx / nl,
        ny: ny / nl,
      });
    }
    next.push(cur[cur.length - 1]!);
    cur = next;
  }
  return cur;
}

function ptsToSpine(rawPts: readonly Pt[]): SpinePt[] {
  const out: SpinePt[] = [];
  for (let i = 0; i < rawPts.length; i++) {
    const a = rawPts[Math.max(0, i - 1)]!;
    const b = rawPts[Math.min(rawPts.length - 1, i + 1)]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.max(0.001, Math.hypot(dx, dy));
    out.push({ x: rawPts[i]![0], y: rawPts[i]![1], nx: -dy / len, ny: dx / len });
  }
  return smoothSpine(out, 2);
}

function glyphAdvancePx(ch: string, fontPx: number): number {
  if (ch === ' ') return fontPx * 0.34;
  if (ch === '·') return fontPx * 0.56;
  if (ch === '→') return fontPx * 0.90;
  if (/^[\x21-\x7E]$/.test(ch)) return fontPx * 0.64;
  return fontPx * 1.05;
}

function inHudSafe(box: ScreenBox, vw: number, vh: number): boolean {
  if (box[0] < 16 || box[1] < 16 || box[2] > vw - 16 || box[3] > vh - 68) return false;
  if (box[0] < 550 && box[1] < 74) return false;
  if (box[2] > vw - 430 && box[1] < 142) return false;
  if (box[0] < 500 && box[3] > vh - 124) return false;
  return true;
}

function boxClearance(box: ScreenBox, placed: readonly ScreenBox[]): number {
  let minGap = 40;
  for (const [ax0, ay0, ax1, ay1] of placed) {
    const gx = Math.max(ax0 - box[2], box[0] - ax1);
    const gy = Math.max(ay0 - box[3], box[1] - ay1);
    if (gx < 0 && gy < 0) return -1;
    const gap = Math.max(gx, gy);
    if (gap < minGap) minGap = gap;
  }
  return minGap;
}

function createLabelStyle(fontPx: number, variant: 'ink' | 'light'): TextStyle {
  return variant === 'ink'
    ? new TextStyle({
        fontFamily: 'MeridianWenKai, "LXGW WenKai Screen", "Noto Serif CJK SC", serif',
        fontSize: fontPx,
        fontWeight: '700',
        fill: '#1A130D',
        stroke: { color: '#F5EAD0', width: 4.8, join: 'round' },
        dropShadow: { color: '#F7EED9', alpha: 0.86, blur: 4, distance: 0, angle: 0 },
      })
    : new TextStyle({
        fontFamily: 'MeridianWenKai, "LXGW WenKai Screen", "Noto Serif CJK SC", serif',
        fontSize: fontPx,
        fontWeight: '700',
        fill: '#FFF8EA',
        stroke: { color: '#18120D', width: 4.4, join: 'round' },
        dropShadow: { color: '#120D09', alpha: 0.62, blur: 3, distance: 1, angle: Math.PI / 4 },
      });
}

interface PlacedCandidate {
  score: number;
  variant: 'ink' | 'light';
  fontPx: number;
  glyphs: Array<{ ch: string; wx: number; wy: number; rot: number; box: ScreenBox }>;
}

function buildOffsetCurve(spine: readonly SpinePt[], offWorld: number): { pts: Pt[]; cum: number[] } {
  const raw: Pt[] = spine.map((s) => [s.x + s.nx * offWorld, s.y + s.ny * offWorld]);
  let cur = raw;
  for (let p = 0; p < 2 && cur.length > 2; p++) {
    const next: Pt[] = [cur[0]!];
    for (let i = 1; i < cur.length - 1; i++) {
      const a = cur[i - 1]!, b = cur[i]!, c = cur[i + 1]!;
      next.push([a[0] * 0.25 + b[0] * 0.5 + c[0] * 0.25, a[1] * 0.25 + b[1] * 0.5 + c[1] * 0.25]);
    }
    next.push(cur[cur.length - 1]!);
    cur = next;
  }
  const cum: number[] = [0];
  for (let i = 1; i < cur.length; i++) {
    cum.push(cum[i - 1]! + Math.hypot(cur[i]![0] - cur[i - 1]![0], cur[i]![1] - cur[i - 1]![1]));
  }
  return { pts: cur, cum };
}

function samplePtAt(pts: readonly Pt[], cum: readonly number[], dist: number): Pt {
  const total = cum[cum.length - 1] ?? 1;
  const d = Math.max(0, Math.min(total, dist));
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1]! < d) i++;
  const segLen = Math.max(0.001, cum[i + 1]! - cum[i]!);
  const t = (d - cum[i]!) / segLen;
  const a = pts[i]!, b = pts[i + 1]!;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function searchBestPlacement(
  spines: readonly SpinePt[][],
  labelText: string,
  fontPx: number,
  offsetsPx: readonly number[],
  view: LabelViewTransform,
  placedBoxes: readonly ScreenBox[],
  isArrow: boolean,
  maxTurn = 0.62,
): PlacedCandidate | null {
  const chars = Array.from(labelText);
  if (chars.length === 0) return null;
  const advPx = chars.map((ch) => glyphAdvancePx(ch, fontPx));
  const offsetsFromStartPx: number[] = [];
  let cursor = 0;
  for (let i = 0; i < advPx.length; i++) {
    offsetsFromStartPx.push(cursor + advPx[i]! * 0.5);
    cursor += advPx[i]!;
  }
  const spanWorld = cursor / view.zoom;
  const tanWin = Math.max(3, (fontPx * 0.72) / view.zoom);
  const toSx = (wx: number) => (wx - view.minX) * view.zoom;
  const toSy = (wy: number) => (wy - view.minY) * view.zoom;
  const halfH = fontPx * 0.56 + 1.5;
  let best: PlacedCandidate | null = null;

  for (const spine of spines) {
    if (spine.length < 2) continue;
    for (const offPx of offsetsPx) {
      const offWorld = offPx / view.zoom;
      const { pts: offPts, cum } = buildOffsetCurve(spine, offWorld);
      const totalWorld = cum[cum.length - 1]!;
      if (totalWorld < spanWorld + 4 / view.zoom) continue;

      const margin = Math.min(spanWorld * 0.06, 6 / view.zoom);
      const minMid = spanWorld * 0.5 + margin;
      const maxMid = totalWorld - spanWorld * 0.5 - margin;
      const step = Math.max(14 / view.zoom, spanWorld * 0.12);

      for (let midD = minMid; midD <= maxMid + 0.01; midD += step) {
        const clampedMid = Math.min(midD, maxMid);
        const mPt = samplePtAt(offPts, cum, clampedMid);
        const msx = toSx(mPt[0]), msy = toSy(mPt[1]);
        if (msx < -30 || msx > view.vw + 30 || msy < 20 || msy > view.vh - 20) continue;

        const startD = clampedMid - spanWorld * 0.5;
        const endD = startD + spanWorld;
        const pA = samplePtAt(offPts, cum, startD);
        const pB = samplePtAt(offPts, cum, endD);
        const dx = pB[0] - pA[0], dy = pB[1] - pA[1];
        if (Math.hypot(dx, dy) < spanWorld * 0.55) continue;
        const reverseSpan = dx < -2 || (Math.abs(dx) <= 2 && dy < 0);

        const glyphs: PlacedCandidate['glyphs'] = [];
        let blocked = false;
        let prevAngle: number | null = null;
        let totalTurn = 0, sumAbsAng = 0, minClear = 40;

        for (let i = 0; i < chars.length; i++) {
          const distRel = offsetsFromStartPx[i]! / view.zoom;
          const d = reverseSpan ? endD - distRel : startD + distRel;
          const [wx, wy] = samplePtAt(offPts, cum, d);
          const tA = samplePtAt(offPts, cum, Math.max(0, d - tanWin));
          const tB = samplePtAt(offPts, cum, Math.min(totalWorld, d + tanWin));
          let angle = Math.atan2(tB[1] - tA[1], tB[0] - tA[0]);
          if (reverseSpan) angle += Math.PI;
          while (angle > Math.PI) angle -= Math.PI * 2;
          while (angle < -Math.PI) angle += Math.PI * 2;
          if (Math.abs(angle) > Math.PI * 0.62) { blocked = true; break; }
          if (prevAngle !== null) {
            const turn = Math.abs(angle - prevAngle);
            if (turn > maxTurn) { blocked = true; break; }
            totalTurn += turn;
          }
          prevAngle = angle;
          sumAbsAng += Math.abs(angle);

          const sx = toSx(wx), sy = toSy(wy);
          if (i > 0) {
            const prev = glyphs[i - 1]!;
            const stepPx = Math.hypot(sx - toSx(prev.wx), sy - toSy(prev.wy));
            const idealStep = (advPx[i - 1]! + advPx[i]!) * 0.5;
            if (stepPx < idealStep * 0.72) { blocked = true; break; }
          }
          for (let j = 0; j < i - 1; j++) {
            const other = glyphs[j]!;
            if (Math.hypot(sx - toSx(other.wx), sy - toSy(other.wy)) < (advPx[j]! + advPx[i]!) * 0.46) {
              blocked = true;
              break;
            }
          }
          if (blocked) break;

          const halfW = advPx[i]! * 0.52 + 1.5;
          const box: ScreenBox = [sx - halfW, sy - halfH, sx + halfW, sy + halfH];
          if (!inHudSafe(box, view.vw, view.vh)) { blocked = true; break; }
          const clr = boxClearance(box, placedBoxes);
          if (clr < 0) { blocked = true; break; }
          if (clr < minClear) minClear = clr;
          glyphs.push({ ch: chars[i]!, wx, wy, rot: Math.max(-1.32, Math.min(1.32, angle)), box });
        }

        if (!blocked && glyphs.length === chars.length) {
          const cxNorm = Math.hypot((msx - view.vw * 0.5) / view.vw, (msy - view.vh * 0.5) / view.vh);
          const sideBonus = isArrow ? (offPx === 0 ? 48 : 0) : (offPx > 0 ? 32 : 0);
          const score = 100 + sideBonus - Math.abs(offPx) * 0.85 - totalTurn * 46 - (sumAbsAng / chars.length) * 18 + Math.min(28, minClear) * 1.05 - cxNorm * 16;
          if (!best || score > best.score) {
            best = { score, variant: isArrow && offPx === 0 ? 'light' : 'ink', fontPx, glyphs };
          }
        }
      }
    }
  }
  return best;
}

function commitCandidate(parent: Container, cand: PlacedCandidate, view: LabelViewTransform, placedBoxes: ScreenBox[]): void {
  const style = createLabelStyle(cand.fontPx, cand.variant);
  const inv = 1 / view.zoom;
  for (const g of cand.glyphs) {
    const t = new Text({ text: g.ch, style });
    t.resolution = 2;
    t.anchor.set(0.5, 0.5);
    t.position.set(g.wx, g.wy);
    t.rotation = g.rot;
    t.scale.set(inv);
    parent.addChild(t);
    placedBoxes.push([g.box[0] - 2, g.box[1] - 2, g.box[2] + 2, g.box[3] + 2]);
  }
}

/** Place a high-contrast LXGW WenKai curved label along an army's visible frontline chains (hidden at LOD 0). */
export function tryPlaceFrontlineLabel(
  parent: Container,
  chainSamples: readonly OffsetSample[][],
  labelText: string,
  view: LabelViewTransform,
  placedBoxes: ScreenBox[],
): boolean {
  if (view.zoom < 1.05 || chainSamples.length === 0 || !labelText) return false;
  const spines = chainSamples.map((ch) => smoothSpine(ch, 6));
  const primaryPx = view.zoom >= 2.0 ? 15 : view.zoom >= 1.55 ? 14 : 13.5;

  let cand = searchBestPlacement(spines, labelText, primaryPx, [14, 19, -17, -22], view, placedBoxes, false, 0.58);
  if (!cand) {
    cand = searchBestPlacement(spines, labelText, 13, [13, 18, 24, -16, -21, -26], view, placedBoxes, false, 0.72);
  }
  if (!cand) {
    const compact = labelText.replace(/^(第\d+)[^\s·]*(集团军|方面军|集群)/, '$1$2');
    if (compact !== labelText) {
      cand = searchBestPlacement(spines, compact, 13, [13, 18, 24, -16, -21, -26], view, placedBoxes, false, 0.76);
    }
  }
  if (!cand) return false;
  commitCandidate(parent, cand, view, placedBoxes);
  return true;
}

/** Place a crisp curved LXGW WenKai label along an offensive arrow (light-on-arrow, ink-on-map fallback). */
export function tryPlaceArrowLabel(
  parent: Container,
  rawPts: readonly Pt[],
  labelText: string,
  view: LabelViewTransform,
  placedBoxes: ScreenBox[],
): boolean {
  if (view.zoom < 1.05 || rawPts.length < 2 || !labelText) return false;
  const spines = [ptsToSpine(rawPts)];
  const primaryPx = view.zoom >= 2.0 ? 14.5 : 13.5;
  const cand =
    searchBestPlacement(spines, labelText, primaryPx, [0, 16, -16, 22, -22], view, placedBoxes, true) ??
    searchBestPlacement(spines, labelText, 13, [0, 15, -15, 21, -21], view, placedBoxes, true);
  if (!cand) return false;
  commitCandidate(parent, cand, view, placedBoxes);
  return true;
}
