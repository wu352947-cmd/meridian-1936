/**
 * Pure deterministic simulation kernel (Batch 02: clock, RNG, country select, date stepping, nation snapshots).
 * Zero DOM/window/PIXI references — runs identically in Web Worker and Node Vitest.
 */
import { dateStringToTick, formatDateIso, TICKS_PER_DAY, tickToDate, type SimSpeed } from './ClockCalendar';
import { clampInt, FIXED_SCALE, mulFixed } from './FixedMath';
import {
  CommandQueue,
  type CancelConstructionPayload,
  type GameCommand,
  type InitScenarioPayload,
  type QueueConstructionPayload,
  type ReorderConstructionPayload,
  type SelectCountryPayload,
  type SetDatePayload,
  type SetLineFactoriesPayload,
  type SetSpeedPayload,
  type SwitchProductionLinePayload,
  type ToggleAutoTradePayload,
  type TogglePausePayload,
} from './GameCommand';
import { SeededRng } from './SeededRng';
import type { SimNationSnapshot, WorldSnapshot } from './SnapshotCodec';
import { ALL_PLAYABLE_NATIONS_1936, isPlayableTag } from '../data/nations1936';
import { IndustrySystem } from '../systems/industrySystem';
import { BUILDING_SPECS, type IndustrySnapshot } from '../systems/industryTypes';

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
  private dispatches: TickerDispatch[] = [];
  private nextDispatchId = 1;
  private industryRevision = 1;

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
    this.crisisPermille = 50;
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

    this.industry.reset(this.getCohesionMap());
    if (typeof opts.autoTrade === 'boolean') {
      this.industry.toggleAutoTrade(this.playerTag, opts.autoTrade, this.getCohesionMap());
    }
    if (opts.initialQueue && opts.initialQueue.length > 0) {
      const coh = this.getCohesionMap();
      for (const item of opts.initialQueue) {
        this.industry.queueConstruction(this.playerTag, item.regionId, item.building, coh);
      }
    }
    this.syncNationsFromIndustry();
    this.industryRevision += 1;

    this.pushDispatch('info', '1936 欧洲参谋部总图就绪，等待签批指令。', this.playerTag);

    if (opts.startDate) {
      const targetTick = dateStringToTick(opts.startDate);
      if (targetTick !== null && targetTick > 0) {
        this.stepMany(targetTick);
      }
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
    // Advance deterministic RNG stream every day for reproducible future events
    const roll = this.rng.nextPermille();
    for (const nation of this.nations) {
      const dailyAp = this.calcDailyAp(nation.cohesionPermille);
      nation.apDailyPermille = dailyAp;
      nation.apPermille = clampInt(nation.apPermille + dailyAp, 0, 999 * FIXED_SCALE);
    }

    // Batch 03 daily industrial production, construction & auto-trade settlement
    const completed = this.industry.stepDaily(this.getCohesionMap());
    this.syncNationsFromIndustry();
    this.industryRevision += 1;
    for (const ev of completed) {
      if (ev.tag === this.playerTag) {
        const bName = BUILDING_SPECS[ev.building].nameZh;
        this.pushDispatch('info', `${ev.regionNameZh}竣工 1 座${bName}`, ev.tag);
      }
    }

    const d = tickToDate(this.tick);
    if (d.year === 1936 && d.month === 3 && d.day === 7) {
      this.crisisPermille = clampInt(this.crisisPermille + 50, 0, FIXED_SCALE);
      this.pushDispatch('alert', '莱茵兰非军事区监测到部队调动', 'GER');
    } else if (d.day === 1 && (d.month !== 1 || d.year > 1936)) {
      const code = 100 + (roll % 900);
      this.pushDispatch('routine', `月度参谋例行简报归档（密电 #${code}）`, this.playerTag);
    }
  }

  private getCohesionMap(): Map<string, number> {
    const map = new Map<string, number>();
    for (const n of this.nations) map.set(n.tag, n.cohesionPermille);
    return map;
  }

  private syncNationsFromIndustry(): void {
    for (const n of this.nations) {
      const s = this.industry.getNationSummary(n.tag);
      if (!s) continue;
      n.civ = s.civ;
      n.mil = s.mil;
      n.doc = s.doc;
      n.steelNet = s.steelNet;
      n.oilNet = s.oilNet;
      n.rareNet = s.rareNet;
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
          this.syncNationsFromIndustry();
          this.industryRevision += 1;
        }
        break;
      }
      case 'CANCEL_CONSTRUCTION': {
        const { projectId } = cmd.payload as CancelConstructionPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.industry.cancelConstruction(actor, projectId, this.getCohesionMap())) {
          this.syncNationsFromIndustry();
          this.industryRevision += 1;
        }
        break;
      }
      case 'REORDER_CONSTRUCTION': {
        const { projectId, direction } = cmd.payload as ReorderConstructionPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.industry.reorderConstruction(actor, projectId, direction, this.getCohesionMap())) {
          this.syncNationsFromIndustry();
          this.industryRevision += 1;
        }
        break;
      }
      case 'SET_LINE_FACTORIES': {
        const { eqType, factories } = cmd.payload as SetLineFactoriesPayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.industry.setLineFactories(actor, eqType, factories, this.getCohesionMap())) {
          this.syncNationsFromIndustry();
          this.industryRevision += 1;
        }
        break;
      }
      case 'SWITCH_PRODUCTION_LINE': {
        const { fromType, toType, count } = cmd.payload as SwitchProductionLinePayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        if (this.industry.switchProductionLine(actor, fromType, toType, count, this.getCohesionMap())) {
          this.syncNationsFromIndustry();
          this.industryRevision += 1;
        }
        break;
      }
      case 'TOGGLE_AUTO_TRADE': {
        const { enabled } = cmd.payload as ToggleAutoTradePayload;
        const actor = isPlayableTag(cmd.actorTag) ? cmd.actorTag : this.playerTag;
        this.industry.toggleAutoTrade(actor, enabled, this.getCohesionMap());
        this.syncNationsFromIndustry();
        this.industryRevision += 1;
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

  getIndustrySnapshot(tag = this.playerTag): IndustrySnapshot {
    return this.industry.getSnapshotFor(tag);
  }
}
