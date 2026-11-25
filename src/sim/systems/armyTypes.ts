/**
 * Shared pure-TS types for Batch 05 Land Brigades, Training Queue, Armies,
 * Frontlines, Offensive Arrows, and Manual Override orders. Zero DOM/PIXI.
 */
import type { BrigadeType } from '../data/brigadeTemplates';
import type { EquipmentType } from './industryTypes';
import type { SupplyStatus } from './supplyTypes';

export interface BrigadeState {
  id: number;
  owner: string;
  template: BrigadeType;
  nameZh: string;
  provinceId: number;
  armyId: number | null;
  /** 0..1000 permille of template maxOrg */
  orgPermille: number;
  /** 0..1000 permille of full strength (manpower & equipment) */
  strengthPermille: number;
  /** Remaining province IDs along active land A* march path (next step is path[0]). */
  path: number[];
  /** Progress along current edge in tick-permille (0..edgeCostFixed). */
  moveProgressFixed: number;
  /** Total tick-permille required for current step provinceId -> path[0]. */
  moveEdgeCostFixed: number;
  /** Final intended destination province (null if stationary). */
  moveTargetProvId: number | null;
  /** True when player explicitly commanded this brigade; army AI must not override until arrival. */
  manualOverride: boolean;
  /** Stationary entrenchment bonus in permille (0..330). */
  entrenchPermille: number;
  /** Stationary frontline offensive planning bonus in permille (0..240). */
  planPermille: number;
  /** Active battle ID if currently engaged in province combat. */
  inCombatBattleId: number | null;
  /** True while executing forced retreat after defeat. */
  retreating: boolean;
  /** Consecutive 6-hour ticks spent in a province with S_p = 0 (starvation starts at >=8). */
  zeroSupplyTicks: number;
  /** Live supply state refreshed each tick ('ok' | 'low' | 'starving'). */
  supplyStatus: SupplyStatus;
  /** Last evaluated province supply level S_p (0..100). */
  supplyValue: number;
}

export interface TrainingOrderState {
  id: number;
  owner: string;
  template: BrigadeType;
  deployProvId: number;
  armyId: number | null;
  /** Progress accumulated in day-permille (1 day = 1000). */
  progressDaysFixed: number;
  /** Required total days in day-permille (baseTrainDays * (1000 + training_time_mod)). */
  targetDaysFixed: number;
  manpowerAllocated: number;
  equipmentTaken: Partial<Record<EquipmentType, number>>;
  /** Minimum coverage ratio across required equipment types (0..1000 permille). */
  equipmentRatioPermille: number;
  shortageType: EquipmentType | null;
}

export interface FrontlineBorderPair {
  friendlyProvId: number;
  enemyProvId: number;
}

export interface FrontlineOrder {
  targetTag: string;
  /** Ordered contiguous groups of friendly border province IDs along the frontier. */
  friendlyProvIds: number[];
  /** Adjacent friendly-enemy province pairs defining the topological border arcs. */
  borderPairs: FrontlineBorderPair[];
}

export interface OffensiveArrowOrder {
  id: number;
  armyId: number;
  targetTag: string;
  startProvId: number;
  targetProvId: number;
  /** Ordered province sequence from start to target (for map rendering & planning). */
  waypointProvIds: number[];
  /** Optional custom world-space midpoint for curved Bezier pincer shaping. */
  bendOffsetX?: number;
  bendOffsetY?: number;
  active: boolean;
}

export interface ArmyState {
  id: number;
  owner: string;
  nameZh: string;
  color: string;
  commanderId: string | null;
  brigadeIds: number[];
  frontline: FrontlineOrder | null;
  arrow: OffensiveArrowOrder | null;
  /** Whether motorized supply trucks (-3 supply impedance) are enabled for this army. */
  motorizedSupply: boolean;
}

export interface TrainingOrderSnap {
  id: number;
  template: BrigadeType;
  deployProvId: number;
  deployProvNameZh: string;
  armyId: number | null;
  progressPermille: number;
  remainingDays: number;
  totalDays: number;
  manpowerAllocated: number;
  equipmentRatioPermille: number;
  shortageType: EquipmentType | null;
}

export interface BrigadeSnap {
  id: number;
  owner: string;
  template: BrigadeType;
  nameZh: string;
  provinceId: number;
  armyId: number | null;
  orgPermille: number;
  strengthPermille: number;
  movingToProvId: number | null;
  moveTargetProvId: number | null;
  moveProgressPermille: number;
  etaTicks: number;
  manualOverride: boolean;
  entrenchPermille: number;
  planPermille: number;
  inCombatBattleId: number | null;
  retreating: boolean;
  zeroSupplyTicks: number;
  supplyStatus: SupplyStatus;
  supplyValue: number;
}

export interface ArmySnap {
  id: number;
  owner: string;
  nameZh: string;
  color: string;
  commanderId: string | null;
  brigadeIds: number[];
  frontline: FrontlineOrder | null;
  arrow: OffensiveArrowOrder | null;
  /** Whether motorized supply trucks (-3 supply impedance) are enabled for this army. */
  motorizedSupply: boolean;
}

export interface ArmySystemSnapshot {
  playerTag: string;
  trainingTimeModPermille: number;
  /** All deployed brigades across Europe (rendered on map). */
  brigades: BrigadeSnap[];
  /** All armies (rendered for LOD 0 badges & frontlines/arrows). */
  armies: ArmySnap[];
  /** Player's active training queue. */
  trainingQueue: TrainingOrderSnap[];
  /** Player's land-border neighbor tags for quick frontline binding. */
  neighborTags: string[];
  /** Player's deployed manpower & in-training manpower. */
  deployedManpower: number;
  inTrainingManpower: number;
}
