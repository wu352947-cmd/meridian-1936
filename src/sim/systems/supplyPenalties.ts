/**
 * Deterministic Low-Supply & Starvation Penalty Evaluation + Per-Tick Attrition (Carbon §4.10).
 * Pure TypeScript — zero DOM/PIXI references.
 */
import { clampInt, FIXED_SCALE } from '../core/FixedMath';
import { BRIGADE_TEMPLATES } from '../data/brigadeTemplates';
import type { BrigadeState } from './armyTypes';
import type { EquipmentType } from './industryTypes';
import {
  calcSupplyCap,
  SUPPLY_DEFINES,
  type BrigadeSupplyEffect,
  type SupplyStatus,
} from './supplyTypes';

/** Count friendly brigades per (owner, provinceId) key for O(1) stacking lookups. */
export function countBrigadesByOwnerProv(brigades: readonly BrigadeState[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const b of brigades) {
    const k = `${b.owner}:${b.provinceId}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/** Pure deterministic supply status & combat/march multipliers for a brigade at a province. */
export function evaluateSupplyEffect(
  supplyValue: number,
  brigadesInProv: number,
  zeroSupplyTicks: number,
): BrigadeSupplyEffect {
  const s = clampInt(Math.trunc(supplyValue), 0, SUPPLY_DEFINES.maxSupply);
  const cap = calcSupplyCap(s);
  const n = Math.max(1, Math.trunc(brigadesInProv));
  const zTicks = Math.max(0, Math.trunc(zeroSupplyTicks));

  // Starving: S_p = 0 for >= 48 hours (8 six-hour ticks)
  if (s === 0 && zTicks >= SUPPLY_DEFINES.starvationDelayTicks) {
    return {
      supplyValue: 0,
      supplyCap: cap,
      brigadesInProv: n,
      status: 'starving',
      zeroSupplyTicks: zTicks,
      combatMultPermille: SUPPLY_DEFINES.starvationCombatMultPermille, // -60%
      speedMultPermille: SUPPLY_DEFINES.starvationSpeedMultPermille,   // -50%
      canRecoverOrg: false,
      noteZh: '断粮 −60%',
    };
  }

  // Low Supply: N > Cap_p or S_p < 30
  if (s < SUPPLY_DEFINES.lowSupplyThreshold || n > cap) {
    const sDeficit =
      s < SUPPLY_DEFINES.lowSupplyThreshold
        ? Math.floor(((SUPPLY_DEFINES.lowSupplyThreshold - s) * FIXED_SCALE) / SUPPLY_DEFINES.lowSupplyThreshold)
        : 0;
    const nDeficit =
      n > cap
        ? clampInt(Math.floor(((n - cap) * FIXED_SCALE) / Math.max(1, cap)), 0, FIXED_SCALE)
        : 0;
    const deficit = clampInt(Math.max(sDeficit, nDeficit), 1, FIXED_SCALE);
    const combatPenalty =
      SUPPLY_DEFINES.lowSupplyMinPenaltyPermille +
      Math.floor(
        ((SUPPLY_DEFINES.lowSupplyMaxPenaltyPermille - SUPPLY_DEFINES.lowSupplyMinPenaltyPermille) * deficit) /
          FIXED_SCALE,
      );
    const speedPenalty = clampInt(
      Math.floor((SUPPLY_DEFINES.lowSupplyMaxSpeedPenaltyPermille * deficit) / FIXED_SCALE),
      50,
      SUPPLY_DEFINES.lowSupplyMaxSpeedPenaltyPermille,
    );
    const pct = Math.round(combatPenalty / 10);
    const reason = n > cap && s >= SUPPLY_DEFINES.lowSupplyThreshold ? `超载 ${n}/${cap}` : `缺粮`;
    return {
      supplyValue: s,
      supplyCap: cap,
      brigadesInProv: n,
      status: 'low',
      zeroSupplyTicks: zTicks,
      combatMultPermille: FIXED_SCALE - combatPenalty,
      speedMultPermille: FIXED_SCALE - speedPenalty,
      canRecoverOrg: false,
      noteZh: `S=${s} · ${reason} −${pct}%`,
    };
  }

  return {
    supplyValue: s,
    supplyCap: cap,
    brigadesInProv: n,
    status: 'ok',
    zeroSupplyTicks: 0,
    combatMultPermille: FIXED_SCALE,
    speedMultPermille: FIXED_SCALE,
    canRecoverOrg: true,
    noteZh: `S=${s} 正常`,
  };
}

export interface AttritionHooks {
  getSupply: (provId: number) => number;
  /** Returns winter attrition multiplier in permille (1000 normal, 2000 severe winter, 1500 cold-resistant). */
  getAttritionMultPermille: (provId: number, ownerTag: string, template: BrigadeState['template']) => number;
  onEquipmentLost?: (tag: string, eqType: EquipmentType, units: number) => void;
}

/**
 * Advance per-tick zero-supply counters, refresh brigade supply status fields, and apply
 * starvation attrition (S=0 for >=8 ticks: -4 Org & -1.5% equipment per tick, doubled in severe winter).
 */
export function stepBrigadeSupplyTick(
  brigades: readonly BrigadeState[],
  hooks: AttritionHooks,
): void {
  const stackCounts = countBrigadesByOwnerProv(brigades);

  for (const b of brigades) {
    const s = hooks.getSupply(b.provinceId);
    if (s === 0) {
      b.zeroSupplyTicks = Math.min(999, b.zeroSupplyTicks + 1);
    } else {
      b.zeroSupplyTicks = 0;
    }

    const n = stackCounts.get(`${b.owner}:${b.provinceId}`) ?? 1;
    const eff = evaluateSupplyEffect(s, n, b.zeroSupplyTicks);
    b.supplyStatus = eff.status;
    b.supplyValue = eff.supplyValue;

    if (eff.status === 'starving') {
      const tmpl = BRIGADE_TEMPLATES[b.template];
      const attrMult = hooks.getAttritionMultPermille(b.provinceId, b.owner, b.template);

      // -4 Org points/tick converted to permille of template maxOrg (scaled by winter attrition mult)
      const orgPtsMilli = Math.floor((SUPPLY_DEFINES.starvationOrgLossPoints * attrMult));
      const orgLossPermille = Math.max(1, Math.round(orgPtsMilli / Math.max(1, tmpl.maxOrg)));
      b.orgPermille = Math.max(0, b.orgPermille - orgLossPermille);

      // -1.5% equipment/strength per tick (15 permille, scaled by winter attrition mult -> 30 in severe winter)
      const strLossPermille = Math.max(
        1,
        Math.floor((SUPPLY_DEFINES.starvationEquipLossPermille * attrMult + 500) / FIXED_SCALE),
      );
      const prevStr = b.strengthPermille;
      b.strengthPermille = Math.max(50, b.strengthPermille - strLossPermille);
      const actualDrop = prevStr - b.strengthPermille;
      if (actualDrop > 0 && hooks.onEquipmentLost) {
        for (const req of tmpl.equipment) {
          const eqLost = Math.floor((req.amount * actualDrop) / FIXED_SCALE);
          if (eqLost > 0) hooks.onEquipmentLost(b.owner, req.type, eqLost);
        }
      }
    }
  }
}

export type { SupplyStatus };
