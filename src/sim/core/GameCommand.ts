/**
 * Deterministic unidirectional command queue (UI -> SimulationWorker).
 * Pure JSON-serializable payloads for replayability and desync-free simulation.
 */
import type { SimSpeed } from './ClockCalendar';
import type { BrigadeType } from '../data/brigadeTemplates';
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
  | 'CANCEL_RESEARCH'
  | 'QUEUE_TRAINING'
  | 'CANCEL_TRAINING'
  | 'CREATE_ARMY'
  | 'DISBAND_ARMY'
  | 'ASSIGN_BRIGADE_ARMY'
  | 'MARCH_BRIGADES'
  | 'UNLOCK_MANUAL_OVERRIDE'
  | 'BIND_FRONTLINE'
  | 'CLEAR_FRONTLINE'
  | 'SET_OFFENSIVE_ARROW'
  | 'CLEAR_OFFENSIVE_ARROW'
  | 'TOGGLE_ARROW_ACTIVE'
  | 'ASSIGN_COMMANDER'
  | 'TOGGLE_ARMY_MOTORIZED_SUPPLY';

export interface InitScenarioPayload {
  scenarioId: '1936';
  countryTag: string;
  seed: number;
  startDate?: string;
  fastForwardTicks?: number;
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
  demoFrontline?: string;
  mockWar?: string;
  initialTraining?: Array<{ template: BrigadeType; deployProvId?: number }>;
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

export interface QueueTrainingPayload {
  template: BrigadeType;
  deployProvId?: number;
  armyId?: number | null;
}

export interface CancelTrainingPayload {
  orderId: number;
}

export interface CreateArmyPayload {
  nameZh?: string;
}

export interface DisbandArmyPayload {
  armyId: number;
}

export interface AssignBrigadeArmyPayload {
  brigadeId: number;
  armyId: number | null;
}

export interface MarchBrigadesPayload {
  brigadeIds: number[];
  targetProvId: number;
}

export interface UnlockManualOverridePayload {
  brigadeId: number;
}

export interface BindFrontlinePayload {
  armyId: number;
  targetTag: string;
}

export interface ClearFrontlinePayload {
  armyId: number;
}

export interface SetOffensiveArrowPayload {
  armyId: number;
  startProvId?: number | null;
  targetProvId: number;
  bendOffsetX?: number;
  bendOffsetY?: number;
}

export interface ClearOffensiveArrowPayload {
  armyId: number;
}

export interface ToggleArrowActivePayload {
  armyId: number;
  active?: boolean;
}

export interface AssignCommanderPayload {
  armyId: number;
  commanderId: string | null;
}

export interface ToggleArmyMotorizedSupplyPayload {
  armyId: number;
  enabled?: boolean;
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
  | CancelResearchPayload
  | QueueTrainingPayload
  | CancelTrainingPayload
  | CreateArmyPayload
  | DisbandArmyPayload
  | AssignBrigadeArmyPayload
  | MarchBrigadesPayload
  | UnlockManualOverridePayload
  | BindFrontlinePayload
  | ClearFrontlinePayload
  | SetOffensiveArrowPayload
  | ClearOffensiveArrowPayload
  | ToggleArrowActivePayload
  | AssignCommanderPayload
  | ToggleArmyMotorizedSupplyPayload;

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
