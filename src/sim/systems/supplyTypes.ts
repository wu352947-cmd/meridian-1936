/**
 * Pure TypeScript types & constants for Batch 07 Multi-Source Dijkstra Supply Network
 * and Low-Supply / Starvation Penalties (Carbon §4.10). Zero DOM/PIXI references.
 */
import type { LandTerrainType } from '../data/brigadeTemplates';
import type { SupplySourceKind } from '../data/supplySources1936';

export type SupplyStatus = 'ok' | 'low' | 'starving';

/** Base per-province supply impedance by terrain (Carbon §4.10). */
export const SUPPLY_TERRAIN_COST: Readonly<Record<LandTerrainType, number>> = {
  plains: 6,
  urban: 6,
  forest: 10,
  hills: 10,
  desert: 15,
  marsh: 15,
  mountain: 18,
};

/** Region infrastructure 1..5 supply impedance divisors (permille: 0.80 / 1.00 / 1.25 / 1.50 / 1.80). */
export const SUPPLY_INFRA_MULT_PERMILLE: readonly number[] = [
  800, 800, 1000, 1250, 1500, 1800,
];

/** Supply impedance modifiers (in whole supply points; internally x1000 milli-supply). */
export const SUPPLY_DEFINES = {
  maxSupply: 100,
  milliScale: 1000,
  minHopCostMilli: 1000,
  /** Newly captured province gauge-damage penalty (+8) lasting 14 days (56 ticks). */
  recentOccupationPenalty: 8,
  recentOccupationDays: 14,
  recentOccupationTicks: 56,
  /** Motorized army supply truck reduction (-3 per hop). */
  truckBonus: 3,
  /** High resistance (>=30%) penalty (+4) reserved for Batch 10 occupation hook. */
  highResistancePenalty: 4,
  /** Province supply below 30 triggers low supply regardless of stack count. */
  lowSupplyThreshold: 30,
  /** 15 supply points support 1 brigade (Cap_p = max(1, floor(S_p / 15))). */
  supplyPerBrigade: 15,
  /** Starvation triggers after 48 hours (8 six-hour ticks) at S_p = 0. */
  starvationDelayTicks: 8,
  /** Starvation combat multiplier (-60% => x0.40). */
  starvationCombatMultPermille: 400,
  /** Starvation march speed multiplier (-50% => x0.50). */
  starvationSpeedMultPermille: 500,
  /** Starvation per-tick Org loss (4 Org points) and equipment attrition (1.5% = 15 permille). */
  starvationOrgLossPoints: 4,
  starvationEquipLossPermille: 15,
  /** Low-supply combat penalty range: -10% to -50% (100..500 permille). */
  lowSupplyMinPenaltyPermille: 100,
  lowSupplyMaxPenaltyPermille: 500,
  /** Low-supply max march speed penalty: -50% (500 permille). */
  lowSupplyMaxSpeedPenaltyPermille: 500,
} as const;

export interface ActiveSupplyHubSnap {
  provId: number;
  controller: string;
  kind: SupplySourceKind;
  portLevel: number;
  effectiveSupply: number;
  nameZh: string;
  cx: number;
  cy: number;
}

export interface ArmyLogisticsSnap {
  armyId: number;
  nameZh: string;
  color: string;
  brigadeCount: number;
  avgSupply: number;
  lowSupplyCount: number;
  starvingCount: number;
  motorizedSupply: boolean;
  motorizedFunded: boolean;
  dailyTruckCost: number;
}

export interface BrigadeSupplyEffect {
  supplyValue: number;
  supplyCap: number;
  brigadesInProv: number;
  status: SupplyStatus;
  zeroSupplyTicks: number;
  combatMultPermille: number;
  speedMultPermille: number;
  canRecoverOrg: boolean;
  noteZh: string;
}

export interface LogisticsSnapshot {
  playerTag: string;
  truckStockpile: number;
  truckDailyDemand: number;
  truckDailyProdFixed: number;
  avgNationSupply: number;
  lowSupplyBrigades: number;
  starvingBrigades: number;
  armies: ArmyLogisticsSnap[];
  hubs: ActiveSupplyHubSnap[];
  allHubs: ActiveSupplyHubSnap[];
}

/** Capacity formula Cap_p = max(1, floor(S_p / 15)) per Carbon §4.10. */
export function calcSupplyCap(supplyVal: number): number {
  return Math.max(1, Math.floor(Math.max(0, supplyVal) / SUPPLY_DEFINES.supplyPerBrigade));
}
