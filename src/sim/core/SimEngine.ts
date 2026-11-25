/**
 * Pure deterministic simulation kernel (Batch 02: clock, RNG, country select, date stepping, nation snapshots).
 * Zero DOM/window/PIXI references — runs identically in Web Worker and Node Vitest.
 */
import { dateStringToTick, formatDateIso, TICKS_PER_DAY, tickToDate, type SimSpeed } from './ClockCalendar';
import { clampInt, FIXED_SCALE, mulFixed } from './FixedMath';
import {
  CommandQueue,
  type AssignBrigadeArmyPayload,
  type AssignCommanderPayload,
  type BindFrontlinePayload,
  type CancelConstructionPayload,
  type CancelResearchPayload,
  type CancelTrainingPayload,
  type ClearFrontlinePayload,
  type ClearOffensiveArrowPayload,
  type CreateArmyPayload,
  type DisbandArmyPayload,
  type GameCommand,
  type InitScenarioPayload,
  type MarchBrigadesPayload,
  type QueueConstructionPayload,
  type QueueTrainingPayload,
  type ReorderConstructionPayload,
  type SelectCountryPayload,
  type SetDatePayload,
  type SetGovernanceLawPayload,
  type SetLineFactoriesPayload,
  type SetOffensiveArrowPayload,
  type SetSpeedPayload,
  type StartResearchPayload,
  type SwitchProductionLinePayload,
  type ToggleArrowActivePayload,
  type ToggleAutoTradePayload,
  type TogglePausePayload,
  type UnlockManualOverridePayload,
} from './GameCommand';
import { SeededRng } from './SeededRng';
import type { SimNationSnapshot, WorldSnapshot } from './SnapshotCodec';
import { BRIGADE_TEMPLATES } from '../data/brigadeTemplates';
import { ALL_PLAYABLE_NATIONS_1936, isPlayableTag } from '../data/nations1936';
import { ArmySystem } from '../systems/armySystem';
import type { ArmySystemSnapshot } from '../systems/armyTypes';
import type { CombatSystemSnapshot } from '../systems/combatTypes';
import { GovernanceSystem } from '../systems/governanceSystem';
import type { GovernanceSnapshot } from '../systems/governanceTypes';
import { IndustrySystem, type IndustryLawTechMods } from '../systems/industrySystem';
import { BUILDING_SPECS, type IndustrySnapshot } from '../systems/industryTypes';
import { LandCombatSystem } from '../systems/landCombatSystem';
import { ManpowerSystem } from '../systems/manpowerSystem';
import { applyMockWarPreset } from '../systems/mockWarPresets';
import { ALL_MODIFIER_KEYS, createEmptyModifiers, type NationModifiers } from '../systems/modifierTypes';
import { TechSystem } from '../systems/techSystem';
import type { TechSnapshot } from '../systems/techTypes';

export interface TickerDispatch {
  id: number;
  tick: number;
  dateIso: string;
  kind: 'info' | 'alert' | 'routine';
  textZh: string;
  focusTag?: string;
}

const MAX_TICKER_HISTORY = 12;

export class SimEngine {
  tick = 0;
  speed: SimSpeed = 2;
  paused = true;
  seed = 19360101;
  playerTag = 'GER';
  crisisPermille = 50; // 5.0% opening tension in 1936
  seqNo = 0;

  private rng: SeededRng;
  private nations: SimNationSnapshot[] = [];
  private readonly commands = new CommandQueue();
  private readonly industry = new IndustrySystem();
  private readonly governance = new GovernanceSystem();
  private readonly manpower = new ManpowerSystem();
  private readonly tech = new TechSystem();
  private readonly army = new ArmySystem();
  private readonly combat = new LandCombatSystem();
  private dispatches: TickerDispatch[] = [];
  private nextDispatchId = 1;
  private industryRevision = 1;
  private armyRevision = 1;

  constructor(seed = 19360101, playerTag = 'GER') {
    this.seed = seed >>> 0;
    this.rng = new SeededRng(this.seed);
    this.resetScenario({ scenarioId: '1936', countryTag: playerTag, seed: this.seed, paused: true, speed: 2 });
  }

  resetScenario(opts: InitScenarioPayload): void {
    this.tick = 0;
    this.seed = opts.seed >>> 0;
    this.rng = new SeededRng(this.seed);
    this.playerTag = isPlayableTag(opts.countryTag) ? opts.countryTag : 'GER';
    this.speed = opts.speed ?? 2;
    this.paused = opts.paused ?? true;
    this.crisisPermille =
      typeof opts.crisisPermille === 'number'
        ? clampInt(opts.crisisPermille, 0, FIXED_SCALE)
        : 50;
    this.seqNo = 0;
    this.commands.clear();
    this.dispatches = [];
    this.nextDispatchId = 1;

    this.nations = ALL_PLAYABLE_NATIONS_1936.map((p) => {
      const apDaily = this.calcDailyAp(p.cohesion);
      return {
        tag: p.tag,
        apPermille: p.apStart * FIXED_SCALE,
        apDailyPermille: apDaily,
        cohesionPermille: p.cohesion,
        readinessPermille: p.readiness,
        manpowerK: p.manpowerK,
        civ: p.civ,
        mil: p.mil,
        doc: p.doc,
        steelNet: p.steel,
        oilNet: p.oil,
        rareNet: p.rare,
        brigades: p.brigades,
        ships: p.ships,
        airWings: p.airWings,
        researchSlots: p.researchSlots,
        regime: p.regime,
        isMajor: p.isMajor,
      };
    });

    const playerNation = this.findNation(this.playerTag);
    if (playerNation) {
      if (typeof opts.playerAp === 'number') {
        playerNation.apPermille = clampInt(Math.round(opts.playerAp * FIXED_SCALE), 0, 999 * FIXED_SCALE);
      }
      if (typeof opts.playerMobilizationPermille === 'number') {
        playerNation.readinessPermille = clampInt(opts.playerMobilizationPermille, 0, FIXED_SCALE);
      }
    }

    this.governance.reset();
    this.governance.setWarFlags(this.playerTag, {
      atWar: opts.playerAtWar,
      atWarWithMajor: opts.playerAtWarWithMajor,
      homelandInvaded: opts.playerHomelandInvaded,
      armyInferior: opts.playerArmyInferior,
    });

    this.tech.reset(tickToDate(this.tick).year, (tag) => this.getCombinedModifiers(tag).research_speed);
    this.manpower.reset((tag) => ({
      baseRatePermille: this.governance.getBaseConscriptionPermille(tag),
      rateModifierPermille: this.getCombinedModifiers(tag).conscription_rate,
    }));

    this.industry.reset(this.getCohesionMap(), this.buildIndustryModsMap());
    if (typeof opts.autoTrade === 'boolean') {
      this.industry.toggleAutoTrade(this.playerTag, opts.autoTrade, this.getCohesionMap());
    }
    if (opts.initialQueue && opts.initialQueue.length > 0) {
      const coh = this.getCohesionMap();
      for (const item of opts.initialQueue) {
        this.industry.queueConstruction(this.playerTag, item.regionId, item.building, coh);
      }
    }

    this.army.reset();
    this.combat.reset();
    if (opts.demoFrontline) {
      this.army.applyDemoFrontline(opts.demoFrontline);
    }
    if (opts.mockWar) {
      applyMockWarPreset(opts.mockWar, this.army, this.combat, (tag) => {
        this.governance.setWarFlags(tag, { atWar: true });
      });
    }

    this.syncNationsFromSystems();
    this.pushDispatch(
      opts.mockWar ? 'alert' : 'info',
      opts.mockWar ? '德波边境爆发陆战，各集团军已进入战备状态。' : '1936 欧洲参谋部总图就绪，等待签批指令。',
      this.playerTag,
    );

    if (opts.initialLaws && opts.initialLaws.length > 0) {
      for (const item of opts.initialLaws) {
        this.applyLawSwitch(this.playerTag, item.slot, item.lawId);
      }
    }
    if (opts.initialResearch && opts.initialResearch.length > 0) {
      const yr = tickToDate(this.tick).year;
      for (const techId of opts.initialResearch) {
        this.tech.startResearch(this.playerTag, techId, yr, this.getCombinedModifiers(this.playerTag).research_speed);
      }
    }
    if (opts.initialTraining && opts.initialTraining.length > 0) {
      const trainMod = this.getCombinedModifiers(this.playerTag).training_time;
      const defaultArmy = this.army.getArmiesFor(this.playerTag)[0]?.id ?? null;
      for (const item of opts.initialTraining) {
        this.army.queueTraining(
          this.playerTag,
          item.template,
          item.deployProvId,
          defaultArmy,
          trainMod,
          this.getTrainingAdapter(),
        );
      }
      this.syncNationsFromSystems();
    }

    this.industryRevision += 1;
    this.armyRevision += 1;

    if (opts.startDate) {
      const targetTick = dateStringToTick(opts.startDate);
      if (targetTick !== null && targetTick > 0) {
        this.stepMany(targetTick);
      }
    }
    if (typeof opts.fastForwardTicks === 'number' && opts.fastForwardTicks > 0) {
      this.stepMany(opts.fastForwardTicks);
    }
  }

  enqueueCommand(cmd: GameCommand): void {
    this.commands.enqueue(cmd);
  }

  applyImmediate(cmd: GameCommand): void {
    this.executeCommand(cmd);
    this.seqNo += 1;
  }

  /** Advance exactly 1 deterministic 6-hour tick. */
  stepTick(): void {
    const due = this.commands.drainDue(this.tick);
    for (const cmd of due) {
      this.executeCommand(cmd);
    }

    this.tick += 1;
    this.seqNo += 1;

    // Batch 05/06: 6-hour tick land movement, frontline dispatch & 6h land combat resolution
    this.army.stepTick((tag) => this.getCombinedModifiers(tag).army_speed, {
      getController: this.combat.getController,
      onBeforeEnterProvince: (b, nextProvId) => {
        const ctrl = this.combat.getController(nextProvId);
        if (ctrl === b.owner) return 'allow';
        if (!this.combat.areAtWar(b.owner, ctrl)) return 'block';
        const res = this.combat.startOrJoinAttack(b, nextProvId, this.tick, this.army);
        if (res === 'started') return 'combat';
        if (res === 'occupy_empty') return 'allow';
        return 'block';
      },
      onEnteredProvince: (b, provId) => {
        const ctrl = this.combat.getController(provId);
        if (ctrl !== b.owner && this.combat.areAtWar(b.owner, ctrl)) {
          this.combat.setController(provId, b.owner);
          this.army.refreshFrontlines(this.combat.getController);
          this.combat.scanPockets(this.army);
        }
      },
    });

    const combatChanged = this.combat.stepTick(this.tick, this.rng, this.army, {
      getModifiers: (tag) => this.getCombinedModifiers(tag),
      addCasualties: (tag, men) => this.manpower.addCasualties(tag, men),
      refundEquipment: (tag, eq, units) => this.industry.refundEquipment(tag, eq, units),
      onDispatch: (kind, textZh, focusTag) => this.pushDispatch(kind, textZh, focusTag),
    });
    if (combatChanged) {
      this.syncNationsFromSystems();
      this.industryRevision += 1;
    }
    this.armyRevision += 1;

    // Daily boundary (00:00 each day)
    if (this.tick % TICKS_PER_DAY === 0) {
      this.onDailyBoundary();
    }
  }

  stepMany(ticks: number): void {
    const n = Math.max(0, Math.trunc(ticks));
    for (let i = 0; i < n; i++) {
      this.stepTick();
    }
  }

  private onDailyBoundary(): void {
    const prevYear = tickToDate(Math.max(0, this.tick - TICKS_PER_DAY)).year;
    const d = tickToDate(this.tick);
    // Advance deterministic RNG stream every day for reproducible future events
    const roll = this.rng.nextPermille();
    for (const nation of this.nations) {
      const cap = clampInt(FIXED_SCALE + this.getCombinedModifiers(nation.tag).cohesion_cap, 100, FIXED_SCALE);
      if (nation.cohesionPermille > cap) nation.cohesionPermille = cap;
      const dailyAp = this.calcDailyAp(nation.cohesionPermille);
      nation.apDailyPermille = dailyAp;
      nation.apPermille = clampInt(nation.apPermille + dailyAp, 0, 999 * FIXED_SCALE);
    }

    // Batch 04 daily manpower smooth inflow & tech research progress + Jan 1 New Year rate recalc
    this.manpower.stepDaily((tag) => ({
      baseRatePermille: this.governance.getBaseConscriptionPermille(tag),
      rateModifierPermille: this.getCombinedModifiers(tag).conscription_rate,
    }));

    const doneTechs = this.tech.stepDaily(prevYear, (tag) => this.getCombinedModifiers(tag).research_speed);
    if (doneTechs.length > 0) {
      this.industry.setNationModifiers(this.buildIndustryModsMap(), this.getCohesionMap());
      for (const ev of doneTechs) {
        if (ev.tag === this.playerTag) {
          this.pushDispatch('info', `科研竣工：《${ev.nameZh}》（${ev.effectSummaryZh}）`, ev.tag);
        }
      }
    }
    // Recalculate all active slot speeds immediately on new day / New Year's Day (元旦)
    this.tech.recomputeAllRates(d.year, (tag) => this.getCombinedModifiers(tag).research_speed);

    // Batch 03 daily industrial production, construction & auto-trade settlement
    const completed = this.industry.stepDaily(this.getCohesionMap());
    // Batch 05 daily brigade training progression & deployment
    const deployedEvents = this.army.stepDaily((tag) => this.getCombinedModifiers(tag).training_time);
    // Batch 06 daily encircled pocket scan
    this.combat.scanPockets(this.army);
    this.syncNationsFromSystems();
    this.industryRevision += 1;
    this.armyRevision += 1;
    for (const ev of completed) {
      if (ev.tag === this.playerTag) {
        const bName = BUILDING_SPECS[ev.building].nameZh;
        this.pushDispatch('info', `${ev.regionNameZh}竣工 1 座${bName}`, ev.tag);
      }
    }
    for (const dev of deployedEvents) {
      if (dev.owner === this.playerTag) {
        const tName = BRIGADE_TEMPLATES[dev.template].nameZh;
        const pct = Math.round(dev.strengthPermille / 10);
        this.pushDispatch('info', `新编${tName}结训部署至${dev.provinceNameZh}（满编 ${pct}%）`, dev.owner);
      }
    }

    if (d.year === 1936 && d.month === 3 && d.day === 7) {
      this.crisisPermille = clampInt(this.crisisPermille + 50, 0, FIXED_SCALE);
      this.pushDispatch('alert', '莱茵兰非军事区监测到部队调动', 'GER');
    } else if (d.day === 1 && (d.month !== 1 || d.year > 1936)) {
      const code = 100 + (roll % 900);
      this.pushDispatch('routine', `月度参谋例行简报归档（密电 #${code}）`, this.playerTag);
    }
  }

  private findNation(tag: string): SimNationSnapshot | undefined {
    return this.nations.find((n) => n.tag === tag);
  }

  getCombinedModifiers(tag: string): NationModifiers {
    const out = createEmptyModifiers();
    const law = this.governance.getLawModifiers(tag);
    const tech = this.tech.getTechModifiers(tag);
    for (const k of ALL_MODIFIER_KEYS) {
      out[k] = (law[k] + tech[k]) | 0;
    }
    return out;
  }

  private buildIndustryModsMap(): Map<string, IndustryLawTechMods> {
    const map = new Map<string, IndustryLawTechMods>();
    for (const n of this.nations) {
      const g = this.governance.getState(n.tag);
      const m = this.getCombinedModifiers(n.tag);
      map.set(n.tag, {
        economyLaw: g.economyLaw,
        exportSharePermille: this.governance.getExportSharePermille(n.tag),
        factoryOutputModPermille: m.factory_output,
        milOutputModPermille: m.mil_output,
        buildSpeedModPermille: m.build_speed,
        milBuildSpeedModPermille: m.mil_build_speed,
        synthBuildSpeedModPermille: m.synth_build_speed,
        masteryCapModPermille: m.mastery_cap,
        regionSlotBonus: m.region_slots,
        synthOilPerPlant: m.synth_oil_per_plant,
      });
    }
    return map;
  }

  private applyLawSwitch(
    actorTag: string,
    slot: SetGovernanceLawPayload['slot'],
    lawId: SetGovernanceLawPayload['lawId'],
  ): boolean {
    const nation = this.findNation(actorTag);
    if (!nation) return false;
    const res = this.governance.switchLaw(
      actorTag,
      slot,
      lawId,
      nation.apPermille,
      this.crisisPermille,
      nation.readinessPermille,
    );
    if (!res.ok) return false;

    nation.apPermille = Math.max(0, nation.apPermille - (res.apCostFixed ?? 0));
    const mods = this.getCombinedModifiers(actorTag);
    const cap = clampInt(FIXED_SCALE + mods.cohesion_cap, 100, FIXED_SCALE);
    if (nation.cohesionPermille > cap) {
      nation.cohesionPermille = cap;
      nation.apDailyPermille = this.calcDailyAp(nation.cohesionPermille);
    }

    this.manpower.syncRates(actorTag, this.governance.getBaseConscriptionPermille(actorTag), mods.conscription_rate);
    this.tech.recomputeNationRates(actorTag, tickToDate(this.tick).year, mods.research_speed);
    this.industry.setNationModifiers(this.buildIndustryModsMap(), this.getCohesionMap());
    this.syncNationsFromSystems();
    this.industryRevision += 1;

    if (actorTag === this.playerTag) {
      this.pushDispatch('info', `政务法令签批：${res.slotLabelZh}切换为「${res.lawNameZh}」（${res.summaryZh}）`, actorTag);
    }
    return true;
  }

  private getCohesionMap(): Map<string, number> {
    const map = new Map<string, number>();
    for (const n of this.nations) map.set(n.tag, n.cohesionPermille);
    return map;
  }

  private getTrainingAdapter() {
    return {
      getAvailableManpower: (tag: string) => this.manpower.getAvailableManpower(tag),
      consumeEquipment: (tag: string, eqType: Parameters<IndustrySystem['consumeEquipment']>[1], units: number) =>
        this.industry.consumeEquipment(tag, eqType, units),
      refundEquipment: (tag: string, eqType: Parameters<IndustrySystem['refundEquipment']>[1], units: number) =>
        this.industry.refundEquipment(tag, eqType, units),
    };
  }

  private syncNationsFromSystems(): void {
    for (const n of this.nations) {
      this.manpower.setDeployedAndTraining(
        n.tag,
        this.army.getDeployedManpower(n.tag),
        this.army.getInTrainingManpower(n.tag),
      );
      n.brigades = this.army.getBrigadeCount(n.tag);
      const s = this.industry.getNationSummary(n.tag);
      if (s) {
        n.civ = s.civ;
        n.mil = s.mil;
        n.doc = s.doc;
        n.steelNet = s.steelNet;
        n.oilNet = s.oilNet;
        n.rareNet = s.rareNet;
      }
      n.manpowerK = this.manpower.getAvailableManpowerK(n.tag);
    }
  }

  private calcDailyAp(cohesionPermille: number): number {
    // DESIGN_carbon §4.2: deltaAP = 2.0 * (0.8 + 0.4 * cohesion)
    const mult = 800 + mulFixed(400, cohesionPermille);
    return mulFixed(2000, mult);
  }

  private executeCommand(cmd: GameCommand): void {
    switch (cmd.type) {
      case 'INIT_SCENARIO':
        this.resetScenario(cmd.payload as InitScenarioPayload);
        break;
      case 'SELECT_COUNTRY': {
        const tag = (cmd.payload as SelectCountryPayload).countryTag;
        if (isPlayableTag(tag)) {
          this.playerTag = tag;
          this.industryRevision += 1;
          this.armyRevision += 1;
          this.pushDispatch('info', `统帅部执掌切换至 ${tag}，参谋卷宗已同步更新。`, tag);
        }
        break;
      }
      case 'SET_SPEED': {
        const spd = (cmd.payload as SetSpeedPayload).speed;
        this.speed = spd;
        if (spd === 0) this.paused = true;
        else this.paused = false;
        break;
      }
      case 'TOGGLE_PAUSE': {
        const p = (cmd.payload as TogglePausePayload).paused;
        this.paused = typeof p === 'boolean' ? p : !this.paused;
        if (!this.paused && this.speed === 0) this.speed = 1;
        break;
      }
      case 'SET_DATE': {
        const iso = (cmd.payload as SetDatePayload).isoDate;
        const target = dateStringToTick(iso);
        if (target !== null) {
          if (target >= this.tick) {
            this.stepMany(target - this.tick);
          } else {
            this.resetScenario({
              scenarioId: '1936',
              countryTag: this.playerTag,
              seed: this.seed,
              startDate: iso,
              paused: this.paused,
              speed: this.speed,
            });
          }
        }
        break;
      }
      case 'QUEUE_CONSTRUCTION': {
        const { regionId, building } = cmd.payload as QueueConstructionPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.industry.queueConstruction(actor, regionId, building, this.getCohesionMap())) {
          this.syncNationsFromSystems();
          this.industryRevision += 1;
        }
        break;
      }
      case 'CANCEL_CONSTRUCTION': {
        const { projectId } = cmd.payload as CancelConstructionPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.industry.cancelConstruction(actor, projectId, this.getCohesionMap())) {
          this.syncNationsFromSystems();
          this.industryRevision += 1;
        }
        break;
      }
      case 'REORDER_CONSTRUCTION': {
        const { projectId, direction } = cmd.payload as ReorderConstructionPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.industry.reorderConstruction(actor, projectId, direction, this.getCohesionMap())) {
          this.syncNationsFromSystems();
          this.industryRevision += 1;
        }
        break;
      }
      case 'SET_LINE_FACTORIES': {
        const { eqType, factories } = cmd.payload as SetLineFactoriesPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.industry.setLineFactories(actor, eqType, factories, this.getCohesionMap())) {
          this.syncNationsFromSystems();
          this.industryRevision += 1;
        }
        break;
      }
      case 'SWITCH_PRODUCTION_LINE': {
        const { fromType, toType, count } = cmd.payload as SwitchProductionLinePayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.industry.switchProductionLine(actor, fromType, toType, count, this.getCohesionMap())) {
          this.syncNationsFromSystems();
          this.industryRevision += 1;
        }
        break;
      }
      case 'TOGGLE_AUTO_TRADE': {
        const { enabled } = cmd.payload as ToggleAutoTradePayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        this.industry.toggleAutoTrade(actor, enabled, this.getCohesionMap());
        this.syncNationsFromSystems();
        this.industryRevision += 1;
        break;
      }
      case 'SET_GOVERNANCE_LAW': {
        const { slot, lawId } = cmd.payload as SetGovernanceLawPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        this.applyLawSwitch(actor, slot, lawId);
        break;
      }
      case 'START_RESEARCH': {
        const { techId, slotIndex } = cmd.payload as StartResearchPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        const bonus = this.getCombinedModifiers(actor).research_speed;
        if (this.tech.startResearch(actor, techId, tickToDate(this.tick).year, bonus, slotIndex)) {
          this.industryRevision += 1;
        }
        break;
      }
      case 'CANCEL_RESEARCH': {
        const { slotIndex } = cmd.payload as CancelResearchPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.tech.cancelResearch(actor, slotIndex)) {
          this.industryRevision += 1;
        }
        break;
      }
      case 'QUEUE_TRAINING': {
        const { template, deployProvId, armyId } = cmd.payload as QueueTrainingPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        const trainMod = this.getCombinedModifiers(actor).training_time;
        const defaultArmy = armyId !== undefined ? armyId : (this.army.getArmiesFor(actor)[0]?.id ?? null);
        if (this.army.queueTraining(actor, template, deployProvId, defaultArmy, trainMod, this.getTrainingAdapter())) {
          this.syncNationsFromSystems();
          this.industryRevision += 1;
          this.armyRevision += 1;
        }
        break;
      }
      case 'CANCEL_TRAINING': {
        const { orderId } = cmd.payload as CancelTrainingPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.army.cancelTraining(actor, orderId, this.getTrainingAdapter())) {
          this.syncNationsFromSystems();
          this.industryRevision += 1;
          this.armyRevision += 1;
        }
        break;
      }
      case 'CREATE_ARMY': {
        const { nameZh } = cmd.payload as CreateArmyPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        this.army.createArmy(actor, nameZh);
        this.armyRevision += 1;
        break;
      }
      case 'DISBAND_ARMY': {
        const { armyId } = cmd.payload as DisbandArmyPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.army.disbandArmy(actor, armyId)) this.armyRevision += 1;
        break;
      }
      case 'ASSIGN_BRIGADE_ARMY': {
        const { brigadeId, armyId } = cmd.payload as AssignBrigadeArmyPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.army.assignBrigadeToArmy(actor, brigadeId, armyId)) this.armyRevision += 1;
        break;
      }
      case 'MARCH_BRIGADES': {
        const { brigadeIds, targetProvId } = cmd.payload as MarchBrigadesPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        const spdMod = this.getCombinedModifiers(actor).army_speed;
        const hostile = this.combat.getHostileTagsFor(actor);
        if (this.army.marchBrigades(actor, brigadeIds, targetProvId, spdMod, hostile, this.combat.getController) > 0) {
          this.armyRevision += 1;
        }
        break;
      }
      case 'UNLOCK_MANUAL_OVERRIDE': {
        const { brigadeId } = cmd.payload as UnlockManualOverridePayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.army.unlockManualOverride(actor, brigadeId)) this.armyRevision += 1;
        break;
      }
      case 'BIND_FRONTLINE': {
        const { armyId, targetTag } = cmd.payload as BindFrontlinePayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        const spdMod = this.getCombinedModifiers(actor).army_speed;
        if (this.army.bindFrontline(actor, armyId, targetTag, spdMod, this.combat.getController)) {
          this.armyRevision += 1;
          if (actor === this.playerTag) {
            this.pushDispatch('info', `集团军已绑定对 ${targetTag} 连续战线，部队开始按省均摊部署。`, actor);
          }
        }
        break;
      }
      case 'CLEAR_FRONTLINE': {
        const { armyId } = cmd.payload as ClearFrontlinePayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.army.clearFrontline(actor, armyId)) this.armyRevision += 1;
        break;
      }
      case 'SET_OFFENSIVE_ARROW': {
        const { armyId, startProvId, targetProvId, bendOffsetX, bendOffsetY } = cmd.payload as SetOffensiveArrowPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.army.setOffensiveArrow(actor, armyId, startProvId ?? null, targetProvId, bendOffsetX, bendOffsetY, this.combat.getController)) {
          this.armyRevision += 1;
        }
        break;
      }
      case 'CLEAR_OFFENSIVE_ARROW': {
        const { armyId } = cmd.payload as ClearOffensiveArrowPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.army.clearOffensiveArrow(actor, armyId)) this.armyRevision += 1;
        break;
      }
      case 'TOGGLE_ARROW_ACTIVE': {
        const { armyId, active } = cmd.payload as ToggleArrowActivePayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.army.toggleOffensiveArrowActive(actor, armyId, active)) this.armyRevision += 1;
        break;
      }
      case 'ASSIGN_COMMANDER': {
        const { armyId, commanderId } = cmd.payload as AssignCommanderPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.army.assignCommander(actor, armyId, commanderId)) this.armyRevision += 1;
        break;
      }
    }
  }

  private pushDispatch(kind: TickerDispatch['kind'], textZh: string, focusTag?: string): void {
    this.dispatches.unshift({
      id: this.nextDispatchId++,
      tick: this.tick,
      dateIso: formatDateIso(this.tick),
      kind,
      textZh,
      focusTag,
    });
    if (this.dispatches.length > MAX_TICKER_HISTORY) {
      this.dispatches.length = MAX_TICKER_HISTORY;
    }
  }

  /** Deterministic 32-bit FNV-1a hash over full world & nation integer state. */
  computeStateHash(): number {
    let h = 0x811c9dc5;
    const mix = (v: number): void => {
      h ^= v & 0xff;
      h = Math.imul(h, 0x01000193);
      h ^= (v >>> 8) & 0xff;
      h = Math.imul(h, 0x01000193);
      h ^= (v >>> 16) & 0xff;
      h = Math.imul(h, 0x01000193);
      h ^= (v >>> 24) & 0xff;
      h = Math.imul(h, 0x01000193);
    };

    mix(this.tick);
    mix(this.crisisPermille);
    for (const w of this.rng.getState()) mix(w);
    for (let i = 0; i < this.playerTag.length; i++) mix(this.playerTag.charCodeAt(i));
    for (const n of this.nations) {
      mix(n.apPermille);
      mix(n.cohesionPermille);
      mix(n.readinessPermille);
      mix(n.manpowerK);
      mix(n.civ + (n.mil << 10) + (n.doc << 20));
      mix(n.steelNet ^ (n.oilNet << 8) ^ (n.rareNet << 16));
    }
    this.industry.mixHash(mix);
    this.governance.mixHash(mix);
    this.manpower.mixHash(mix);
    this.tech.mixHash(mix);
    this.army.mixHash(mix);
    this.combat.mixHash(mix);
    return h >>> 0;
  }

  computeStateHashHex(): string {
    const h1 = this.computeStateHash();
    const rng = this.rng.getState();
    const h2 = (Math.imul(h1 ^ rng[0], 0x27d4eb2d) ^ rng[3]) >>> 0;
    return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
  }

  getSnapshot(): WorldSnapshot {
    return {
      tick: this.tick,
      speed: this.speed,
      paused: this.paused,
      crisisPermille: this.crisisPermille,
      playerTag: this.playerTag,
      rngState: this.rng.getState(),
      stateHash: this.computeStateHash(),
      seqNo: this.seqNo,
      nations: this.nations,
    };
  }

  getDispatches(): TickerDispatch[] {
    return this.dispatches.slice();
  }

  getIndustryRevision(): number {
    return this.industryRevision;
  }

  getArmyRevision(): number {
    return this.armyRevision;
  }

  getArmySnapshot(tag = this.playerTag): ArmySystemSnapshot {
    return this.army.getSnapshotFor(
      tag,
      (t) => this.getCombinedModifiers(t).army_speed,
      this.getCombinedModifiers(tag).training_time,
    );
  }

  getCombatSnapshot(): CombatSystemSnapshot {
    return this.combat.getSnapshot();
  }

  /** Test & scenario hooks for deterministic Batch 06 combat verification. */
  getArmySystemForTest(): ArmySystem {
    return this.army;
  }

  getCombatSystemForTest(): LandCombatSystem {
    return this.combat;
  }

  declareMockWar(tagA: string, tagB: string): void {
    this.combat.declareWar(tagA, tagB);
    this.governance.setWarFlags(tagA, { atWar: true });
    this.governance.setWarFlags(tagB, { atWar: true });
    this.combat.scanPockets(this.army);
    this.armyRevision += 1;
    this.industryRevision += 1;
  }

  getIndustrySnapshot(tag = this.playerTag): IndustrySnapshot {
    return this.industry.getSnapshotFor(tag);
  }

  getGovernanceSnapshot(tag = this.playerTag): GovernanceSnapshot {
    const nation = this.findNation(tag) ?? this.nations[0]!;
    const g = this.governance.getState(nation.tag);
    const m = this.getCombinedModifiers(nation.tag);
    return {
      tag: nation.tag,
      economyLaw: g.economyLaw,
      conscriptionLaw: g.conscriptionLaw,
      tradeLaw: g.tradeLaw,
      apPermille: nation.apPermille,
      apDailyPermille: nation.apDailyPermille,
      crisisPermille: this.crisisPermille,
      readinessPermille: nation.readinessPermille,
      cohesionCapPermille: clampInt(FIXED_SCALE + m.cohesion_cap, 100, FIXED_SCALE),
      atWar: g.atWar,
      atWarWithMajor: g.atWarWithMajor,
      homelandInvaded: g.homelandInvaded,
      armyInferior: g.armyInferior,
      exportSharePermille: this.governance.getExportSharePermille(nation.tag),
      researchSpeedBonusPermille: m.research_speed,
      factoryOutputModPermille: m.factory_output,
      milOutputModPermille: m.mil_output,
      buildSpeedModPermille: m.build_speed,
      milBuildSpeedModPermille: m.mil_build_speed,
      masteryCapModPermille: m.mastery_cap,
      regionSlotBonus: m.region_slots,
      synthOilBonusPerPlant: m.synth_oil_per_plant,
      manpower: this.manpower.getSnapshotFor(nation.tag),
      economyOptions: this.governance.buildOptionsStatus(nation.tag, 'economy', nation.apPermille, this.crisisPermille, nation.readinessPermille),
      conscriptionOptions: this.governance.buildOptionsStatus(nation.tag, 'conscription', nation.apPermille, this.crisisPermille, nation.readinessPermille),
      tradeOptions: this.governance.buildOptionsStatus(nation.tag, 'trade', nation.apPermille, this.crisisPermille, nation.readinessPermille),
    };
  }

  getTechSnapshot(tag = this.playerTag): TechSnapshot {
    const bonus = this.getCombinedModifiers(tag).research_speed;
    return this.tech.getSnapshotFor(tag, tickToDate(this.tick).year, bonus);
  }
}
