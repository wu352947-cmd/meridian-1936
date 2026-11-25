/**
 * Deterministic Land A* Shortest Travel-Time Pathfinding (Carbon §4.9.4 + Batch 05 §3).
 * Uses fixed-point tick-permille costs with terrain march speed multipliers and strict
 * prohibition against entering non-hostile foreign territory. Pure TS, zero DOM/PIXI.
 */
import { clampInt, FIXED_SCALE } from '../core/FixedMath';
import { TERRAIN_MARCH_MULT_PERMILLE } from '../data/brigadeTemplates';
import { getSimProvince, type SimProvince } from '../data/provinces1936';

export interface PathResult {
  /** Sequence of province IDs to traverse (excludes startProvId, includes goalProvId). */
  path: number[];
  /** Total march duration in tick-permille (1000 = 1 six-hour tick). */
  totalTicksFixed: number;
}

export interface FindPathOptions {
  startProvId: number;
  goalProvId: number;
  ownerTag: string;
  speedTenth: number;
  speedModPermille?: number;
  /** Optional hostile tags that units are permitted to enter (default: none — own territory only). */
  hostileTags?: ReadonlySet<string>;
  /** Optional dynamic province controller resolver (defaults to static 1936 owner). */
  getController?: (provId: number) => string;
}

const DIST_TIME_FACTOR = 2600;

export function calcEffectiveSpeedTenth(speedTenth: number, speedModPermille = 0): number {
  const mult = clampInt(FIXED_SCALE + speedModPermille, 500, 3000);
  return Math.max(10, Math.floor((Math.max(10, speedTenth) * mult) / FIXED_SCALE));
}

export function calcEdgeMarchTicksFixed(
  from: SimProvince,
  to: SimProvince,
  speedTenth: number,
  speedModPermille = 0,
): number {
  const dist = Math.max(10, Math.round(Math.hypot(to.cx - from.cx, to.cy - from.cy)));
  const effSpd = calcEffectiveSpeedTenth(speedTenth, speedModPermille);
  const terrainMult = TERRAIN_MARCH_MULT_PERMILLE[to.terrain] ?? FIXED_SCALE;
  const effRate = Math.max(1, Math.floor((effSpd * terrainMult) / FIXED_SCALE));
  return Math.max(FIXED_SCALE, Math.floor((dist * DIST_TIME_FACTOR) / effRate));
}

function canTraverse(
  prov: SimProvince,
  ownerTag: string,
  hostileTags?: ReadonlySet<string>,
  getController?: (provId: number) => string,
): boolean {
  const ctrl = getController ? getController(prov.id) : prov.owner;
  if (ctrl === ownerTag) return true;
  if (hostileTags && hostileTags.has(ctrl)) return true;
  return false;
}

export function findLandPath(opts: FindPathOptions): PathResult | null {
  const { startProvId, goalProvId, ownerTag, speedTenth, speedModPermille = 0, hostileTags, getController } = opts;
  const start = getSimProvince(startProvId);
  const goal = getSimProvince(goalProvId);
  if (!start || !goal) return null;
  if (startProvId === goalProvId) {
    return canTraverse(goal, ownerTag, hostileTags, getController) ? { path: [], totalTicksFixed: 0 } : null;
  }
  if (!canTraverse(goal, ownerTag, hostileTags, getController)) return null;

  const maxSpeedTenth = calcEffectiveSpeedTenth(speedTenth, speedModPermille);
  const heuristic = (p: SimProvince): number => {
    const d = Math.round(Math.hypot(goal.cx - p.cx, goal.cy - p.cy));
    return Math.floor((d * DIST_TIME_FACTOR) / maxSpeedTenth);
  };

  const gScore = new Map<number, number>([[startProvId, 0]]);
  const fScore = new Map<number, number>([[startProvId, heuristic(start)]]);
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();
  const open: number[] = [startProvId];
  const inOpen = new Set<number>([startProvId]);

  while (open.length > 0) {
    // Deterministic min extraction: smallest f, then smallest g, then smallest provId
    let bestIdx = 0;
    let curId = open[0]!;
    let bestF = fScore.get(curId) ?? Infinity;
    let bestG = gScore.get(curId) ?? Infinity;
    for (let i = 1; i < open.length; i++) {
      const id = open[i]!;
      const f = fScore.get(id) ?? Infinity;
      const g = gScore.get(id) ?? Infinity;
      if (f < bestF || (f === bestF && (g < bestG || (g === bestG && id < curId)))) {
        bestIdx = i;
        curId = id;
        bestF = f;
        bestG = g;
      }
    }

    open.splice(bestIdx, 1);
    inOpen.delete(curId);

    if (curId === goalProvId) {
      const path: number[] = [];
      let trace: number | undefined = goalProvId;
      while (trace !== undefined && trace !== startProvId) {
        path.push(trace);
        trace = cameFrom.get(trace);
      }
      path.reverse();
      return { path, totalTicksFixed: gScore.get(goalProvId) ?? 0 };
    }

    closed.add(curId);
    const curProv = getSimProvince(curId)!;
    const curG = gScore.get(curId) ?? 0;

    for (const nbId of curProv.neighbors) {
      if (closed.has(nbId)) continue;
      const nb = getSimProvince(nbId);
      if (!nb || !canTraverse(nb, ownerTag, hostileTags, getController)) continue;

      const stepCost = calcEdgeMarchTicksFixed(curProv, nb, speedTenth, speedModPermille);
      const tentG = curG + stepCost;
      const prevG = gScore.get(nbId);
      if (prevG === undefined || tentG < prevG) {
        cameFrom.set(nbId, curId);
        gScore.set(nbId, tentG);
        fScore.set(nbId, tentG + heuristic(nb));
        if (!inOpen.has(nbId)) {
          open.push(nbId);
          inOpen.add(nbId);
        }
      }
    }
  }

  return null;
}

/** Estimate total remaining march ticks (ceil integer) for a brigade already mid-path. */
export function estimateRemainingTicks(
  currentProvId: number,
  path: readonly number[],
  moveProgressFixed: number,
  moveEdgeCostFixed: number,
  speedTenth: number,
  speedModPermille = 0,
): number {
  if (path.length === 0) return 0;
  let totalFixed = Math.max(0, moveEdgeCostFixed - moveProgressFixed);
  let prev = getSimProvince(path[0]!);
  for (let i = 1; i < path.length; i++) {
    const next = getSimProvince(path[i]!);
    if (prev && next) {
      totalFixed += calcEdgeMarchTicksFixed(prev, next, speedTenth, speedModPermille);
    }
    prev = next;
  }
  if (totalFixed === 0 && moveEdgeCostFixed === 0) {
    const cur = getSimProvince(currentProvId);
    const first = getSimProvince(path[0]!);
    if (cur && first) totalFixed = calcEdgeMarchTicksFixed(cur, first, speedTenth, speedModPermille);
  }
  return Math.ceil(totalFixed / FIXED_SCALE);
}
