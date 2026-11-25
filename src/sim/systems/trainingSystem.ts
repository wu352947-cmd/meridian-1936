/**
 * Deterministic Brigade Training & Deployment Queue helpers (Carbon §4.9 + Batch 05 §2).
 * Rule on equipment shortage: training IS permitted to start, consuming available stockpile;
 * deployed strength ratio equals the minimum equipment coverage ratio across required types
 * (floored at 10% cadre strength so brigades never spawn at 0%). Pure TS, zero DOM/PIXI.
 */
import { clampInt, FIXED_SCALE, mulFixed } from '../core/FixedMath';
import { BRIGADE_TEMPLATES, type BrigadeType } from '../data/brigadeTemplates';
import { getCapitalProvince, getSimProvince } from '../data/provinces1936';
import type { TrainingOrderSnap, TrainingOrderState } from './armyTypes';
import type { EquipmentType } from './industryTypes';

export const MIN_DEPLOY_STRENGTH_PERMILLE = 100; // 10% minimum cadre strength
export const MIN_DEPLOY_ORG_PERMILLE = 250;      // 25% minimum opening org when under-equipped

export interface TrainingResourceAdapter {
  getAvailableManpower: (tag: string) => number;
  consumeEquipment: (tag: string, eqType: EquipmentType, units: number) => number;
  refundEquipment: (tag: string, eqType: EquipmentType, units: number) => void;
}

export function calcTargetTrainDaysFixed(template: BrigadeType, trainingTimeModPermille: number): number {
  const base = BRIGADE_TEMPLATES[template].baseTrainDays;
  const mult = clampInt(FIXED_SCALE + trainingTimeModPermille, 200, 3000);
  return Math.max(FIXED_SCALE, mulFixed(base * FIXED_SCALE, mult));
}

export function resolveDeployProvince(tag: string, requestedProvId?: number | null): number | null {
  if (typeof requestedProvId === 'number') {
    const p = getSimProvince(requestedProvId);
    if (p && p.owner === tag) return p.id;
  }
  return getCapitalProvince(tag)?.id ?? null;
}

export function createTrainingOrder(
  id: number,
  owner: string,
  template: BrigadeType,
  deployProvId: number | null | undefined,
  armyId: number | null,
  trainingTimeModPermille: number,
  res: TrainingResourceAdapter,
): TrainingOrderState | null {
  const spec = BRIGADE_TEMPLATES[template];
  if (!spec) return null;
  if (res.getAvailableManpower(owner) < spec.manpower) return null;

  const resolvedProv = resolveDeployProvince(owner, deployProvId);
  if (resolvedProv === null) return null;

  const equipmentTaken: Partial<Record<EquipmentType, number>> = {};
  let worstRatio = FIXED_SCALE;
  let shortageType: EquipmentType | null = null;

  for (const req of spec.equipment) {
    const taken = res.consumeEquipment(owner, req.type, req.amount);
    equipmentTaken[req.type] = taken;
    const ratio = req.amount > 0 ? Math.min(FIXED_SCALE, Math.floor((taken * FIXED_SCALE) / req.amount)) : FIXED_SCALE;
    if (ratio < worstRatio) {
      worstRatio = ratio;
      shortageType = req.type;
    }
  }

  return {
    id,
    owner,
    template,
    deployProvId: resolvedProv,
    armyId,
    progressDaysFixed: 0,
    targetDaysFixed: calcTargetTrainDaysFixed(template, trainingTimeModPermille),
    manpowerAllocated: spec.manpower,
    equipmentTaken,
    equipmentRatioPermille: worstRatio,
    shortageType,
  };
}

export function refundTrainingOrder(order: TrainingOrderState, res: TrainingResourceAdapter): void {
  for (const [k, qty] of Object.entries(order.equipmentTaken)) {
    if (qty && qty > 0) {
      res.refundEquipment(order.owner, k as EquipmentType, qty);
    }
  }
}

export function advanceTrainingOrdersDaily(
  orders: TrainingOrderState[],
  getTrainingTimeMod: (tag: string) => number,
): { remaining: TrainingOrderState[]; completed: TrainingOrderState[] } {
  const remaining: TrainingOrderState[] = [];
  const completed: TrainingOrderState[] = [];
  for (const o of orders) {
    o.targetDaysFixed = calcTargetTrainDaysFixed(o.template, getTrainingTimeMod(o.owner));
    o.progressDaysFixed += FIXED_SCALE;
    if (o.progressDaysFixed >= o.targetDaysFixed) {
      completed.push(o);
    } else {
      remaining.push(o);
    }
  }
  return { remaining, completed };
}

export function toTrainingOrderSnap(o: TrainingOrderState): TrainingOrderSnap {
  const prov = getSimProvince(o.deployProvId);
  const remFixed = Math.max(0, o.targetDaysFixed - o.progressDaysFixed);
  const remainingDays = Math.ceil(remFixed / FIXED_SCALE);
  const totalDays = Math.ceil(o.targetDaysFixed / FIXED_SCALE);
  const progressPermille = Math.min(
    FIXED_SCALE,
    Math.floor((o.progressDaysFixed * FIXED_SCALE) / Math.max(1, o.targetDaysFixed)),
  );
  return {
    id: o.id,
    template: o.template,
    deployProvId: o.deployProvId,
    deployProvNameZh: prov?.nameZh ?? `#${o.deployProvId}`,
    armyId: o.armyId,
    progressPermille,
    remainingDays,
    totalDays,
    manpowerAllocated: o.manpowerAllocated,
    equipmentRatioPermille: o.equipmentRatioPermille,
    shortageType: o.shortageType,
  };
}
