/**
 * Main-thread SimulationWorker bridge using double-buffered Transferable ArrayBuffers.
 * Decodes incoming 32 KB snapshots into Preact Signals and immediately returns the buffer.
 */
import type { SimSpeed } from '../../sim/core/ClockCalendar';
import type { GameCommand, InitScenarioPayload } from '../../sim/core/GameCommand';
import { decodeSnapshot, type WorldSnapshot } from '../../sim/core/SnapshotCodec';
import type { TickerDispatch } from '../../sim/core/SimEngine';
import type { BrigadeType } from '../../sim/data/brigadeTemplates';
import { PLAYABLE_TAG_LIST } from '../../sim/data/nations1936';
import type { ArmySystemSnapshot } from '../../sim/systems/armyTypes';
import type { CombatSystemSnapshot } from '../../sim/systems/combatTypes';
import type { GovernanceLawId, GovernanceSlot, GovernanceSnapshot } from '../../sim/systems/governanceTypes';
import type { BuildingType, EquipmentType, IndustrySnapshot } from '../../sim/systems/industryTypes';
import type { LogisticsSnapshot } from '../../sim/systems/supplyTypes';
import type { TechSnapshot } from '../../sim/systems/techTypes';
import type { MainToWorkerMessage, WorkerToMainMessage } from '../../sim/workerProtocol';

export interface SimClientHandlers {
  onSnapshot: (
    snap: WorldSnapshot,
    dispatches?: TickerDispatch[],
    industry?: IndustrySnapshot,
    governance?: GovernanceSnapshot,
    tech?: TechSnapshot,
    army?: ArmySystemSnapshot,
    combat?: CombatSystemSnapshot,
    logistics?: LogisticsSnapshot,
  ) => void;
}

export class SimClient {
  private readonly worker: Worker;
  private tagOrder: string[] = [...PLAYABLE_TAG_LIST];
  private currentTick = 0;
  private currentTag = 'GER';
  private readyResolve: (() => void) | null = null;
  private snapshotWaiters: Array<() => void> = [];
  readonly ready: Promise<void>;

  constructor(handlers: SimClientHandlers) {
    this.ready = new Promise<void>((resolve) => {
      this.readyResolve = resolve;
    });

    this.worker = new Worker(new URL('../../sim/worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (ev: MessageEvent<WorkerToMainMessage>) => {
      const msg = ev.data;
      if (msg.type === 'READY') {
        this.tagOrder = msg.tagOrder;
        this.readyResolve?.();
        this.readyResolve = null;
        return;
      }
      if (msg.type === 'SNAPSHOT') {
        const snap = decodeSnapshot(msg.buffer, this.tagOrder);
        this.currentTick = snap.tick;
        this.currentTag = snap.playerTag;
        // Return ArrayBuffer ownership back to Worker immediately (ping-pong zero-GC)
        const ret: MainToWorkerMessage = { type: 'RETURN_BUFFER', buffer: msg.buffer };
        this.worker.postMessage(ret, [msg.buffer]);

        handlers.onSnapshot(
          snap,
          msg.dispatches,
          msg.industry,
          msg.governance,
          msg.tech,
          msg.army,
          msg.combat,
          msg.logistics,
        );

        if (this.snapshotWaiters.length > 0) {
          const waiters = this.snapshotWaiters.splice(0);
          for (const w of waiters) w();
        }
      }
    };

    this.worker.onerror = (err) => {
      console.error('[SimClient] worker error:', err);
    };
  }

  async initScenario(payload: InitScenarioPayload): Promise<void> {
    await this.ready;
    const waitNext = new Promise<void>((resolve) => {
      this.snapshotWaiters.push(resolve);
    });
    const msg: MainToWorkerMessage = { type: 'INIT', payload };
    this.worker.postMessage(msg);
    await waitNext;
  }

  sendCommand(type: GameCommand['type'], payload: GameCommand['payload']): void {
    const command: GameCommand = {
      tick: this.currentTick,
      actorTag: this.currentTag,
      type,
      payload,
    };
    const msg: MainToWorkerMessage = { type: 'COMMAND', command };
    this.worker.postMessage(msg);
  }

  selectCountry(countryTag: string): void {
    this.sendCommand('SELECT_COUNTRY', { countryTag });
  }

  setSpeed(speed: SimSpeed): void {
    this.sendCommand('SET_SPEED', { speed });
  }

  togglePause(paused?: boolean): void {
    this.sendCommand('TOGGLE_PAUSE', { paused });
  }

  setDate(isoDate: string): void {
    this.sendCommand('SET_DATE', { isoDate });
  }

  queueConstruction(regionId: number, building: BuildingType): void {
    this.sendCommand('QUEUE_CONSTRUCTION', { regionId, building });
  }

  cancelConstruction(projectId: number): void {
    this.sendCommand('CANCEL_CONSTRUCTION', { projectId });
  }

  reorderConstruction(projectId: number, direction: 'up' | 'down' | 'top'): void {
    this.sendCommand('REORDER_CONSTRUCTION', { projectId, direction });
  }

  setLineFactories(eqType: EquipmentType, factories: number): void {
    this.sendCommand('SET_LINE_FACTORIES', { eqType, factories });
  }

  switchProductionLine(fromType: EquipmentType, toType: EquipmentType, count?: number): void {
    this.sendCommand('SWITCH_PRODUCTION_LINE', { fromType, toType, count });
  }

  toggleAutoTrade(enabled?: boolean): void {
    this.sendCommand('TOGGLE_AUTO_TRADE', { enabled });
  }

  setGovernanceLaw(slot: GovernanceSlot, lawId: GovernanceLawId): void {
    this.sendCommand('SET_GOVERNANCE_LAW', { slot, lawId });
  }

  startResearch(techId: string, slotIndex?: number): void {
    this.sendCommand('START_RESEARCH', { techId, slotIndex });
  }

  cancelResearch(slotIndex: number): void {
    this.sendCommand('CANCEL_RESEARCH', { slotIndex });
  }

  queueTraining(template: BrigadeType, deployProvId?: number, armyId?: number | null): void {
    this.sendCommand('QUEUE_TRAINING', { template, deployProvId, armyId });
  }

  cancelTraining(orderId: number): void {
    this.sendCommand('CANCEL_TRAINING', { orderId });
  }

  createArmy(nameZh?: string): void {
    this.sendCommand('CREATE_ARMY', { nameZh });
  }

  disbandArmy(armyId: number): void {
    this.sendCommand('DISBAND_ARMY', { armyId });
  }

  assignBrigadeArmy(brigadeId: number, armyId: number | null): void {
    this.sendCommand('ASSIGN_BRIGADE_ARMY', { brigadeId, armyId });
  }

  marchBrigades(brigadeIds: number[], targetProvId: number): void {
    this.sendCommand('MARCH_BRIGADES', { brigadeIds, targetProvId });
  }

  unlockManualOverride(brigadeId: number): void {
    this.sendCommand('UNLOCK_MANUAL_OVERRIDE', { brigadeId });
  }

  bindFrontline(armyId: number, targetTag: string): void {
    this.sendCommand('BIND_FRONTLINE', { armyId, targetTag });
  }

  clearFrontline(armyId: number): void {
    this.sendCommand('CLEAR_FRONTLINE', { armyId });
  }

  setOffensiveArrow(
    armyId: number,
    startProvId: number | null,
    targetProvId: number,
    bendOffsetX?: number,
    bendOffsetY?: number,
  ): void {
    this.sendCommand('SET_OFFENSIVE_ARROW', { armyId, startProvId, targetProvId, bendOffsetX, bendOffsetY });
  }

  clearOffensiveArrow(armyId: number): void {
    this.sendCommand('CLEAR_OFFENSIVE_ARROW', { armyId });
  }

  toggleArrowActive(armyId: number, active?: boolean): void {
    this.sendCommand('TOGGLE_ARROW_ACTIVE', { armyId, active });
  }

  assignCommander(armyId: number, commanderId: string | null): void {
    this.sendCommand('ASSIGN_COMMANDER', { armyId, commanderId });
  }

  toggleArmyMotorizedSupply(armyId: number, enabled?: boolean): void {
    this.sendCommand('TOGGLE_ARMY_MOTORIZED_SUPPLY', { armyId, enabled });
  }

  stepOnce(): void {
    const msg: MainToWorkerMessage = { type: 'STEP_ONCE' };
    this.worker.postMessage(msg);
  }

  dispose(): void {
    this.worker.terminate();
  }
}
