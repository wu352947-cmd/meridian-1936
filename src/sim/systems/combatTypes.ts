/**
 * Shared pure-TS types for Batch 06 6-hour Land Combat, Battles, Breakdowns,
 * Occupation, Encircled Pockets, and Wipeout Reports. Zero DOM/PIXI.
 */
import type { BrigadeSlotRole, BrigadeType, LandTerrainType } from '../data/brigadeTemplates';
import type { RiverCrossingKind } from '../data/combatDefines';
import type { EquipmentType } from './industryTypes';

export interface CombatMultiplierFactor {
  key: string;
  labelZh: string;
  /** Permille multiplier (1000 = x1.00, 1100 = x1.10, 700 = x0.70). */
  multPermille: number;
  enabled: boolean;
  noteZh?: string;
}

export interface CombatUnitBreakdown {
  brigadeId: number;
  nameZh: string;
  template: BrigadeType;
  role: BrigadeSlotRole;
  isAttacking: boolean;
  baseAtkFixed: number;
  effAtkFixed: number;
  baseGuardFixed: number;
  effGuardFixed: number;
  armor: number;
  enemyMaxPiercing: number;
  armorAdvantage: boolean;
  exposedArtPenalty: boolean;
  factors: CombatMultiplierFactor[];
}

export interface BattleSlotUnitSnap {
  brigadeId: number;
  owner: string;
  nameZh: string;
  template: BrigadeType;
  role: BrigadeSlotRole;
  orgPermille: number;
  strengthPermille: number;
  entrenchPermille: number;
  planPermille: number;
  fromProvId: number;
  breakdown: CombatUnitBreakdown;
}

export interface ProvinceBattleSnap {
  id: number;
  provinceId: number;
  provinceNameZh: string;
  terrain: LandTerrainType;
  river: RiverCrossingKind;
  fortLevel: number;
  attackerTag: string;
  defenderTag: string;
  startTick: number;
  durationTicks: number;
  attackDirections: number;
  maxFrontline: number;
  maxSupport: number;
  /** -100 (defender dominant) .. +100 (attacker dominant). */
  advantageScore: number;
  attackerFront: BattleSlotUnitSnap[];
  attackerSupport: BattleSlotUnitSnap[];
  attackerReserves: BattleSlotUnitSnap[];
  defenderFront: BattleSlotUnitSnap[];
  defenderSupport: BattleSlotUnitSnap[];
  defenderReserves: BattleSlotUnitSnap[];
  defenderEntrenchAvgPermille: number;
  attackerPlanAvgPermille: number;
  isNight?: boolean;
  seasonNoteZh?: string;
}

export interface EncircledPocketSnap {
  id: number;
  owner: string;
  provinceIds: number[];
  brigadeIds: number[];
  cx: number;
  cy: number;
}

export interface WipeoutEvent {
  id: number;
  tick: number;
  provinceId: number;
  provinceNameZh: string;
  victimTag: string;
  victorTag: string;
  brigadeCount: number;
  manpowerLost: number;
  equipmentCaptured: Partial<Record<EquipmentType, number>>;
}

export interface OccupiedProvinceSnap {
  provId: number;
  coreOwner: string;
  controller: string;
}

export interface CombatSystemSnapshot {
  wars: Array<[string, string]>;
  occupiedProvinces: OccupiedProvinceSnap[];
  battles: ProvinceBattleSnap[];
  pockets: EncircledPocketSnap[];
  recentWipeouts: WipeoutEvent[];
}
