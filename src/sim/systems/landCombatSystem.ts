/**
 * Deterministic Batch 06 LandCombatSystem: War States, Province Control/Occupation,
 * 6-Hour Battle State Machine, Retreat, Encirclement Wipeout & Daily Pocket Scanning.
 * Pure TypeScript — zero DOM/PIXI dependencies.
 */
import type { SeededRng } from '../core/SeededRng';
import { getSimProvince, SIM_PROVINCES } from '../data/provinces1936';
import { assignBrigadePath } from './armyMovement';
import type { ArmySystem } from './armySystem';
import type { BrigadeState } from './armyTypes';
import { executeOffensiveArrowsTick, updateBrigadeReadinessTick } from './arrowExecution';
import { resolveBattleTick, type ActiveBattleState } from './combatBattleStep';
import type { CombatSystemSnapshot, EncircledPocketSnap, WipeoutEvent } from './combatTypes';
import type { EquipmentType } from './industryTypes';
import type { NationModifiers } from './modifierTypes';
import { computeEncirclementWipeout, findRetreatProvince, scanEncircledPockets } from './retreatPocket';

export interface CombatTickAdapter {
  getModifiers: (tag: string) => Readonly<NationModifiers>;
  addCasualties: (tag: string, men: number) => void;
  refundEquipment: (tag: string, eqType: EquipmentType, units: number) => void;
  onDispatch?: (kind: 'info' | 'alert', textZh: string, focusTag?: string) => void;
}

function warKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export class LandCombatSystem {
  private wars = new Set<string>();
  private controllers = new Map<number, string>();
  private fortOverrides = new Map<number, number>();
  private battles = new Map<number, ActiveBattleState>();
  private pockets: EncircledPocketSnap[] = [];
  private recentWipeouts: WipeoutEvent[] = [];
  private destroyedEq = new Map<string, Partial<Record<EquipmentType, number>>>();
  private nextBattleId = 1;
  private nextWipeoutId = 1;

  reset(): void {
    this.wars.clear();
    this.controllers.clear();
    this.fortOverrides.clear();
    this.battles.clear();
    this.pockets = [];
    this.recentWipeouts = [];
    this.destroyedEq.clear();
    this.nextBattleId = 1;
    this.nextWipeoutId = 1;
  }

  declareWar(tagA: string, tagB: string): void {
    if (!tagA || !tagB || tagA === tagB) return;
    this.wars.add(warKey(tagA, tagB));
  }

  areAtWar = (tagA: string, tagB: string): boolean => {
    if (!tagA || !tagB || tagA === tagB) return false;
    return this.wars.has(warKey(tagA, tagB));
  };

  getHostileTagsFor(tag: string): Set<string> {
    const out = new Set<string>();
    for (const k of this.wars) {
      const [a, b] = k.split(':') as [string, string];
      if (a === tag) out.add(b);
      else if (b === tag) out.add(a);
    }
    return out;
  }

  getAtWarTags(): Set<string> {
    const out = new Set<string>();
    for (const k of this.wars) {
      const [a, b] = k.split(':') as [string, string];
      out.add(a);
      out.add(b);
    }
    return out;
  }

  getController = (provId: number): string => {
    return this.controllers.get(provId) ?? getSimProvince(provId)?.owner ?? '';
  };

  setController(provId: number, newController: string): void {
    const p = getSimProvince(provId);
    if (!p) return;
    if (p.owner === newController) this.controllers.delete(provId);
    else this.controllers.set(provId, newController);
  }

  setFortLevelOverride(provId: number, level: number): void {
    this.fortOverrides.set(provId, Math.max(0, Math.min(5, Math.trunc(level))));
  }

  /** Start or join a province attack; returns 'occupy_empty' if no defenders hold targetProvId. */
  startOrJoinAttack(
    brigade: BrigadeState,
    targetProvId: number,
    tick: number,
    army: ArmySystem,
  ): 'started' | 'occupy_empty' | 'invalid' {
    const cur = getSimProvince(brigade.provinceId);
    const tgt = getSimProvince(targetProvId);
    if (!cur || !tgt || !cur.neighbors.includes(targetProvId)) return 'invalid';
    const defTag = this.getController(targetProvId);
    if (!this.areAtWar(brigade.owner, defTag)) return 'invalid';

    const defenders = army
      .getAllBrigades()
      .filter((b) => b.provinceId === targetProvId && b.owner === defTag && !b.retreating && b.orgPermille > 0);
    if (defenders.length === 0 && !this.battles.has(targetProvId)) return 'occupy_empty';

    let battle = this.battles.get(targetProvId);
    if (!battle) {
      battle = {
        id: this.nextBattleId++,
        provinceId: targetProvId,
        attackerTag: brigade.owner,
        defenderTag: defTag,
        startTick: tick,
        fortLevelOverride: this.fortOverrides.get(targetProvId),
        attackerFromProv: new Map(),
        attackerFront: [],
        attackerSupport: [],
        attackerReserves: [],
        defenderFront: [],
        defenderSupport: [],
        defenderReserves: [],
        lastSnap: null,
      };
      this.battles.set(targetProvId, battle);
    }
    if (battle.attackerTag !== brigade.owner) return 'invalid';

    battle.attackerFromProv.set(brigade.id, brigade.provinceId);
    brigade.inCombatBattleId = battle.id;
    brigade.entrenchPermille = 0;
    return 'started';
  }

  /** Advance readiness, offensive arrow attacks, and all active province battles by 1 tick. */
  stepTick(tick: number, rng: SeededRng, army: ArmySystem, adapter: CombatTickAdapter): boolean {
    let changed = false;
    updateBrigadeReadinessTick(army.getAllBrigades(), (id) => army.getArmy(id), tick);

    if (this.wars.size > 0) {
      executeOffensiveArrowsTick(army.getAllArmies(), (id) => army.getBrigade(id), {
        getController: this.getController,
        areAtWar: this.areAtWar,
        onInitiateAttack: (b, targetPid) => {
          const res = this.startOrJoinAttack(b, targetPid, tick, army);
          if (res === 'occupy_empty') {
            const spd = army.getArmySpeedMod(b.owner, b.armyId, adapter.getModifiers(b.owner).army_speed);
            assignBrigadePath(b, targetPid, spd, false, this.getHostileTagsFor(b.owner), this.getController);
          }
          if (res !== 'invalid') changed = true;
        },
      });
    }

    const activeProvIds = new Set<number>(this.battles.keys());
    for (const provId of [...this.battles.keys()].sort((a, b) => a - b)) {
      const battle = this.battles.get(provId)!;
      const outcome = resolveBattleTick(battle, tick, rng, {
        getBrigade: (id) => army.getBrigade(id),
        getAllBrigades: () => army.getAllBrigades(),
        getArmy: (id) => army.getArmy(id),
        getModifiers: adapter.getModifiers,
        addCasualties: adapter.addCasualties,
        recordEquipmentLoss: (tag, eq, u) => {
          const rec = this.destroyedEq.get(tag) ?? {};
          rec[eq] = (rec[eq] ?? 0) + u;
          this.destroyedEq.set(tag, rec);
        },
      });
      changed = true;
      if (outcome !== 'ongoing') {
        this.finishBattle(battle, outcome, tick, army, activeProvIds, adapter);
      }
    }
    return changed;
  }

  private finishBattle(
    battle: ActiveBattleState,
    outcome: 'attacker_won' | 'defender_won',
    tick: number,
    army: ArmySystem,
    activeProvIds: Set<number>,
    adapter: CombatTickAdapter,
  ): void {
    this.battles.delete(battle.provinceId);
    activeProvIds.delete(battle.provinceId);

    const attackers = [...battle.attackerFromProv.keys()]
      .map((id) => army.getBrigade(id))
      .filter((b): b is BrigadeState => b !== undefined);
    const defenders = army
      .getAllBrigades()
      .filter((b) => b.provinceId === battle.provinceId && b.owner === battle.defenderTag);

    for (const a of attackers) if (a.inCombatBattleId === battle.id) a.inCombatBattleId = null;
    for (const d of defenders) if (d.inCombatBattleId === battle.id) d.inCombatBattleId = null;

    if (outcome === 'defender_won') {
      for (const a of attackers) {
        a.path = [];
        a.moveTargetProvId = null;
      }
      return;
    }

    // Attacker won: retreat defenders or wipe out if encircled
    const retreatTarget = findRetreatProvince(battle.provinceId, battle.defenderTag, this.getController, activeProvIds);
    const provName = getSimProvince(battle.provinceId)?.nameZh ?? `#${battle.provinceId}`;

    if (retreatTarget !== null) {
      const spdMod = adapter.getModifiers(battle.defenderTag).army_speed;
      for (const d of defenders) {
        d.orgPermille = Math.max(50, d.orgPermille);
        d.entrenchPermille = 0;
        d.planPermille = 0;
        d.manualOverride = false;
        const ok = assignBrigadePath(d, retreatTarget, spdMod, false, undefined, this.getController);
        if (ok) d.retreating = true;
        else d.provinceId = retreatTarget;
      }
    } else if (defenders.length > 0) {
      const loot = computeEncirclementWipeout(defenders);
      adapter.addCasualties(battle.defenderTag, loot.manpowerLost);
      for (const [eq, units] of Object.entries(loot.equipmentCaptured)) {
        if (units && units > 0) adapter.refundEquipment(battle.attackerTag, eq as EquipmentType, units);
      }
      for (const d of defenders) army.removeBrigade(d.id);
      const ev: WipeoutEvent = {
        id: this.nextWipeoutId++,
        tick,
        provinceId: battle.provinceId,
        provinceNameZh: provName,
        victimTag: battle.defenderTag,
        victorTag: battle.attackerTag,
        brigadeCount: defenders.length,
        manpowerLost: loot.manpowerLost,
        equipmentCaptured: loot.equipmentCaptured,
      };
      this.recentWipeouts.unshift(ev);
      if (this.recentWipeouts.length > 8) this.recentWipeouts.length = 8;
      adapter.onDispatch?.('alert', `合围歼灭！在${provName}全歼敌军 ${defenders.length} 旅并缴获 15% 装备`, battle.attackerTag);
    }

    // Advance vanguard attackers into conquered province & flip controller
    this.setController(battle.provinceId, battle.attackerTag);
    const vanguards = attackers.filter((a) => a.orgPermille > 0);
    const moveList = vanguards.slice(0, Math.max(1, Math.min(4, vanguards.length)));
    for (const a of moveList) {
      a.provinceId = battle.provinceId;
      a.path = a.path.filter((pid) => pid !== battle.provinceId);
      if (a.path.length === 0) {
        a.moveTargetProvId = null;
        a.manualOverride = false;
      }
      a.moveProgressFixed = 0;
      a.moveEdgeCostFixed = 0;
    }
    army.refreshFrontlines(this.getController);
    this.scanPockets(army);
  }

  scanPockets(army: ArmySystem): void {
    const warTags = this.getAtWarTags();
    if (warTags.size === 0) {
      this.pockets = [];
      return;
    }
    this.pockets = scanEncircledPockets(army.getAllBrigades(), this.getController, warTags, this.areAtWar);
  }

  getDestroyedEquipment(tag: string): Partial<Record<EquipmentType, number>> {
    return { ...(this.destroyedEq.get(tag) ?? {}) };
  }

  getActiveBattles(): ActiveBattleState[] {
    return [...this.battles.values()].sort((a, b) => a.provinceId - b.provinceId);
  }

  getSnapshot(): CombatSystemSnapshot {
    const wars: Array<[string, string]> = [...this.wars].sort().map((k) => k.split(':') as [string, string]);
    const occupiedProvinces = [...this.controllers.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([provId, controller]) => ({
        provId,
        coreOwner: getSimProvince(provId)?.owner ?? '',
        controller,
      }));
    const battles = [...this.battles.values()]
      .sort((a, b) => a.provinceId - b.provinceId)
      .map((b) => b.lastSnap)
      .filter((s): s is NonNullable<typeof s> => s !== null);
    return {
      wars,
      occupiedProvinces,
      battles,
      pockets: this.pockets.map((p) => ({ ...p, provinceIds: p.provinceIds.slice(), brigadeIds: p.brigadeIds.slice() })),
      recentWipeouts: this.recentWipeouts.map((w) => ({ ...w, equipmentCaptured: { ...w.equipmentCaptured } })),
    };
  }

  mixHash(mix: (v: number) => void): void {
    mix(this.wars.size + (this.controllers.size << 8) + (this.battles.size << 16));
    for (const [pid, ctrl] of [...this.controllers.entries()].sort((a, b) => a[0] - b[0])) {
      mix(pid ^ (ctrl.charCodeAt(0) << 12) ^ (ctrl.charCodeAt(1) << 20));
    }
    for (const b of [...this.battles.values()].sort((a, b) => a.provinceId - b.provinceId)) {
      mix(b.id + (b.provinceId << 10) + (b.attackerFromProv.size << 22));
      if (b.lastSnap) mix((b.lastSnap.advantageScore + 128) + (b.lastSnap.durationTicks << 10));
    }
    mix(this.pockets.length + (this.recentWipeouts.length << 12));
  }
}

export { SIM_PROVINCES };
