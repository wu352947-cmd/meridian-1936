/**
 * Deterministic unidirectional command queue (UI -> SimulationWorker).
 * Pure JSON-serializable payloads for replayability and desync-free simulation.
 */
import type { SimSpeed } from './ClockCalendar';
import type { GovernanceLawId, GovernanceSlot } from '../systems/governanceTypes';
import type { BuildingType, EquipmentType } from '../systems/industryTypes';

export type CommandType =
  | 'INIT_SCENARIO'
  | 'SELECT_COUNTRY'
  | 'SET_SPEED'
  | 'TOGGLE_PAUSE'
  | 'SET_DATE'
  | 'QUEUE_CONSTRUCTION'
  | 'CANCEL_CONSTRUCTION'
  | 'REORDER_CONSTRUCTION'
  | 'SET_LINE_FACTORIES'
  | 'SWITCH_PRODUCTION_LINE'
  | 'TOGGLE_AUTO_TRADE'
  | 'SET_GOVERNANCE_LAW'
  | 'START_RESEARCH'
  | 'CANCEL_RESEARCH';

export interface InitScenarioPayload {
  scenarioId: '1936';
  countryTag: string;
  seed: number;
  startDate?: string;
  paused?: boolean;
  speed?: SimSpeed;
  autoTrade?: boolean;
  initialQueue?: Array<{ regionId: number; building: BuildingType }>;
  crisisPermille?: number;
  playerAp?: number;
  playerMobilizationPermille?: number;
  playerAtWar?: boolean;
  playerAtWarWithMajor?: boolean;
  playerHomelandInvaded?: boolean;
  playerArmyInferior?: boolean;
  initialLaws?: Array<{ slot: GovernanceSlot; lawId: GovernanceLawId }>;
  initialResearch?: string[];
}

export interface SelectCountryPayload {
  countryTag: string;
}

export interface SetSpeedPayload {
  speed: SimSpeed;
}

export interface TogglePausePayload {
  paused?: boolean;
}

export interface SetDatePayload {
  isoDate: string;
}

export interface QueueConstructionPayload {
  regionId: number;
  building: BuildingType;
}

export interface CancelConstructionPayload {
  projectId: number;
}

export interface ReorderConstructionPayload {
  projectId: number;
  direction: 'up' | 'down' | 'top';
}

export interface SetLineFactoriesPayload {
  eqType: EquipmentType;
  factories: number;
}

export interface SwitchProductionLinePayload {
  fromType: EquipmentType;
  toType: EquipmentType;
  count?: number;
}

export interface ToggleAutoTradePayload {
  enabled?: boolean;
}

export interface SetGovernanceLawPayload {
  slot: GovernanceSlot;
  lawId: GovernanceLawId;
}

export interface StartResearchPayload {
  techId: string;
  slotIndex?: number;
}

export interface CancelResearchPayload {
  slotIndex: number;
}

export type GameCommandPayload =
  | InitScenarioPayload
  | SelectCountryPayload
  | SetSpeedPayload
  | TogglePausePayload
  | SetDatePayload
  | QueueConstructionPayload
  | CancelConstructionPayload
  | ReorderConstructionPayload
  | SetLineFactoriesPayload
  | SwitchProductionLinePayload
  | ToggleAutoTradePayload
  | SetGovernanceLawPayload
  | StartResearchPayload
  | CancelResearchPayload;

export interface GameCommand<T extends CommandType = CommandType> {
  tick: number;
  actorTag: string;
  type: T;
  payload: GameCommandPayload;
}

export class CommandQueue {
  private readonly pending: GameCommand[] = [];
  private readonly history: GameCommand[] = [];

  enqueue(cmd: GameCommand): void {
    this.pending.push(cmd);
  }

  /** Drain commands scheduled at or before currentTick in FIFO order. */
  drainDue(currentTick: number): GameCommand[] {
    if (this.pending.length === 0) return [];
    const due: GameCommand[] = [];
    let writeIdx = 0;
    for (let i = 0; i < this.pending.length; i++) {
      const cmd = this.pending[i]!;
      if (cmd.tick <= currentTick) {
        due.push(cmd);
        this.history.push(cmd);
      } else {
        this.pending[writeIdx++] = cmd;
      }
    }
    this.pending.length = writeIdx;
    return due;
  }

  getHistory(): readonly GameCommand[] {
    return this.history;
  }

  clear(): void {
    this.pending.length = 0;
    this.history.length = 0;
  }
}
