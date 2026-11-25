/**
 * Frontline extraction, even brigade distribution (no gaps), and offensive arrow planning.
 * Respects `manualOverride`: army AI never overwrites player-locked brigades until arrival.
 * Pure TypeScript, zero DOM/PIXI.
 */
import { BRIGADE_TEMPLATES } from '../data/brigadeTemplates';
import { getOwnerProvinces, getSimProvince } from '../data/provinces1936';
import type { ArmyState, BrigadeState, FrontlineBorderPair, FrontlineOrder, OffensiveArrowOrder } from './armyTypes';
import { findLandPath } from './pathfinding';

/** Build ordered frontline provinces + border pairs between ownerTag and targetTag. */
export function buildFrontlineOrder(ownerTag: string, targetTag: string): FrontlineOrder | null {
  if (ownerTag === targetTag) return null;
  const friendlySet = new Set<number>();
  const borderPairs: FrontlineBorderPair[] = [];

  for (const p of getOwnerProvinces(ownerTag)) {
    for (const nid of p.neighbors) {
      const nb = getSimProvince(nid);
      if (nb && nb.owner === targetTag) {
        friendlySet.add(p.id);
        borderPairs.push({ friendlyProvId: p.id, enemyProvId: nb.id });
      }
    }
  }
  if (friendlySet.size === 0) return null;

  // Order friendly border provinces along contiguous adjacency chains (north-west start)
  const remaining = new Set<number>(friendlySet);
  const ordered: number[] = [];

  while (remaining.size > 0) {
    // Pick endpoint (degree <= 1 inside remaining) or northernmost/westernmost node
    const cands = [...remaining].map((id) => {
      const p = getSimProvince(id)!;
      const deg = p.neighbors.filter((n) => remaining.has(n)).length;
      return { id, deg, cy: p.cy, cx: p.cx };
    });
    cands.sort((a, b) => (a.deg <= 1 ? 0 : 1) - (b.deg <= 1 ? 0 : 1) || a.cy - b.cy || a.cx - b.cx || a.id - b.id);

    let cur: number | undefined = cands[0]!.id;
    while (cur !== undefined) {
      remaining.delete(cur);
      ordered.push(cur);
      const curProv = getSimProvince(cur);
      if (!curProv) break;
      const nexts: number[] = curProv.neighbors
        .filter((n: number) => remaining.has(n))
        .sort((a: number, b: number) => {
          const pa = getSimProvince(a)!;
          const pb = getSimProvince(b)!;
          return pa.cy - pb.cy || pa.cx - pb.cx || a - b;
        });
      cur = nexts[0];
    }
  }

  borderPairs.sort((a, b) => a.friendlyProvId - b.friendlyProvId || a.enemyProvId - b.enemyProvId);
  return { targetTag, friendlyProvIds: ordered, borderPairs };
}

/** Partition owner's provinces into overland-connected components (e.g. Germany mainland vs East Prussia). */
function getFriendlyComponentMap(ownerTag: string): Map<number, number> {
  const comp = new Map<number, number>();
  let cid = 0;
  for (const p of getOwnerProvinces(ownerTag)) {
    if (comp.has(p.id)) continue;
    const q = [p.id];
    comp.set(p.id, cid);
    while (q.length > 0) {
      const cur = getSimProvince(q.shift()!)!;
      for (const nbId of cur.neighbors) {
        if (comp.has(nbId)) continue;
        const nb = getSimProvince(nbId);
        if (nb && nb.owner === ownerTag) {
          comp.set(nbId, cid);
          q.push(nbId);
        }
      }
    }
    cid += 1;
  }
  return comp;
}

/**
 * Evenly assign non-manualOverride brigades of an army to frontline provinces within each
 * reachable land component so no border province is left empty when brigades >= provinces.
 */
export function computeFrontlineAssignments(
  frontline: FrontlineOrder,
  armyBrigades: readonly BrigadeState[],
  ownerTag: string,
): Map<number, number> {
  const assignments = new Map<number, number>();
  const eligible = armyBrigades.filter((b) => !b.manualOverride);
  if (eligible.length === 0 || frontline.friendlyProvIds.length === 0) return assignments;

  const compMap = getFriendlyComponentMap(ownerTag);
  const provsByComp = new Map<number, number[]>();
  for (const pid of frontline.friendlyProvIds) {
    const c = compMap.get(pid) ?? -1;
    const arr = provsByComp.get(c) ?? [];
    arr.push(pid);
    provsByComp.set(c, arr);
  }

  const brigsByComp = new Map<number, BrigadeState[]>();
  for (const b of eligible) {
    const c = compMap.get(b.provinceId) ?? -1;
    const arr = brigsByComp.get(c) ?? [];
    arr.push(b);
    brigsByComp.set(c, arr);
  }

  for (const [c, frontProvs] of provsByComp.entries()) {
    const brigs = brigsByComp.get(c);
    if (!brigs || brigs.length === 0) continue;

    // Build exact target slot list: round-robin spread guarantees every province gets floor(N/M) or ceil(N/M)
    const slots: number[] = [];
    if (brigs.length >= frontProvs.length) {
      for (let i = 0; i < brigs.length; i++) {
        slots.push(frontProvs[i % frontProvs.length]!);
      }
    } else {
      for (let i = 0; i < brigs.length; i++) {
        const idx = Math.floor((i * frontProvs.length) / brigs.length);
        slots.push(frontProvs[idx]!);
      }
    }

    // Deterministic nearest-distance matching (minimizes travel while strictly filling all slots)
    const freeBrigs = [...brigs].sort((a, b) => a.id - b.id);
    for (const targetProvId of slots) {
      const tp = getSimProvince(targetProvId)!;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < freeBrigs.length; i++) {
        const bp = getSimProvince(freeBrigs[i]!.provinceId)!;
        const d = Math.hypot(bp.cx - tp.cx, bp.cy - tp.cy);
        if (d < bestDist || (d === bestDist && freeBrigs[i]!.id < freeBrigs[bestIdx]!.id)) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const chosen = freeBrigs.splice(bestIdx, 1)[0]!;
      assignments.set(chosen.id, targetProvId);
    }
  }
  return assignments;
}

export function buildOffensiveArrowOrder(
  id: number,
  army: ArmyState,
  startProvId: number | null,
  targetProvId: number,
  bendOffsetX?: number,
  bendOffsetY?: number,
): OffensiveArrowOrder | null {
  const target = getSimProvince(targetProvId);
  if (!target || target.owner === army.owner) return null;

  let resolvedStart = startProvId;
  if (resolvedStart === null || getSimProvince(resolvedStart)?.owner !== army.owner) {
    const candidates = army.frontline?.friendlyProvIds ?? [];
    if (candidates.length === 0) return null;
    resolvedStart = [...candidates].sort((a, b) => {
      const pa = getSimProvince(a)!;
      const pb = getSimProvince(b)!;
      return Math.hypot(pa.cx - target.cx, pa.cy - target.cy) - Math.hypot(pb.cx - target.cx, pb.cy - target.cy) || a - b;
    })[0]!;
  }

  // Compute planning waypoint chain across target nation (strictly for arrow geometry, zero combat)
  const plan = findLandPath({
    startProvId: resolvedStart,
    goalProvId: targetProvId,
    ownerTag: army.owner,
    speedTenth: BRIGADE_TEMPLATES.INF.speedTenth,
    hostileTags: new Set([target.owner]),
  });

  return {
    id,
    armyId: army.id,
    targetTag: target.owner,
    startProvId: resolvedStart,
    targetProvId,
    waypointProvIds: plan ? [resolvedStart, ...plan.path] : [resolvedStart, targetProvId],
    bendOffsetX,
    bendOffsetY,
    active: true,
  };
}
