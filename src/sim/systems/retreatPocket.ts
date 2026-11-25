/**
 * Deterministic Retreat Path Selection, Encirclement Wipeout & Daily Pocket Scanning (Carbon §4.9.5).
 * Pure TypeScript — zero DOM/PIXI dependencies.
 */
import { BRIGADE_TEMPLATES } from '../data/brigadeTemplates';
import { COMBAT_DEFINES } from '../data/combatDefines';
import { getCapitalProvince, getSimProvince, SIM_PROVINCES } from '../data/provinces1936';
import type { ControllerResolver } from './armyOrderSystem';
import type { BrigadeState } from './armyTypes';
import type { EncircledPocketSnap } from './combatTypes';
import type { EquipmentType } from './industryTypes';

/**
 * Find retreat province for defeated defenders:
 * 1. Adjacent friendly-controlled province NOT currently in active combat (prefer closest to capital).
 * 2. If all adjacent land provinces are non-friendly, check friendly port evacuation (coastal + another friendly port).
 * Returns null if completely encircled -> triggers 100% wipeout.
 */
export function findRetreatProvince(
  fromProvId: number,
  ownerTag: string,
  getController: ControllerResolver,
  activeBattleProvs: ReadonlySet<number>,
): number | null {
  const from = getSimProvince(fromProvId);
  if (!from) return null;

  const cap = getCapitalProvince(ownerTag);
  const scoreDist = (pid: number): number => {
    const p = getSimProvince(pid);
    if (!p || !cap) return pid;
    return Math.round(Math.hypot(p.cx - cap.cx, p.cy - cap.cy));
  };

  const landSafe: number[] = [];
  let hasAnyFriendlyLandNeighbor = false;
  for (const nid of from.neighbors) {
    const nb = getSimProvince(nid);
    if (!nb || getController(nb.id) !== ownerTag) continue;
    hasAnyFriendlyLandNeighbor = true;
    if (!activeBattleProvs.has(nb.id)) landSafe.push(nb.id);
  }

  if (landSafe.length > 0) {
    landSafe.sort((a, b) => scoreDist(a) - scoreDist(b) || a - b);
    return landSafe[0]!;
  }

  // If friendly neighbors exist but all are in combat, still try least-bad friendly land neighbor
  if (hasAnyFriendlyLandNeighbor) {
    const fallback = from.neighbors.filter((nid) => getController(nid) === ownerTag);
    fallback.sort((a, b) => scoreDist(a) - scoreDist(b) || a - b);
    return fallback[0] ?? null;
  }

  // All adjacent land provinces are enemy/non-friendly: only a friendly coastal port can evacuate
  if (from.isCoastal) {
    const friendlyPorts = SIM_PROVINCES
      .filter((p) => p.id !== fromProvId && p.isCoastal && getController(p.id) === ownerTag && !activeBattleProvs.has(p.id))
      .sort((a, b) => scoreDist(a.id) - scoreDist(b.id) || a.id - b.id);
    if (friendlyPorts.length > 0) return friendlyPorts[0]!.id;
  }

  return null;
}

export interface WipeoutLootSummary {
  manpowerLost: number;
  equipmentCaptured: Partial<Record<EquipmentType, number>>;
}

/** Calculate 100% remaining manpower loss & 15% full-template equipment capture for encircled brigades. */
export function computeEncirclementWipeout(brigades: readonly BrigadeState[]): WipeoutLootSummary {
  let manpowerLost = 0;
  const equipmentCaptured: Partial<Record<EquipmentType, number>> = {};

  for (const b of brigades) {
    const tmpl = BRIGADE_TEMPLATES[b.template];
    manpowerLost += Math.floor((tmpl.manpower * Math.max(0, b.strengthPermille)) / 1000);
    for (const req of tmpl.equipment) {
      const capUnits = Math.floor((req.amount * COMBAT_DEFINES.encirclementCapturePermille) / 1000);
      if (capUnits > 0) {
        equipmentCaptured[req.type] = (equipmentCaptured[req.type] ?? 0) + capUnits;
      }
    }
  }
  return { manpowerLost, equipmentCaptured };
}

/**
 * Scan all nations at war for encircled pockets: connected blocks of friendly provinces
 * containing >=1 brigade that cannot trace a friendly land (or sea-port) route to the capital.
 */
export function scanEncircledPockets(
  brigades: readonly BrigadeState[],
  getController: ControllerResolver,
  atWarTags: ReadonlySet<string>,
  areAtWar: (a: string, b: string) => boolean,
): EncircledPocketSnap[] {
  const pockets: EncircledPocketSnap[] = [];
  let nextId = 1;

  for (const tag of [...atWarTags].sort()) {
    const ownProvs = SIM_PROVINCES.filter((p) => getController(p.id) === tag);
    if (ownProvs.length === 0) continue;

    // Anchor: controlled capital, else highest-VP controlled province
    const cap = getCapitalProvince(tag);
    const anchor = cap && getController(cap.id) === tag
      ? cap
      : [...ownProvs].sort((a, b) => b.vp - a.vp || a.id - b.id)[0]!;

    // BFS overland from anchor
    const connected = new Set<number>([anchor.id]);
    const queue: number[] = [anchor.id];
    let anchorHasPort = anchor.isCoastal;
    while (queue.length > 0) {
      const cur = getSimProvince(queue.shift()!)!;
      for (const nid of cur.neighbors) {
        if (connected.has(nid) || getController(nid) !== tag) continue;
        connected.add(nid);
        const nb = getSimProvince(nid)!;
        if (nb.isCoastal) anchorHasPort = true;
        queue.push(nid);
      }
    }

    // Group brigades outside capital-connected territory
    const brigsByProv = new Map<number, number[]>();
    for (const b of brigades) {
      if (b.owner !== tag || connected.has(b.provinceId)) continue;
      if (getController(b.provinceId) !== tag) continue;
      const list = brigsByProv.get(b.provinceId) ?? [];
      list.push(b.id);
      brigsByProv.set(b.provinceId, list);
    }
    if (brigsByProv.size === 0) continue;

    // Find connected components of disconnected provinces containing brigades
    const visited = new Set<number>();
    for (const startPid of [...brigsByProv.keys()].sort((a, b) => a - b)) {
      if (visited.has(startPid)) continue;
      const compProvs: number[] = [];
      const compBrigs: number[] = [];
      let compHasPort = false;
      let bordersEnemy = false;
      const q = [startPid];
      visited.add(startPid);

      while (q.length > 0) {
        const pid = q.shift()!;
        const p = getSimProvince(pid)!;
        compProvs.push(pid);
        if (p.isCoastal) compHasPort = true;
        const bs = brigsByProv.get(pid);
        if (bs) compBrigs.push(...bs);
        for (const nid of p.neighbors) {
          const ctrl = getController(nid);
          if (ctrl === tag) {
            if (!visited.has(nid) && !connected.has(nid)) {
              visited.add(nid);
              q.push(nid);
            }
          } else if (areAtWar(tag, ctrl)) {
            bordersEnemy = true;
          }
        }
      }

      // Coastal enclave with sea connection to a capital-linked port is NOT encircled (e.g., East Prussia)
      if (!bordersEnemy) continue;
      if (compHasPort && anchorHasPort) continue;

      let sx = 0, sy = 0;
      for (const pid of compProvs) {
        const p = getSimProvince(pid)!;
        sx += p.cx;
        sy += p.cy;
      }
      compProvs.sort((a, b) => a - b);
      compBrigs.sort((a, b) => a - b);
      pockets.push({
        id: nextId++,
        owner: tag,
        provinceIds: compProvs,
        brigadeIds: compBrigs,
        cx: Math.round(sx / compProvs.length),
        cy: Math.round(sy / compProvs.length),
      });
    }
  }
  return pockets;
}
