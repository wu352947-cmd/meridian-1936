/**
 * Pure deterministic fixed-point industrial formulas (Carbon §4.2 & §4.6).
 * Zero DOM/WebGL references; all outputs are 32-bit safe integers.
 */
import { clampInt, divFixed, FIXED_SCALE, mulFixed } from '../core/FixedMath';
import {
  BASE_CP_PER_CIV_FIXED,
  INFRA_MULT_PERMILLE,
  MASTERY_DAILY_GAIN_MICRO,
  MASTERY_SCALE,
  type EquipmentSpec,
} from './industryTypes';

/** Half-up integer consumer goods CIV allocation, guaranteed in [0, totalCiv]. */
export function calcConsumerGoodsCiv(totalCiv: number, consumerGoodsPermille: number): number {
  if (totalCiv <= 0 || consumerGoodsPermille <= 0) return 0;
  const raw = Math.floor((totalCiv * consumerGoodsPermille + 500) / FIXED_SCALE);
  return clampInt(raw, 0, totalCiv);
}

/** Daily construction CP (fixed x1000) for assigned CIV in a region of infra 1..5 with speed modifier. */
export function calcDailyCpFixed(
  assignedCiv: number,
  infraLevel: number,
  speedMultPermille = FIXED_SCALE,
): number {
  if (assignedCiv <= 0) return 0;
  const lvl = clampInt(infraLevel, 1, 5);
  const mult = INFRA_MULT_PERMILLE[lvl] ?? FIXED_SCALE;
  const perCiv = mulFixed(BASE_CP_PER_CIV_FIXED, mult);
  const clampedSpeed = clampInt(speedMultPermille, 200, 3000);
  return assignedCiv * mulFixed(perCiv, clampedSpeed);
}

/**
 * Daily mastery progression in micro-units (1_000_000 = 100%):
 *   deltaE = 0.012 * (E_max - E) / E_max
 */
export function stepMasteryMicro(currentMicro: number, maxMicro: number): number {
  if (maxMicro <= 0) return 0;
  if (currentMicro >= maxMicro) return maxMicro;
  const gap = maxMicro - currentMicro;
  const num = BigInt(MASTERY_DAILY_GAIN_MICRO) * BigInt(gap) + BigInt(maxMicro >> 1);
  const delta = Number(num / BigInt(maxMicro));
  return Math.min(maxMicro, currentMicro + Math.max(1, delta));
}

/** Cohesion factory output multiplier (Carbon §4.2: +/-4% per +/-10% from 50%). */
export function calcCohesionMultPermille(cohesionPermille: number): number {
  const diff = (cohesionPermille | 0) - 500;
  return clampInt(FIXED_SCALE + mulFixed(diff, 400), 500, 1500);
}

/** Coverage permille [0..1000] = min(1000, available / demand). */
export function calcResourceCoveragePermille(available: number, demand: number): number {
  if (demand <= 0) return FIXED_SCALE;
  if (available <= 0) return 0;
  if (available >= demand) return FIXED_SCALE;
  return clampInt(divFixed(available, demand), 0, FIXED_SCALE);
}

/**
 * Resource efficiency multiplier for a production line (Carbon §4.6):
 * Every 10% shortage of a required resource imposes -8% penalty, capped at -80% (floor 20%).
 */
export function calcLineResourceMultPermille(
  spec: EquipmentSpec,
  covSteelPermille: number,
  covOilPermille: number,
  covRarePermille: number,
): number {
  let maxDeficit = 0;
  if (spec.steelPerFac > 0) {
    maxDeficit = Math.max(maxDeficit, FIXED_SCALE - clampInt(covSteelPermille, 0, FIXED_SCALE));
  }
  if (spec.oilPerFac > 0) {
    maxDeficit = Math.max(maxDeficit, FIXED_SCALE - clampInt(covOilPermille, 0, FIXED_SCALE));
  }
  if (spec.rarePerFac > 0) {
    maxDeficit = Math.max(maxDeficit, FIXED_SCALE - clampInt(covRarePermille, 0, FIXED_SCALE));
  }
  const penalty = clampInt(mulFixed(maxDeficit, 800), 0, 800);
  return FIXED_SCALE - penalty;
}

/**
 * Actual daily equipment units produced (fixed x1000):
 *   dailyIC = N * baseOutput * E * M_cohesion * M_tech * M_resource
 *   units   = dailyIC / unitCost
 */
export function calcLineDailyUnitsFixed(
  spec: EquipmentSpec,
  factories: number,
  masteryMicro: number,
  cohesionPermille: number,
  techMultPermille: number,
  resourceMultPermille: number,
): number {
  if (factories <= 0 || spec.unitCostFixed <= 0) return 0;
  const cohMult = calcCohesionMultPermille(cohesionPermille);
  const dailyIc = BigInt(factories) * BigInt(spec.baseOutputFixed);
  const scaled =
    dailyIc *
    BigInt(clampInt(masteryMicro, 0, MASTERY_SCALE)) *
    BigInt(cohMult) *
    BigInt(clampInt(techMultPermille, 100, 3000)) *
    BigInt(clampInt(resourceMultPermille, 200, FIXED_SCALE));
  const denom = BigInt(MASTERY_SCALE) * 1000n * 1000n * 1000n;
  const effIcFixed = scaled / denom;
  const unitsFixed = (effIcFixed * BigInt(FIXED_SCALE)) / BigInt(spec.unitCostFixed);
  return Number(unitsFixed);
}
