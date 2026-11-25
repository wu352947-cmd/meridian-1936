/**
 * Deterministic 6-hour brigade movement advancement, snapshot mapping, and FNV-1a hashing.
 * Pure TypeScript, zero DOM/PIXI.
 */
import { FIXED_SCALE } from '../core/FixedMath';
import { BRIGADE_TEMPLATES } from '../data/brigadeTemplates';
import { getSimProvince } from '../data/provinces1936';
import type { ArmySnap, ArmyState, BrigadeSnap, BrigadeState, TrainingOrderState } from './armyTypes';
import { calcEdgeMarchTicksFixed, estimateRemainingTicks, findLandPath } from './pathfinding';

export function assignBrigadePath(
  b: BrigadeState,
  goalProvId: number,
  speedModPermille: number,
  manualOverride: boolean,
  hostileTags?: ReadonlySet<string>,
  getController?: (provId: number) => string,
): boolean {
  const tmpl = BRIGADE_TEMPLATES[b.template];
  const res = findLandPath({
    startProvId: b.provinceId,
    goalProvId,
    ownerTag: b.owner,
    speedTenth: tmpl.speedTenth,
    speedModPermille,
    hostileTags,
    getController,
  });
  if (!res) return false;
  if (res.path.length === 0) {
    b.path = [];
    b.moveProgressFixed = 0;
    b.moveEdgeCostFixed = 0;
    b.moveTargetProvId = null;
    b.manualOverride = false;
    return true;
  }

  const from = getSimProvince(b.provinceId)!;
  const first = getSimProvince(res.path[0]!)!;
  b.path = res.path;
  b.moveProgressFixed = 0;
  b.moveEdgeCostFixed = calcEdgeMarchTicksFixed(from, first, tmpl.speedTenth, speedModPermille);
  b.moveTargetProvId = goalProvId;
  b.manualOverride = manualOverride;
  b.retreating = false;
  b.entrenchPermille = 0;
  return true;
}

export type StepEnterDecision = 'allow' | 'combat' | 'block';

/** Advance all marching brigades by 1 six-hour tick. Auto-clears manualOverride on arrival. */
export function stepBrigadesMovementTick(
  brigades: readonly BrigadeState[],
  getSpeedMod: (tag: string, armyId: number | null) => number,
  onBeforeEnterProvince?: (b: BrigadeState, nextProvId: number) => StepEnterDecision,
  onEnteredProvince?: (b: BrigadeState, provId: number) => void,
): void {
  for (const b of brigades) {
    if (b.inCombatBattleId !== null) continue;
    if (b.path.length === 0) continue;
    const nextProv = b.path[0]!;
    if (onBeforeEnterProvince) {
      const dec = onBeforeEnterProvince(b, nextProv);
      if (dec === 'combat') continue;
      if (dec === 'block') {
        b.path = [];
        b.moveProgressFixed = 0;
        b.moveEdgeCostFixed = 0;
        b.moveTargetProvId = null;
        b.manualOverride = false;
        b.retreating = false;
        continue;
      }
    }
    const speedMod = getSpeedMod(b.owner, b.armyId);
    const tmpl = BRIGADE_TEMPLATES[b.template];
    if (b.moveEdgeCostFixed <= 0) {
      const cur = getSimProvince(b.provinceId);
      const nxt = getSimProvince(b.path[0]!);
      if (!cur || !nxt) {
        b.path = [];
        b.moveTargetProvId = null;
        b.manualOverride = false;
        b.retreating = false;
        continue;
      }
      b.moveEdgeCostFixed = calcEdgeMarchTicksFixed(cur, nxt, tmpl.speedTenth, speedMod);
    }

    b.entrenchPermille = 0;
    b.moveProgressFixed += FIXED_SCALE;
    while (b.path.length > 0 && b.moveProgressFixed >= b.moveEdgeCostFixed) {
      const candidate = b.path[0]!;
      if (onBeforeEnterProvince) {
        const dec = onBeforeEnterProvince(b, candidate);
        if (dec === 'combat') {
          b.moveProgressFixed = Math.min(b.moveProgressFixed, Math.max(0, b.moveEdgeCostFixed - 1));
          break;
        }
        if (dec === 'block') {
          b.path = [];
          b.moveProgressFixed = 0;
          b.moveEdgeCostFixed = 0;
          b.moveTargetProvId = null;
          b.manualOverride = false;
          b.retreating = false;
          break;
        }
      }
      const overflow = b.moveProgressFixed - b.moveEdgeCostFixed;
      const arrivedId = b.path.shift()!;
      b.provinceId = arrivedId;
      b.moveProgressFixed = overflow;
      onEnteredProvince?.(b, arrivedId);

      if (b.path.length === 0) {
        b.moveProgressFixed = 0;
        b.moveEdgeCostFixed = 0;
        b.moveTargetProvId = null;
        b.manualOverride = false;
        b.retreating = false;
        break;
      }
      const nextFrom = getSimProvince(b.provinceId);
      const nextTo = getSimProvince(b.path[0]!);
      if (!nextFrom || !nextTo) {
        b.path = [];
        b.moveProgressFixed = 0;
        b.moveEdgeCostFixed = 0;
        b.moveTargetProvId = null;
        b.manualOverride = false;
        b.retreating = false;
        break;
      }
      b.moveEdgeCostFixed = calcEdgeMarchTicksFixed(nextFrom, nextTo, tmpl.speedTenth, speedMod);
    }
  }
}

export function toBrigadeSnap(b: BrigadeState, speedModPermille: number): BrigadeSnap {
  const movingToProvId = b.path.length > 0 ? b.path[0]! : null;
  const moveProgressPermille =
    movingToProvId !== null && b.moveEdgeCostFixed > 0
      ? Math.min(FIXED_SCALE, Math.floor((b.moveProgressFixed * FIXED_SCALE) / b.moveEdgeCostFixed))
      : 0;
  const etaTicks = estimateRemainingTicks(
    b.provinceId,
    b.path,
    b.moveProgressFixed,
    b.moveEdgeCostFixed,
    BRIGADE_TEMPLATES[b.template].speedTenth,
    speedModPermille,
  );
  return {
    id: b.id,
    owner: b.owner,
    template: b.template,
    nameZh: b.nameZh,
    provinceId: b.provinceId,
    armyId: b.armyId,
    orgPermille: b.orgPermille,
    strengthPermille: b.strengthPermille,
    movingToProvId,
    moveTargetProvId: b.moveTargetProvId,
    moveProgressPermille,
    etaTicks,
    manualOverride: b.manualOverride,
    entrenchPermille: b.entrenchPermille,
    planPermille: b.planPermille,
    inCombatBattleId: b.inCombatBattleId,
    retreating: b.retreating,
  };
}

export function toArmySnap(a: ArmyState): ArmySnap {
  return {
    id: a.id,
    owner: a.owner,
    nameZh: a.nameZh,
    color: a.color,
    commanderId: a.commanderId,
    brigadeIds: a.brigadeIds.slice(),
    frontline: a.frontline
      ? {
          targetTag: a.frontline.targetTag,
          friendlyProvIds: a.frontline.friendlyProvIds.slice(),
          borderPairs: a.frontline.borderPairs.map((p) => ({ ...p })),
        }
      : null,
    arrow: a.arrow
      ? { ...a.arrow, waypointProvIds: a.arrow.waypointProvIds.slice() }
      : null,
  };
}

export function mixArmyStateHash(
  mix: (v: number) => void,
  brigades: readonly BrigadeState[],
  armies: readonly ArmyState[],
  training: readonly TrainingOrderState[],
): void {
  mix(brigades.length);
  for (const b of brigades) {
    mix(b.id + (b.provinceId << 10) + ((b.armyId ?? 0) << 21));
    mix(b.orgPermille + (b.strengthPermille << 10) + (b.manualOverride ? 1 << 24 : 0));
    mix(b.moveProgressFixed ^ (b.path.length << 16) ^ (b.moveTargetProvId ?? 0));
    mix(b.entrenchPermille + (b.planPermille << 10) + ((b.inCombatBattleId ?? 0) << 20) + (b.retreating ? 1 << 30 : 0));
  }
  mix(armies.length);
  for (const a of armies) {
    mix(a.id + (a.brigadeIds.length << 12) + (a.commanderId ? a.commanderId.length << 20 : 0));
    mix((a.frontline?.friendlyProvIds.length ?? 0) + ((a.arrow?.targetProvId ?? 0) << 8));
  }
  mix(training.length);
  for (const t of training) {
    mix(t.id + (t.deployProvId << 10));
    mix(t.progressDaysFixed ^ t.targetDaysFixed ^ t.equipmentRatioPermille);
  }
}
