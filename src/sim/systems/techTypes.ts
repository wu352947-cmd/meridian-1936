/**
 * Cyanotype Engineering Tech Tree pure formulas & snapshot contracts (Carbon §4.8).
 * Formula: D_actual = D_0 * (1 + max(0, Y_tech - Y_now) * 1.0) / (1 + B_research_speed)
 * Pure TypeScript — zero DOM/PIXI dependencies.
 */
import { FIXED_SCALE } from '../core/FixedMath';

export const TECH_PROG_SCALE = 1_000_000; // 100.000% fixed-point progress scale

/** Ahead-of-time penalty in permille: +1000 (+100%) per year before historical year. */
export function calcTechAheadPenaltyPermille(techYear: number, currentYear: number): number {
  const aheadYears = Math.max(0, (techYear - currentYear) | 0);
  return aheadYears * FIXED_SCALE;
}

/**
 * Effective total research duration in fixed-point days (x1000):
 *   D_actual = D_0 * (1 + max(0, Y_tech - Y_now)) / (1 + B_research_speed)
 */
export function calcTechActualDaysFixed(
  baseDays: number,
  techYear: number,
  currentYear: number,
  researchSpeedBonusPermille: number,
): number {
  const aheadYears = Math.max(0, (techYear - currentYear) | 0);
  const multPermille = FIXED_SCALE + aheadYears * FIXED_SCALE;
  const speedDenom = Math.max(200, (FIXED_SCALE + researchSpeedBonusPermille) | 0);
  const num = BigInt(Math.max(1, baseDays)) * BigInt(multPermille) * BigInt(FIXED_SCALE);
  return Number((num + BigInt(speedDenom >> 1)) / BigInt(speedDenom));
}

/** Daily progress increment in micro-units (out of TECH_PROG_SCALE = 1,000,000). */
export function calcTechDailyProgressMicro(
  baseDays: number,
  techYear: number,
  currentYear: number,
  researchSpeedBonusPermille: number,
): number {
  const aheadYears = Math.max(0, (techYear - currentYear) | 0);
  const penaltyMult = 1 + aheadYears;
  const speedNum = Math.max(200, (FIXED_SCALE + researchSpeedBonusPermille) | 0);
  const denom = BigInt(Math.max(1, baseDays)) * BigInt(penaltyMult) * BigInt(FIXED_SCALE);
  const num = BigInt(TECH_PROG_SCALE) * BigInt(speedNum);
  return Math.max(1, Number((num + (denom >> 1n)) / denom));
}

export function calcTechEtaDays(progressMicro: number, dailyProgressMicro: number): number {
  const rem = Math.max(0, TECH_PROG_SCALE - progressMicro);
  if (rem === 0) return 0;
  return Math.ceil(rem / Math.max(1, dailyProgressMicro));
}

export interface TechSlotSnapshot {
  slotIndex: number;
  techId: string | null;
  progressMicro: number;
  progressPermille: number;
  dailyProgressMicro: number;
  aheadPenaltyPermille: number;
  actualDaysFixed: number;
  etaDays: number;
}

export interface TechSnapshot {
  tag: string;
  currentYear: number;
  researchSpeedBonusPermille: number;
  completedIds: string[];
  slots: TechSlotSnapshot[];
}

export interface CompletedTechEvent {
  tag: string;
  techId: string;
  nameZh: string;
  effectSummaryZh: string;
}
