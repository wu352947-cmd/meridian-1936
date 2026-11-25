/**
 * Continuous frontline arc stitching & smooth cubic Bezier offensive arrow geometry.
 * Ensures gap-free, jitter-free staff frontlines and tear-free curved arrows.
 */
import type { DecodedArc } from './BorderMeshBuilder';

export type Pt = [number, number];

export interface StitchedChain {
  points: Pt[];
  /** +1 or -1 normal multiplier pointing toward friendly interior. */
  friendlySign: number;
}

const ENDPOINT_EPS = 6.5;

function dist2(a: Pt, b: Pt): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/** Stitch raw point segments sharing endpoints into continuous smooth polylines. */
export function stitchSegmentsToPolylines(segs: readonly Pt[][], smooth = true): Pt[][] {
  const used = new Array<boolean>(segs.length).fill(false);
  const chains: Pt[][] = [];
  const eps2 = ENDPOINT_EPS * ENDPOINT_EPS;

  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const chain = segs[i]!.slice();

    let extended = true;
    while (extended) {
      extended = false;
      const head = chain[0]!;
      const tail = chain[chain.length - 1]!;
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        const s = segs[j]!;
        const sHead = s[0]!;
        const sTail = s[s.length - 1]!;

        if (dist2(tail, sHead) <= eps2) {
          for (let k = 1; k < s.length; k++) chain.push(s[k]!);
          used[j] = true;
          extended = true;
          break;
        }
        if (dist2(tail, sTail) <= eps2) {
          for (let k = s.length - 2; k >= 0; k--) chain.push(s[k]!);
          used[j] = true;
          extended = true;
          break;
        }
        if (dist2(head, sTail) <= eps2) {
          for (let k = s.length - 2; k >= 0; k--) chain.unshift(s[k]!);
          used[j] = true;
          extended = true;
          break;
        }
        if (dist2(head, sHead) <= eps2) {
          for (let k = 1; k < s.length; k++) chain.unshift(s[k]!);
          used[j] = true;
          extended = true;
          break;
        }
      }
    }
    if (chain.length >= 2) chains.push(smooth ? smoothPolyline(chain) : chain);
  }
  return chains;
}

/** Extract outer boundary polylines around a set of provinces (used for target hatching & pocket rings). */
export function extractRegionBoundaryPolylines(
  arcs: readonly DecodedArc[],
  provSet: ReadonlySet<number>,
  smooth = false,
): Pt[][] {
  const segs: Pt[][] = [];
  for (const arc of arcs) {
    if (arc.points.length < 2) continue;
    let hasIn = false;
    let hasOut = false;
    for (const pid of arc.provIds) {
      if (provSet.has(pid)) hasIn = true;
      else hasOut = true;
    }
    if (hasIn && (hasOut || arc.hasSea || arc.provIds.size === 1)) {
      segs.push(arc.points.map((p) => [p[0], p[1]] as Pt));
    }
  }
  return stitchSegmentsToPolylines(segs, smooth);
}

/** Stitch topology arcs along the LIVE contact boundary between ownerTag and targetTag. */
export function stitchFrontlineArcs(
  arcs: readonly DecodedArc[],
  ownerTag: string,
  targetTag: string,
  friendlyProvSet: ReadonlySet<number>,
  sampleController: (wx: number, wy: number) => string | null,
  getProvController?: (provId: number) => string | null,
): StitchedChain[] {
  const segs: Pt[][] = [];
  for (const arc of arcs) {
    if (!arc.hasLand || arc.hasSea || arc.points.length < 2) continue;
    let hasOwner = false;
    let hasTarget = false;
    let matchFriendly = friendlyProvSet.size === 0;
    for (const pid of arc.provIds) {
      const ctrl = getProvController ? getProvController(pid) : null;
      if (ctrl === ownerTag) {
        hasOwner = true;
        if (friendlyProvSet.has(pid)) matchFriendly = true;
      } else if (ctrl === targetTag) {
        hasTarget = true;
      }
    }
    if (!getProvController) {
      if (!arc.owners.has(ownerTag) || !arc.owners.has(targetTag)) continue;
      for (const pid of arc.provIds) {
        if (friendlyProvSet.has(pid)) {
          matchFriendly = true;
          break;
        }
      }
    } else if (!hasOwner || !hasTarget) {
      continue;
    }
    if (!matchFriendly) continue;
    segs.push(arc.points.map((p) => [p[0], p[1]] as Pt));
  }

  const chains = stitchSegmentsToPolylines(segs, true);
  return chains.map((points) => ({
    points,
    friendlySign: detectFriendlyNormalSign(points, ownerTag, sampleController),
  }));
}

/** Find nearest sample point on a frontline to snap an offensive arrow tail cleanly. */
export function snapPointToFrontline(target: Pt, samples: readonly OffsetSample[]): Pt | null {
  if (samples.length === 0) return null;
  let best = samples[0]!;
  let bestD2 = Infinity;
  for (const sm of samples) {
    const dx = sm.x - target[0];
    const dy = sm.y - target[1];
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = sm;
    }
  }
  return [best.x, best.y];
}

/** Gentle 2-pass smoothing preserving endpoints to eliminate micro-sawtooth vertex noise. */
function smoothPolyline(pts: Pt[]): Pt[] {
  if (pts.length <= 3) return pts;
  let cur = pts;
  for (let pass = 0; pass < 2; pass++) {
    const next: Pt[] = [cur[0]!];
    for (let i = 1; i < cur.length - 1; i++) {
      const a = cur[i - 1]!;
      const b = cur[i]!;
      const c = cur[i + 1]!;
      next.push([
        a[0] * 0.22 + b[0] * 0.56 + c[0] * 0.22,
        a[1] * 0.22 + b[1] * 0.56 + c[1] * 0.22,
      ]);
    }
    next.push(cur[cur.length - 1]!);
    cur = next;
  }
  return cur;
}

function detectFriendlyNormalSign(
  pts: Pt[],
  ownerTag: string,
  sampleOwner: (wx: number, wy: number) => string | null,
): number {
  let votesPlus = 0;
  let votesMinus = 0;
  const step = Math.max(1, Math.floor((pts.length - 1) / 7));
  for (let i = 0; i < pts.length - 1; i += step) {
    const p0 = pts[i]!;
    const p1 = pts[i + 1]!;
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.2) continue;
    const nx = -dy / len;
    const ny = dx / len;
    const mx = (p0[0] + p1[0]) * 0.5;
    const my = (p0[1] + p1[1]) * 0.5;
    if (sampleOwner(mx + nx * 5, my + ny * 5) === ownerTag) votesPlus++;
    if (sampleOwner(mx - nx * 5, my - ny * 5) === ownerTag) votesMinus++;
  }
  return votesPlus >= votesMinus ? 1 : -1;
}

export interface OffsetSample {
  x: number;
  y: number;
  nx: number;
  ny: number;
  dist: number;
}

/** Resample chain into evenly spaced points offset slightly toward the friendly side. */
export function buildOffsetFrontlineSamples(chain: StitchedChain, offsetPx: number, spacingPx: number): OffsetSample[] {
  const pts = chain.points;
  if (pts.length < 2) return [];
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  }
  const totalLen = cum[cum.length - 1]!;
  if (totalLen < 2) return [];

  const count = Math.max(2, Math.ceil(totalLen / Math.max(2, spacingPx)));
  const raw: Pt[] = [];
  let seg = 0;
  for (let i = 0; i <= count; i++) {
    const targetD = (i / count) * totalLen;
    while (seg < cum.length - 2 && cum[seg + 1]! < targetD) seg++;
    const segLen = Math.max(0.001, cum[seg + 1]! - cum[seg]!);
    const t = Math.max(0, Math.min(1, (targetD - cum[seg]!) / segLen));
    const a = pts[seg]!;
    const b = pts[seg + 1]!;
    raw.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }

  const out: OffsetSample[] = [];
  for (let i = 0; i < raw.length; i++) {
    const prev = raw[Math.max(0, i - 1)]!;
    const next = raw[Math.min(raw.length - 1, i + 1)]!;
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.max(0.001, Math.hypot(dx, dy));
    const nx = (-dy / len) * chain.friendlySign;
    const ny = (dx / len) * chain.friendlySign;
    out.push({
      x: raw[i]![0] + nx * offsetPx,
      y: raw[i]![1] + ny * offsetPx,
      nx,
      ny,
      dist: (i / count) * totalLen,
    });
  }
  return out;
}

export interface BezierSample {
  x: number;
  y: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  s: number;
}

/** Sample a smooth cubic Bezier curve from p0 to p3 with analytic tangents and normals. */
export function sampleCubicArrow(
  p0: Pt,
  p3: Pt,
  bendX = 0,
  bendY = 0,
  steps = 30,
): { samples: BezierSample[]; totalLen: number } {
  const dx = p3[0] - p0[0];
  const dy = p3[1] - p0[1];
  const chord = Math.max(1, Math.hypot(dx, dy));
  const defBend = bendX === 0 && bendY === 0 ? chord * 0.16 : 0;
  const px = -dy / chord;
  const py = dx / chord;
  const bx = bendX + px * defBend;
  const by = bendY + py * defBend;

  const p1: Pt = [p0[0] + dx * 0.33 + bx, p0[1] + dy * 0.33 + by];
  const p2: Pt = [p0[0] + dx * 0.68 + bx * 0.72, p0[1] + dy * 0.68 + by * 0.72];

  const samples: BezierSample[] = [];
  let accum = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    const dtx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
    const dty = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
    const tl = Math.max(0.001, Math.hypot(dtx, dty));
    if (i > 0) {
      const prev = samples[i - 1]!;
      accum += Math.hypot(x - prev.x, y - prev.y);
    }
    const tx = dtx / tl;
    const ty = dty / tl;
    samples.push({ x, y, tx, ty, nx: -ty, ny: tx, s: accum });
  }
  return { samples, totalLen: accum };
}
