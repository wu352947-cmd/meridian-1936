/**
 * Single-battle 6-hour tick resolution engine (Carbon §4.9.2–4.9.4).
 * Deterministic slot maintenance, 25% reserve swap, simultaneous fire, parry/crit & armor suppression.
 */
import { FIXED_SCALE } from '../core/FixedMath';
import type { SeededRng } from '../core/SeededRng';
import { BRIGADE_TEMPLATES, getCombatSlotsForBattle } from '../data/brigadeTemplates';
import { COMBAT_DEFINES, getProvinceFortLevel } from '../data/combatDefines';
import { getSimProvince } from '../data/provinces1936';
import { getRiverCrossing, worstRiverCrossing } from '../data/riverCrossings1936';
import type { ArmyState, BrigadeState } from './armyTypes';
import {
  calcTickHitDamage,
  computeAdvantageScore,
  computeUnitCombatBreakdown,
  partitionCombatSlots,
} from './combatMath';
import type { BattleSlotUnitSnap, CombatUnitBreakdown, ProvinceBattleSnap } from './combatTypes';
import type { EquipmentType } from './industryTypes';
import type { NationModifiers } from './modifierTypes';

export interface ActiveBattleState {
  id: number;
  provinceId: number;
  attackerTag: string;
  defenderTag: string;
  startTick: number;
  fortLevelOverride?: number;
  attackerFromProv: Map<number, number>;
  attackerFront: number[];
  attackerSupport: number[];
  attackerReserves: number[];
  defenderFront: number[];
  defenderSupport: number[];
  defenderReserves: number[];
  lastSnap: ProvinceBattleSnap | null;
}

export interface BattleStepContext {
  getBrigade: (id: number) => BrigadeState | undefined;
  getAllBrigades: () => readonly BrigadeState[];
  getArmy: (id: number) => ArmyState | undefined;
  getModifiers: (tag: string) => Readonly<NationModifiers>;
  addCasualties: (tag: string, men: number) => void;
  recordEquipmentLoss: (tag: string, eqType: EquipmentType, units: number) => void;
}

function getEffectivePiercing(b: BrigadeState, mods: Readonly<NationModifiers>): number {
  const base = BRIGADE_TEMPLATES[b.template].piercing;
  return Math.floor((base * (FIXED_SCALE + mods.anti_tank_piercing)) / FIXED_SCALE);
}

function refreshSideSlots(
  existingFront: number[],
  existingSupport: number[],
  allValidIds: readonly number[],
  getBrig: (id: number) => BrigadeState | undefined,
  maxFront: number,
  maxSupport: number,
  rng: SeededRng,
): { front: number[]; support: number[]; reserves: number[] } {
  const validSet = new Set(allValidIds);
  const front = existingFront.filter((id) => validSet.has(id) && (getBrig(id)?.orgPermille ?? 0) > 0);
  const support = existingSupport.filter((id) => validSet.has(id) && (getBrig(id)?.orgPermille ?? 0) > 0);
  const assigned = new Set([...front, ...support]);
  const pool = allValidIds.filter((id) => !assigned.has(id) && (getBrig(id)?.orgPermille ?? 0) > 0).sort((a, b) => a - b);

  // Fill empty frontline/support slots first
  const rest: number[] = [];
  for (const id of pool) {
    const role = BRIGADE_TEMPLATES[getBrig(id)!.template].role;
    if (role === 'support' && support.length < maxSupport) support.push(id);
    else if (role === 'frontline' && front.length < maxFront) front.push(id);
    else rest.push(id);
  }

  // 25% reserve rotation for exhausted frontline brigades (<15% Org)
  const frontReserves = rest.filter((id) => BRIGADE_TEMPLATES[getBrig(id)!.template].role === 'frontline');
  for (let i = 0; i < front.length && frontReserves.length > 0; i++) {
    const cur = getBrig(front[i]!);
    if (!cur || cur.orgPermille >= COMBAT_DEFINES.lowOrgRotateThresholdPermille) continue;
    if (rng.nextPermille() < COMBAT_DEFINES.baseReserveRotatePermille) {
      const replacement = frontReserves.shift()!;
      const oldId = front[i]!;
      front[i] = replacement;
      const idx = rest.indexOf(replacement);
      if (idx >= 0) rest.splice(idx, 1);
      rest.push(oldId);
    }
  }
  return { front, support, reserves: rest.sort((a, b) => a - b) };
}

export type BattleOutcome = 'ongoing' | 'attacker_won' | 'defender_won';

/** Advance one province battle by 1 deterministic 6-hour tick. */
export function resolveBattleTick(
  battle: ActiveBattleState,
  tick: number,
  rng: SeededRng,
  ctx: BattleStepContext,
): BattleOutcome {
  const prov = getSimProvince(battle.provinceId);
  if (!prov) return 'defender_won';

  // Prune invalid attackers & collect current defenders in province
  const validAtkIds: number[] = [];
  for (const [bid, fromPid] of [...battle.attackerFromProv.entries()]) {
    const b = ctx.getBrigade(bid);
    if (!b || b.owner !== battle.attackerTag || b.retreating || b.orgPermille <= 0 || !prov.neighbors.includes(fromPid)) {
      battle.attackerFromProv.delete(bid);
      if (b && b.inCombatBattleId === battle.id) b.inCombatBattleId = null;
    } else {
      b.inCombatBattleId = battle.id;
      validAtkIds.push(bid);
    }
  }

  const validDefIds: number[] = [];
  for (const b of ctx.getAllBrigades()) {
    if (b.provinceId === battle.provinceId && b.owner === battle.defenderTag && !b.retreating && b.orgPermille > 0) {
      b.inCombatBattleId = battle.id;
      validDefIds.push(b.id);
    }
  }
  if (validAtkIds.length === 0) return 'defender_won';
  if (validDefIds.length === 0) return 'attacker_won';

  const originProvs = new Set<number>(validAtkIds.map((id) => battle.attackerFromProv.get(id)!));
  const attackDirections = Math.max(1, originProvs.size);
  const slotCap = getCombatSlotsForBattle(prov.terrain, attackDirections);

  // Initial or refreshed slots
  if (battle.attackerFront.length === 0 && battle.attackerSupport.length === 0) {
    const p = partitionCombatSlots(validAtkIds, (id) => BRIGADE_TEMPLATES[ctx.getBrigade(id)!.template].role, slotCap.frontline, slotCap.support);
    battle.attackerFront = p.frontline;
    battle.attackerSupport = p.support;
    battle.attackerReserves = p.reserves;
  } else {
    const s = refreshSideSlots(battle.attackerFront, battle.attackerSupport, validAtkIds, ctx.getBrigade, slotCap.frontline, slotCap.support, rng);
    battle.attackerFront = s.front;
    battle.attackerSupport = s.support;
    battle.attackerReserves = s.reserves;
  }

  if (battle.defenderFront.length === 0 && battle.defenderSupport.length === 0) {
    const p = partitionCombatSlots(validDefIds, (id) => BRIGADE_TEMPLATES[ctx.getBrigade(id)!.template].role, slotCap.frontline, slotCap.support);
    battle.defenderFront = p.frontline;
    battle.defenderSupport = p.support;
    battle.defenderReserves = p.reserves;
  } else {
    const s = refreshSideSlots(battle.defenderFront, battle.defenderSupport, validDefIds, ctx.getBrigade, slotCap.frontline, slotCap.support, rng);
    battle.defenderFront = s.front;
    battle.defenderSupport = s.support;
    battle.defenderReserves = s.reserves;
  }

  const atkActive = [...battle.attackerFront, ...battle.attackerSupport];
  const defActive = [...battle.defenderFront, ...battle.defenderSupport];
  const atkMods = ctx.getModifiers(battle.attackerTag);
  const defMods = ctx.getModifiers(battle.defenderTag);
  const fortLevel = battle.fortLevelOverride ?? getProvinceFortLevel(battle.provinceId);
  const hasAtkArt = battle.attackerSupport.some((id) => ctx.getBrigade(id)?.template === 'ART');

  const atkMaxPrc = Math.max(0, ...atkActive.map((id) => getEffectivePiercing(ctx.getBrigade(id)!, atkMods)));
  const defMaxPrc = Math.max(0, ...defActive.map((id) => getEffectivePiercing(ctx.getBrigade(id)!, defMods)));

  const breakdowns = new Map<number, CombatUnitBreakdown>();
  const buildBd = (bid: number, isAttacking: boolean): CombatUnitBreakdown => {
    const b = ctx.getBrigade(bid)!;
    const fromPid = isAttacking ? (battle.attackerFromProv.get(bid) ?? b.provinceId) : battle.provinceId;
    const army = b.armyId !== null ? ctx.getArmy(b.armyId) : undefined;
    const bd = computeUnitCombatBreakdown({
      brigadeId: b.id,
      nameZh: b.nameZh,
      template: b.template,
      strengthPermille: b.strengthPermille,
      entrenchPermille: b.entrenchPermille,
      planPermille: b.planPermille,
      isAttacking,
      terrain: prov.terrain,
      river: isAttacking ? getRiverCrossing(fromPid, battle.provinceId) : 'none',
      fortLevel,
      hasAttackerArtillery: hasAtkArt,
      hasFrontlineCover: isAttacking ? battle.attackerFront.length > 0 : battle.defenderFront.length > 0,
      enemyMaxPiercing: isAttacking ? defMaxPrc : atkMaxPrc,
      commanderId: army?.commanderId ?? null,
      nationMods: isAttacking ? atkMods : defMods,
    });
    breakdowns.set(bid, bd);
    return bd;
  };

  for (const id of [...atkActive, ...battle.attackerReserves]) buildBd(id, true);
  for (const id of [...defActive, ...battle.defenderReserves]) buildBd(id, false);

  // Simultaneous fire exchange with per-target guard pool
  const guardRem = new Map<number, number>();
  for (const id of [...atkActive, ...defActive]) guardRem.set(id, breakdowns.get(id)!.effGuardFixed);

  const orgDmg = new Map<number, number>();
  const strDmg = new Map<number, number>();
  const fireSide = (shooters: readonly number[], targetFront: readonly number[], targetSup: readonly number[]) => {
    const pool = targetFront.length > 0 ? targetFront : targetSup;
    if (pool.length === 0) return;
    for (const sid of shooters) {
      const sBd = breakdowns.get(sid)!;
      const tid = pool[rng.nextInt(0, pool.length - 1)]!;
      const tBrig = ctx.getBrigade(tid)!;
      const tBd = breakdowns.get(tid)!;
      const remG = guardRem.get(tid) ?? 0;
      const hit = calcTickHitDamage(sBd.effAtkFixed, remG, sBd.armorAdvantage, tBd.armorAdvantage, BRIGADE_TEMPLATES[tBrig.template].maxOrg);
      guardRem.set(tid, Math.max(0, remG - sBd.effAtkFixed));
      orgDmg.set(tid, (orgDmg.get(tid) ?? 0) + hit.orgLossPermille);
      strDmg.set(tid, (strDmg.get(tid) ?? 0) + hit.strLossPermille);
    }
  };

  fireSide(atkActive, battle.defenderFront, battle.defenderSupport);
  fireSide(defActive, battle.attackerFront, battle.attackerSupport);

  // Apply accumulated damage & convert 60% strength loss -> casualties, 40% -> equipment destroyed
  for (const id of [...atkActive, ...defActive]) {
    const b = ctx.getBrigade(id)!;
    const oLoss = orgDmg.get(id) ?? 0;
    const sLoss = strDmg.get(id) ?? 0;
    if (oLoss > 0) b.orgPermille = Math.max(0, b.orgPermille - oLoss);
    if (sLoss > 0) {
      const prevStr = b.strengthPermille;
      b.strengthPermille = Math.max(50, b.strengthPermille - sLoss);
      const actualLoss = prevStr - b.strengthPermille;
      if (actualLoss > 0) {
        const tmpl = BRIGADE_TEMPLATES[b.template];
        const menLost = Math.floor((tmpl.manpower * actualLoss * COMBAT_DEFINES.strLossManpowerSharePermille) / 1_000_000);
        if (menLost > 0) ctx.addCasualties(b.owner, menLost);
        for (const req of tmpl.equipment) {
          const eqLost = Math.floor((req.amount * actualLoss * COMBAT_DEFINES.strLossEquipmentSharePermille) / 1_000_000);
          if (eqLost > 0) ctx.recordEquipmentLoss(b.owner, req.type, eqLost);
        }
      }
    }
  }

  // Build snapshot for UI / BattleReportDrawer
  const toSlotSnap = (id: number, isAtk: boolean): BattleSlotUnitSnap => {
    const b = ctx.getBrigade(id)!;
    return {
      brigadeId: b.id, owner: b.owner, nameZh: b.nameZh, template: b.template,
      role: BRIGADE_TEMPLATES[b.template].role, orgPermille: b.orgPermille, strengthPermille: b.strengthPermille,
      entrenchPermille: b.entrenchPermille, planPermille: b.planPermille,
      fromProvId: isAtk ? (battle.attackerFromProv.get(id) ?? b.provinceId) : battle.provinceId,
      breakdown: breakdowns.get(id)!,
    };
  };

  const atkPow = atkActive.reduce((s, id) => s + breakdowns.get(id)!.effAtkFixed, 0);
  const defPow = defActive.reduce((s, id) => s + breakdowns.get(id)!.effAtkFixed + (breakdowns.get(id)!.effGuardFixed >> 2), 0);
  const atkOrg = atkActive.reduce((s, id) => s + (ctx.getBrigade(id)?.orgPermille ?? 0), 0);
  const defOrg = defActive.reduce((s, id) => s + (ctx.getBrigade(id)?.orgPermille ?? 0), 0);
  const rivers = [...originProvs].map((fp) => getRiverCrossing(fp, battle.provinceId));
  const defEntAvg = defActive.length > 0
    ? Math.round(defActive.reduce((s, id) => s + (ctx.getBrigade(id)?.entrenchPermille ?? 0), 0) / defActive.length)
    : 0;
  const atkPlanAvg = atkActive.length > 0
    ? Math.round(atkActive.reduce((s, id) => s + (ctx.getBrigade(id)?.planPermille ?? 0), 0) / atkActive.length)
    : 0;

  battle.lastSnap = {
    id: battle.id, provinceId: battle.provinceId, provinceNameZh: prov.nameZh, terrain: prov.terrain,
    river: worstRiverCrossing(rivers), fortLevel, attackerTag: battle.attackerTag, defenderTag: battle.defenderTag,
    startTick: battle.startTick, durationTicks: Math.max(1, tick - battle.startTick), attackDirections,
    maxFrontline: slotCap.frontline, maxSupport: slotCap.support,
    advantageScore: computeAdvantageScore(atkPow, atkOrg, defPow, defOrg),
    attackerFront: battle.attackerFront.map((id) => toSlotSnap(id, true)),
    attackerSupport: battle.attackerSupport.map((id) => toSlotSnap(id, true)),
    attackerReserves: battle.attackerReserves.map((id) => toSlotSnap(id, true)),
    defenderFront: battle.defenderFront.map((id) => toSlotSnap(id, false)),
    defenderSupport: battle.defenderSupport.map((id) => toSlotSnap(id, false)),
    defenderReserves: battle.defenderReserves.map((id) => toSlotSnap(id, false)),
    defenderEntrenchAvgPermille: defEntAvg, attackerPlanAvgPermille: atkPlanAvg,
  };

  // Check collapse conditions (§4.9.5)
  const defFrontAlive = battle.defenderFront.some((id) => (ctx.getBrigade(id)?.orgPermille ?? 0) > 0);
  const defResAlive = battle.defenderReserves.some((id) => (ctx.getBrigade(id)?.orgPermille ?? 0) > 0);
  const defSupAlive = battle.defenderSupport.some((id) => (ctx.getBrigade(id)?.orgPermille ?? 0) > 0);
  if (!defFrontAlive && !defResAlive && (battle.defenderFront.length > 0 || !defSupAlive)) return 'attacker_won';

  const atkAlive = [...atkActive, ...battle.attackerReserves].some((id) => (ctx.getBrigade(id)?.orgPermille ?? 0) > 0);
  if (!atkAlive) return 'defender_won';

  return 'ongoing';
}
