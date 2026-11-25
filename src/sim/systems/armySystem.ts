/**
 * Deterministic Land Army, Brigade Training, Frontline Binding & Order System (Batch 05).
 * Pure TypeScript — zero DOM/PIXI references.
 */
import {
  ARMY_COLORS,
  BRIGADE_TEMPLATES,
  MAX_ARMY_BRIGADES,
  type BrigadeType,
} from '../data/brigadeTemplates';
import { getCommandersForNation, getCommanderSpeedBonusPermille } from '../data/commanders1936';
import {
  buildOpeningBrigadesForNation,
  getAllOpeningNationProfiles,
  getOpeningArmyDefs,
} from '../data/openingArmies1936';
import { getCapitalProvince, getLandNeighborTags, getSimProvince } from '../data/provinces1936';
import {
  assignBrigadePath,
  mixArmyStateHash,
  stepBrigadesMovementTick,
  toArmySnap,
  toBrigadeSnap,
  type StepEnterDecision,
} from './armyMovement';
import {
  buildFrontlineOrder,
  buildOffensiveArrowOrder,
  computeFrontlineAssignments,
  type ControllerResolver,
} from './armyOrderSystem';
import type { ArmyState, ArmySystemSnapshot, BrigadeState, TrainingOrderState } from './armyTypes';
import {
  advanceTrainingOrdersDaily,
  createTrainingOrder,
  MIN_DEPLOY_ORG_PERMILLE,
  MIN_DEPLOY_STRENGTH_PERMILLE,
  refundTrainingOrder,
  toTrainingOrderSnap,
  type TrainingResourceAdapter,
} from './trainingSystem';

export interface DeployedBrigadeEvent {
  owner: string;
  brigadeId: number;
  template: BrigadeType;
  provinceNameZh: string;
  strengthPermille: number;
}

export class ArmySystem {
  private brigades: BrigadeState[] = [];
  private brigadeById = new Map<number, BrigadeState>();
  private armies: ArmyState[] = [];
  private armyById = new Map<number, ArmyState>();
  private training: TrainingOrderState[] = [];
  private nextBrigadeId = 1;
  private nextArmyId = 1;
  private nextTrainingId = 1;
  private nextArrowId = 1;
  private brigadeOrdinalByTag = new Map<string, number>();

  reset(): void {
    this.brigades = [];
    this.brigadeById.clear();
    this.armies = [];
    this.armyById.clear();
    this.training = [];
    this.nextBrigadeId = 1;
    this.nextArmyId = 1;
    this.nextTrainingId = 1;
    this.nextArrowId = 1;
    this.brigadeOrdinalByTag.clear();

    for (const profile of getAllOpeningNationProfiles()) {
      const plans = buildOpeningBrigadesForNation(profile);
      const armyDefs = getOpeningArmyDefs(profile.tag, plans.length);
      const cmdPool = getCommandersForNation(profile.tag);
      const createdArmies: ArmyState[] = armyDefs.map((d, idx) =>
        this.spawnArmyInternal(
          profile.tag,
          d.nameZh,
          ARMY_COLORS[d.colorIndex % ARMY_COLORS.length]!,
          cmdPool[idx]?.id ?? null,
        ),
      );
      for (const plan of plans) {
        const army = createdArmies[plan.armySlot] ?? createdArmies[0] ?? null;
        this.spawnBrigadeInternal(profile.tag, plan.template, plan.provinceId, army?.id ?? null, 1000, 1000);
      }
    }
  }

  private spawnArmyInternal(
    owner: string,
    nameZh: string,
    color: string,
    commanderId: string | null = null,
  ): ArmyState {
    const a: ArmyState = {
      id: this.nextArmyId++,
      owner,
      nameZh,
      color,
      commanderId,
      brigadeIds: [],
      frontline: null,
      arrow: null,
    };
    this.armies.push(a);
    this.armyById.set(a.id, a);
    return a;
  }

  private spawnBrigadeInternal(
    owner: string,
    template: BrigadeType,
    provinceId: number,
    armyId: number | null,
    orgPermille: number,
    strengthPermille: number,
  ): BrigadeState {
    const ord = (this.brigadeOrdinalByTag.get(owner) ?? 0) + 1;
    this.brigadeOrdinalByTag.set(owner, ord);
    const shortZh = BRIGADE_TEMPLATES[template].shortZh;
    const b: BrigadeState = {
      id: this.nextBrigadeId++,
      owner,
      template,
      nameZh: `第${ord}${shortZh}旅`,
      provinceId,
      armyId: null,
      orgPermille,
      strengthPermille,
      path: [],
      moveProgressFixed: 0,
      moveEdgeCostFixed: 0,
      moveTargetProvId: null,
      manualOverride: false,
      entrenchPermille: 0,
      planPermille: 0,
      inCombatBattleId: null,
      retreating: false,
    };
    this.brigades.push(b);
    this.brigadeById.set(b.id, b);
    if (armyId !== null) this.attachToArmy(b, armyId);
    return b;
  }

  private attachToArmy(b: BrigadeState, armyId: number | null): boolean {
    if (b.armyId !== null) {
      const old = this.armyById.get(b.armyId);
      if (old) old.brigadeIds = old.brigadeIds.filter((id) => id !== b.id);
      b.armyId = null;
    }
    if (armyId === null) return true;
    const target = this.armyById.get(armyId);
    if (!target || target.owner !== b.owner || target.brigadeIds.length >= MAX_ARMY_BRIGADES) return false;
    target.brigadeIds.push(b.id);
    b.armyId = armyId;
    return true;
  }

  createArmy(owner: string, nameZh?: string): ArmyState {
    const ownCount = this.armies.filter((a) => a.owner === owner).length;
    const color = ARMY_COLORS[ownCount % ARMY_COLORS.length]!;
    return this.spawnArmyInternal(owner, nameZh?.trim() || `第${ownCount + 1}野战集团军`, color);
  }

  disbandArmy(owner: string, armyId: number): boolean {
    const army = this.armyById.get(armyId);
    if (!army || army.owner !== owner) return false;
    for (const bid of army.brigadeIds) {
      const b = this.brigadeById.get(bid);
      if (b) b.armyId = null;
    }
    this.armyById.delete(armyId);
    this.armies = this.armies.filter((a) => a.id !== armyId);
    return true;
  }

  assignBrigadeToArmy(owner: string, brigadeId: number, armyId: number | null): boolean {
    const b = this.brigadeById.get(brigadeId);
    if (!b || b.owner !== owner) return false;
    return this.attachToArmy(b, armyId);
  }

  assignCommander(owner: string, armyId: number, commanderId: string | null): boolean {
    const army = this.armyById.get(armyId);
    if (!army || army.owner !== owner) return false;
    if (commanderId !== null) {
      for (const other of this.armies) {
        if (other.owner === owner && other.commanderId === commanderId && other.id !== armyId) {
          other.commanderId = null;
        }
      }
    }
    army.commanderId = commanderId;
    return true;
  }

  getArmySpeedMod(tag: string, armyId: number | null, baseMod: number): number {
    if (armyId === null) return baseMod;
    const a = this.armyById.get(armyId);
    if (!a || a.owner !== tag) return baseMod;
    return baseMod + getCommanderSpeedBonusPermille(a.commanderId);
  }

  marchBrigades(
    owner: string,
    brigadeIds: readonly number[],
    targetProvId: number,
    speedModPermille: number,
    hostileTags?: ReadonlySet<string>,
    getController?: ControllerResolver,
  ): number {
    let moved = 0;
    for (const bid of brigadeIds) {
      const b = this.brigadeById.get(bid);
      if (!b || b.owner !== owner || b.retreating) continue;
      const spd = this.getArmySpeedMod(owner, b.armyId, speedModPermille);
      if (assignBrigadePath(b, targetProvId, spd, true, hostileTags, getController)) {
        moved += 1;
      }
    }
    return moved;
  }

  unlockManualOverride(owner: string, brigadeId: number): boolean {
    const b = this.brigadeById.get(brigadeId);
    if (!b || b.owner !== owner || !b.manualOverride) return false;
    b.manualOverride = false;
    return true;
  }

  bindFrontline(
    owner: string,
    armyId: number,
    targetTag: string,
    speedModPermille: number,
    getController?: ControllerResolver,
  ): boolean {
    const army = this.armyById.get(armyId);
    if (!army || army.owner !== owner) return false;
    const fl = buildFrontlineOrder(owner, targetTag, getController);
    if (!fl) return false;
    army.frontline = fl;
    if (army.arrow && army.arrow.targetTag !== targetTag) army.arrow = null;
    this.dispatchArmyFrontline(army, speedModPermille, getController);
    return true;
  }

  clearFrontline(owner: string, armyId: number): boolean {
    const army = this.armyById.get(armyId);
    if (!army || army.owner !== owner) return false;
    army.frontline = null;
    army.arrow = null;
    return true;
  }

  setOffensiveArrow(
    owner: string,
    armyId: number,
    startProvId: number | null,
    targetProvId: number,
    bendOffsetX?: number,
    bendOffsetY?: number,
    getController?: ControllerResolver,
  ): boolean {
    const army = this.armyById.get(armyId);
    if (!army || army.owner !== owner) return false;
    const order = buildOffensiveArrowOrder(
      this.nextArrowId++,
      army,
      startProvId,
      targetProvId,
      bendOffsetX,
      bendOffsetY,
      getController,
    );
    if (!order) return false;
    army.arrow = order;
    return true;
  }

  toggleOffensiveArrowActive(owner: string, armyId: number, active?: boolean): boolean {
    const army = this.armyById.get(armyId);
    if (!army || army.owner !== owner || !army.arrow) return false;
    army.arrow.active = typeof active === 'boolean' ? active : !army.arrow.active;
    return true;
  }

  clearOffensiveArrow(owner: string, armyId: number): boolean {
    const army = this.armyById.get(armyId);
    if (!army || army.owner !== owner) return false;
    army.arrow = null;
    return true;
  }

  /** Refresh an army's frontline after province control shifts. */
  refreshFrontlines(getController: ControllerResolver): void {
    for (const army of this.armies) {
      if (!army.frontline) continue;
      const updated = buildFrontlineOrder(army.owner, army.frontline.targetTag, getController);
      if (updated) {
        army.frontline = updated;
      }
      if (army.arrow && getController(army.arrow.targetProvId) === army.owner) {
        army.arrow.active = false;
      }
    }
  }

  /** Dispatch non-manualOverride brigades of an army evenly onto its bound frontline. */
  dispatchArmyFrontline(army: ArmyState, speedModPermille: number, getController?: ControllerResolver): void {
    if (!army.frontline) return;
    const brigs = army.brigadeIds
      .map((id) => this.brigadeById.get(id))
      .filter((b): b is BrigadeState => b !== undefined);
    const assignMap = computeFrontlineAssignments(army.frontline, brigs, army.owner, getController);
    const spd = this.getArmySpeedMod(army.owner, army.id, speedModPermille);
    for (const [bid, targetProvId] of assignMap.entries()) {
      const b = this.brigadeById.get(bid);
      if (!b || b.manualOverride || b.inCombatBattleId !== null || b.retreating) continue;
      if (b.provinceId === targetProvId && b.path.length === 0) continue;
      if (b.moveTargetProvId === targetProvId) continue;
      assignBrigadePath(b, targetProvId, spd, false, undefined, getController);
    }
  }

  queueTraining(
    owner: string,
    template: BrigadeType,
    deployProvId: number | null | undefined,
    armyId: number | null,
    trainingTimeModPermille: number,
    res: TrainingResourceAdapter,
  ): TrainingOrderState | null {
    const validArmy = armyId !== null && this.armyById.get(armyId)?.owner === owner ? armyId : null;
    const order = createTrainingOrder(
      this.nextTrainingId++,
      owner,
      template,
      deployProvId,
      validArmy,
      trainingTimeModPermille,
      res,
    );
    if (!order) return null;
    this.training.push(order);
    return order;
  }

  cancelTraining(owner: string, orderId: number, res: TrainingResourceAdapter): boolean {
    const idx = this.training.findIndex((o) => o.id === orderId && o.owner === owner);
    if (idx < 0) return false;
    const [removed] = this.training.splice(idx, 1);
    refundTrainingOrder(removed!, res);
    return true;
  }

  stepTick(
    getSpeedMod: (tag: string) => number,
    hooks?: {
      getController?: ControllerResolver;
      onBeforeEnterProvince?: (b: BrigadeState, nextProvId: number) => StepEnterDecision;
      onEnteredProvince?: (b: BrigadeState, provId: number) => void;
    },
  ): void {
    stepBrigadesMovementTick(
      this.brigades,
      (tag, aid) => this.getArmySpeedMod(tag, aid, getSpeedMod(tag)),
      hooks?.onBeforeEnterProvince,
      hooks?.onEnteredProvince,
    );
    for (const army of this.armies) {
      if (army.frontline) {
        this.dispatchArmyFrontline(army, getSpeedMod(army.owner), hooks?.getController);
      }
    }
  }

  stepDaily(getTrainingTimeMod: (tag: string) => number): DeployedBrigadeEvent[] {
    const { remaining, completed } = advanceTrainingOrdersDaily(this.training, getTrainingTimeMod);
    this.training = remaining;
    const events: DeployedBrigadeEvent[] = [];
    for (const o of completed) {
      const prov = getSimProvince(o.deployProvId);
      const deployId = prov && prov.owner === o.owner ? prov.id : (getCapitalProvince(o.owner)?.id ?? o.deployProvId);
      const str = Math.max(MIN_DEPLOY_STRENGTH_PERMILLE, o.equipmentRatioPermille);
      const org = Math.max(MIN_DEPLOY_ORG_PERMILLE, o.equipmentRatioPermille);
      const b = this.spawnBrigadeInternal(o.owner, o.template, deployId, o.armyId, org, str);
      events.push({
        owner: o.owner,
        brigadeId: b.id,
        template: b.template,
        provinceNameZh: getSimProvince(deployId)?.nameZh ?? `#${deployId}`,
        strengthPermille: str,
      });
    }
    return events;
  }

  /** Demo debug preset (`?demoFrontline=GER_POL`): zero war declaration, clean GER-POL front + Warsaw pincer. */
  applyDemoFrontline(code: string): void {
    if (code.toUpperCase() !== 'GER_POL') return;
    const gerArmies = this.armies.filter((a) => a.owner === 'GER');
    const army1 = gerArmies[0];
    if (!army1) return;
    const fl = buildFrontlineOrder('GER', 'POL');
    if (!fl) return;

    const southSet = new Set([245, 235, 247]);
    const southProvs = fl.friendlyProvIds.filter((id) => southSet.has(id));
    const northProvs = fl.friendlyProvIds.filter((id) => !southSet.has(id));
    const useSplit = gerArmies.length >= 2 && gerArmies[1]!.brigadeIds.length > 8 && southProvs.length > 0 && northProvs.length > 0;

    army1.frontline = useSplit
      ? {
          targetTag: 'POL',
          friendlyProvIds: northProvs,
          borderPairs: fl.borderPairs.filter((p) => !southSet.has(p.friendlyProvId)),
        }
      : fl;

    const brigs1 = army1.brigadeIds
      .map((id) => this.brigadeById.get(id))
      .filter((b): b is BrigadeState => b !== undefined);
    const front1 = army1.frontline.friendlyProvIds;
    for (let i = 0; i < brigs1.length; i++) {
      const b = brigs1[i]!;
      b.provinceId = front1[i % front1.length]!;
      b.path = [];
      b.moveProgressFixed = 0;
      b.moveEdgeCostFixed = 0;
      b.moveTargetProvId = null;
      b.manualOverride = false;
    }

    const warsaw = getCapitalProvince('POL');
    if (warsaw) {
      const startEastPrussia = front1.includes(250) ? 250 : front1[0]!;
      army1.arrow = buildOffensiveArrowOrder(this.nextArrowId++, army1, startEastPrussia, warsaw.id, 34, -4);

      if (useSplit) {
        const army2 = gerArmies[1]!;
        const vanguard = this.spawnArmyInternal('GER', '西里西亚装甲先锋', '#2F6690');
        vanguard.frontline = {
          targetTag: 'POL',
          friendlyProvIds: southProvs,
          borderPairs: fl.borderPairs.filter((p) => southSet.has(p.friendlyProvId)),
        };
        const movedIds = army2.brigadeIds.slice(0, 5);
        movedIds.forEach((bid, idx) => {
          const b = this.brigadeById.get(bid);
          if (b) {
            this.attachToArmy(b, vanguard.id);
            b.provinceId = southProvs[idx % southProvs.length]!;
          }
        });
        const startSouth = southProvs.includes(235) ? 235 : southProvs[0]!;
        vanguard.arrow = buildOffensiveArrowOrder(this.nextArrowId++, vanguard, startSouth, warsaw.id, -18, 22);
      }
    }
  }

  getDeployedManpower(tag: string): number {
    let sum = 0;
    for (const b of this.brigades) {
      if (b.owner === tag) {
        sum += Math.floor((BRIGADE_TEMPLATES[b.template].manpower * b.strengthPermille) / 1000);
      }
    }
    return sum;
  }

  getAllBrigades(): readonly BrigadeState[] {
    return this.brigades;
  }

  getAllArmies(): readonly ArmyState[] {
    return this.armies;
  }

  spawnBrigadeForTest(
    owner: string,
    template: BrigadeType,
    provinceId: number,
    armyId: number | null = null,
    orgPermille = 1000,
    strengthPermille = 1000,
  ): BrigadeState {
    return this.spawnBrigadeInternal(owner, template, provinceId, armyId, orgPermille, strengthPermille);
  }

  removeBrigade(id: number): BrigadeState | null {
    const b = this.brigadeById.get(id);
    if (!b) return null;
    if (b.armyId !== null) {
      const a = this.armyById.get(b.armyId);
      if (a) a.brigadeIds = a.brigadeIds.filter((bid) => bid !== id);
    }
    this.brigadeById.delete(id);
    this.brigades = this.brigades.filter((x) => x.id !== id);
    return b;
  }

  getInTrainingManpower(tag: string): number {
    let sum = 0;
    for (const o of this.training) {
      if (o.owner === tag) sum += o.manpowerAllocated;
    }
    return sum;
  }

  getBrigadeCount(tag: string): number {
    let cnt = 0;
    for (const b of this.brigades) if (b.owner === tag) cnt += 1;
    return cnt;
  }

  getBrigade(id: number): BrigadeState | undefined {
    return this.brigadeById.get(id);
  }

  getArmy(id: number): ArmyState | undefined {
    return this.armyById.get(id);
  }

  getArmiesFor(tag: string): ArmyState[] {
    return this.armies.filter((a) => a.owner === tag);
  }

  getSnapshotFor(
    playerTag: string,
    getSpeedMod: (tag: string) => number,
    trainingTimeModPermille: number,
  ): ArmySystemSnapshot {
    return {
      playerTag,
      trainingTimeModPermille,
      brigades: this.brigades.map((b) => toBrigadeSnap(b, getSpeedMod(b.owner))),
      armies: this.armies.map(toArmySnap),
      trainingQueue: this.training.filter((o) => o.owner === playerTag).map(toTrainingOrderSnap),
      neighborTags: getLandNeighborTags(playerTag),
      deployedManpower: this.getDeployedManpower(playerTag),
      inTrainingManpower: this.getInTrainingManpower(playerTag),
    };
  }

  mixHash(mix: (v: number) => void): void {
    mixArmyStateHash(mix, this.brigades, this.armies, this.training);
  }
}
