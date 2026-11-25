/**
 * Frontline extraction, even brigade distribution (no gaps), and offensive arrow planning.
 * Respects `manualOverride`: army AI never overwrites player-locked brigades until arrival.
 * Pure TypeScript, zero DOM/PIXI.
 */
import { BRIGADE_TEMPLATES } from '../data/brigadeTemplates';
import { getSimProvince, SIM_PROVINCES } from '../data/provinces1936';
import type { ArmyState, BrigadeState, FrontlineBorderPair, FrontlineOrder, OffensiveArrowOrder } from './armyTypes';
import { findLandPath } from './pathfinding';

export type ControllerResolver = (provId: number) => string;

const defaultController: ControllerResolver = (id) => getSimProvince(id)?.owner ?? '';

/** Build ordered frontline provinces + border pairs between ownerTag and targetTag using live controllers. */
export function buildFrontlineOrder(
  ownerTag: string,
  targetTag: string,
  getController: ControllerResolver = defaultController,
): FrontlineOrder | null {
  if (ownerTag === targetTag) return null;
  const friendlySet = new Set<number>();
  const borderPairs: FrontlineBorderPair[] = [];

  for (const p of SIM_PROVINCES) {
    if (getController(p.id) !== ownerTag) continue;
    for (const nid of p.neighbors) {
      const nb = getSimProvince(nid);
      if (nb && getController(nb.id) === targetTag) {
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

/** Partition owner's provinces into overland-connected components using live controllers. */
function getFriendlyComponentMap(
  ownerTag: string,
  getController: ControllerResolver = defaultController,
): Map<number, number> {
  const comp = new Map<number, number>();
  let cid = 0;
  for (const p of SIM_PROVINCES) {
    if (getController(p.id) !== ownerTag || comp.has(p.id)) continue;
    const q = [p.id];
    comp.set(p.id, cid);
    while (q.length > 0) {
      const cur = getSimProvince(q.shift()!)!;
      for (const nbId of cur.neighbors) {
        if (comp.has(nbId)) continue;
        const nb = getSimProvince(nbId);
        if (nb && getController(nb.id) === ownerTag) {
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
  getController: ControllerResolver = defaultController,
  getSupplyCap?: (provId: number) => number,
): Map<number, number> {
  const assignments = new Map<number, number>();
  const eligible = armyBrigades.filter((b) => !b.manualOverride && b.inCombatBattleId === null && !b.retreating);
  if (eligible.length === 0 || frontline.friendlyProvIds.length === 0) return assignments;

  const compMap = getFriendlyComponentMap(ownerTag, getController);
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

    // Build supply-cap-aware target slot list: round-robin spread without overfilling N >= Cap_p
    const slots: number[] = [];
    if (brigs.length >= frontProvs.length) {
      const assignedCount = new Map<number, number>();
      let round = 0;
      while (slots.length < brigs.length) {
        let addedAny = false;
        for (const pid of frontProvs) {
          if (slots.length >= brigs.length) break;
          const cap = getSupplyCap ? Math.max(1, getSupplyCap(pid)) : 999;
          const cur = assignedCount.get(pid) ?? 0;
          if (cur < cap) {
            slots.push(pid);
            assignedCount.set(pid, cur + 1);
            addedAny = true;
          }
        }
        if (!addedAny) break; // All frontline provinces reached Cap_p; do NOT keep stacking overflow
        round += 1;
        if (round > 32) break;
      }
    } else {
      for (let i = 0; i < brigs.length; i++) {
        const idx = Math.floor((i * frontProvs.length) / brigs.length);
        slots.push(frontProvs[idx]!);
      }
    }

    // Deterministic nearest-distance matching (minimizes travel while strictly respecting supply cap)
    const freeBrigs = [...brigs].sort((a, b) => a.id - b.id);
    for (const targetProvId of slots) {
      if (freeBrigs.length === 0) break;
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
  getController: ControllerResolver = defaultController,
): OffensiveArrowOrder | null {
  const target = getSimProvince(targetProvId);
  const targetCtrl = target ? getController(target.id) : '';
  if (!target || targetCtrl === army.owner) return null;

  let resolvedStart = startProvId;
  if (resolvedStart === null || getController(resolvedStart) !== army.owner) {
    const candidates = army.frontline?.friendlyProvIds ?? [];
    if (candidates.length === 0) return null;
    resolvedStart = [...candidates].sort((a, b) => {
      const pa = getSimProvince(a)!;
      const pb = getSimProvince(b)!;
      return Math.hypot(pa.cx - target.cx, pa.cy - target.cy) - Math.hypot(pb.cx - target.cx, pb.cy - target.cy) || a - b;
    })[0]!;
  }

  // Compute planning waypoint chain across target nation (strictly for arrow geometry & execution)
  const plan = findLandPath({
    startProvId: resolvedStart,
    goalProvId: targetProvId,
    ownerTag: army.owner,
    speedTenth: BRIGADE_TEMPLATES.INF.speedTenth,
    hostileTags: new Set([targetCtrl]),
    getController,
  });

  return {
    id,
    armyId: army.id,
    targetTag: targetCtrl,
    startProvId: resolvedStart,
    targetProvId,
    waypointProvIds: plan ? [resolvedStart, ...plan.path] : [resolvedStart, targetProvId],
    bendOffsetX,
    bendOffsetY,
    active: true,
  };
}
