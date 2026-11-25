/**
 * Offensive Arrow AI Execution + Per-Tick Entrenchment, Planning & Org Recovery (Batch 06).
 * Strictly respects `manualOverride`: player-microed brigades are never hijacked.
 * Pure TypeScript — zero DOM/PIXI dependencies.
 */
import { clampInt } from '../core/FixedMath';
import type { SeededRng } from '../core/SeededRng';
import { COMBAT_DEFINES } from '../data/combatDefines';
import { getCommanderDef } from '../data/commanders1936';
import { getSimProvince } from '../data/provinces1936';
import type { ControllerResolver } from './armyOrderSystem';
import type { ArmyState, BrigadeState } from './armyTypes';
import { getAiArmorOffensiveWeightPermille } from './weatherSystem';

/** Update entrenchment (+3%/day stationary), planning (+3%/day on arrow front, -2%/day fighting), and Org recovery. */
export function updateBrigadeReadinessTick(
  brigades: readonly BrigadeState[],
  getArmy: (id: number) => ArmyState | undefined,
  tick: number,
): void {
  // Distribute +30 permille/day cleanly across 4 six-hour ticks: +8, +7, +8, +7 = +30
  const tickInDay = tick % 4;
  const dailyStep30 = tickInDay % 2 === 0 ? 8 : 7;
  const dailyDecay20 = 5; // 5 * 4 = 20 permille/day

  for (const b of brigades) {
    if (b.inCombatBattleId !== null) {
      if (b.planPermille > 0) {
        b.planPermille = Math.max(0, b.planPermille - dailyDecay20);
      }
      continue;
    }

    if (b.retreating) {
      b.entrenchPermille = 0;
      b.planPermille = 0;
      continue;
    }

    // Idle Org recovery (+10%/day -> +25 permille/tick), halted under low supply / starvation (§4.10)
    if (b.orgPermille < 1000 && b.supplyStatus === 'ok') {
      b.orgPermille = Math.min(1000, b.orgPermille + COMBAT_DEFINES.idleOrgRecoveryPerTickPermille);
    }

    // Stationary brigades dig in & build offensive plan bonus
    if (b.path.length === 0) {
      const army = b.armyId !== null ? getArmy(b.armyId) : undefined;
      let entrenchCap: number = COMBAT_DEFINES.entrenchBaseCapPermille;
      const cmd = getCommanderDef(army?.commanderId);
      if (cmd) {
        for (const tr of cmd.traits) {
          if (tr.entrenchCapPermille) entrenchCap += tr.entrenchCapPermille;
        }
      }
      b.entrenchPermille = clampInt(b.entrenchPermille + dailyStep30, 0, entrenchCap);

      if (army?.frontline && army.arrow && army.frontline.friendlyProvIds.includes(b.provinceId)) {
        b.planPermille = clampInt(b.planPermille + dailyStep30, 0, COMBAT_DEFINES.planMaxCapPermille);
      }
    } else {
      b.entrenchPermille = 0;
    }
  }
}

export interface ArrowStepHooks {
  getController: ControllerResolver;
  areAtWar: (a: string, b: string) => boolean;
  onInitiateAttack: (brigade: BrigadeState, targetProvId: number) => void;
  tick?: number;
  rng?: SeededRng;
}

/**
 * Execute active offensive arrows: eligible frontline brigades attack adjacent hostile provinces
 * progressing toward `arrow.targetProvId` until captured or blocked. Never touches `manualOverride`.
 */
export function executeOffensiveArrowsTick(
  armies: readonly ArmyState[],
  getBrigade: (id: number) => BrigadeState | undefined,
  hooks: ArrowStepHooks,
): void {
  const { getController, areAtWar, onInitiateAttack } = hooks;

  for (const army of armies) {
    const arrow = army.arrow;
    if (!arrow || !arrow.active) continue;
    if (!areAtWar(army.owner, arrow.targetTag)) continue;

    // Goal already captured -> pause arrow cleanly
    if (getController(arrow.targetProvId) === army.owner) {
      arrow.active = false;
      continue;
    }

    const goalProv = getSimProvince(arrow.targetProvId);
    if (!goalProv) continue;
    const waypointSet = new Set(arrow.waypointProvIds);

    const brigs = army.brigadeIds
      .map((id) => getBrigade(id))
      .filter((b): b is BrigadeState => b !== undefined)
      .sort((a, b) => a.id - b.id);

    for (const b of brigs) {
      if (b.manualOverride || b.inCombatBattleId !== null || b.retreating) continue;
      if (b.orgPermille < COMBAT_DEFINES.arrowMinAttackOrgPermille) continue;
      // Already marching into an enemy province -> let movement/combat handle it
      if (b.path.length > 0 && areAtWar(b.owner, getController(b.path[0]!))) continue;

      const curProv = getSimProvince(b.provinceId);
      if (!curProv) continue;

      const curDist = Math.hypot(curProv.cx - goalProv.cx, curProv.cy - goalProv.cy);
      const hostileNeighbors = curProv.neighbors.filter((nid) => {
        const ctrl = getController(nid);
        return ctrl === arrow.targetTag && areAtWar(army.owner, ctrl);
      });
      if (hostileNeighbors.length === 0) continue;

      // Prefer enemy neighbor along arrow waypoints or strictly closer to target province
      hostileNeighbors.sort((a, bId) => {
        const pa = getSimProvince(a)!;
        const pb = getSimProvince(bId)!;
        const aWay = waypointSet.has(a) ? 0 : 1;
        const bWay = waypointSet.has(bId) ? 0 : 1;
        if (aWay !== bWay) return aWay - bWay;
        const da = Math.hypot(pa.cx - goalProv.cx, pa.cy - goalProv.cy);
        const db = Math.hypot(pb.cx - goalProv.cx, pb.cy - goalProv.cy);
        return da - db || a - bId;
      });

      const bestTarget = hostileNeighbors[0]!;
      const bestProv = getSimProvince(bestTarget)!;
      const bestDist = Math.hypot(bestProv.cx - goalProv.cx, bestProv.cy - goalProv.cy);
      // Attack if advancing toward goal (or directly adjacent to goal, or within gentle flank arc)
      if (bestTarget === arrow.targetProvId || bestDist <= curDist + 55 || waypointSet.has(bestTarget)) {
        // Under East/Nordic mud or severe winter, AI reduces armored/motorized offensive weight (x0.4)
        if ((b.template === 'ARM' || b.template === 'MOT') && hooks.tick !== undefined) {
          const wt = getAiArmorOffensiveWeightPermille(bestTarget, hooks.tick);
          if (wt < 1000) {
            const roll = hooks.rng ? hooks.rng.nextPermille() : ((b.id * 131 + hooks.tick * 97) % 1000);
            if (roll >= wt) continue;
          }
        }
        onInitiateAttack(b, bestTarget);
      }
    }
  }
}
