/**
 * Deterministic Manpower Pool & Smooth Monthly Mobilization System (Carbon §4.7).
 * Formula: MaxManpower = (sum(corePop) + 0.12 * sum(nonCorePop)) * R_conscription_effective
 * Inflow: +0.4% of effective total population per month (~0.0133%/day) after conscription upgrade.
 * Pure TypeScript — zero DOM/PIXI references.
 */
import { FIXED_SCALE } from '../core/FixedMath';
import { ALL_PLAYABLE_NATIONS_1936 } from '../data/nations1936';
import { REGION_POPS_1936 } from '../data/regionPop1936';
import type { ManpowerSnapshot } from './governanceTypes';

export const NON_CORE_MANPOWER_PERMILLE = 120; // 12%
export const MONTHLY_MOBILIZATION_PERMILLE = 4; // +0.4% total effective pop per month
export const BRIGADE_MANPOWER_PLACEHOLDER = 10_000;

interface NationManpowerState {
  tag: string;
  corePop: number;
  nonCorePop: number;
  effectivePop: number;
  baseRatePermille: number;
  rateModifierPermille: number;
  maxManpower: number;
  mobilizedPool: number;
  deployed: number;
  inTraining: number;
  casualties: number;
}

export function calcEffectivePop(corePop: number, nonCorePop: number): number {
  const nonCoreContrib = Number((BigInt(Math.max(0, nonCorePop)) * BigInt(NON_CORE_MANPOWER_PERMILLE)) / BigInt(FIXED_SCALE));
  return Math.max(0, corePop) + nonCoreContrib;
}

export function calcMaxManpower(effectivePop: number, baseRatePermille: number, rateModifierPermille: number): number {
  const effRate = Math.max(0, (baseRatePermille + rateModifierPermille) | 0);
  if (effRate <= 0 || effectivePop <= 0) return 0;
  return Number((BigInt(effectivePop) * BigInt(effRate)) / BigInt(FIXED_SCALE));
}

export function calcMonthlyInflow(effectivePop: number): number {
  if (effectivePop <= 0) return 0;
  return Number((BigInt(effectivePop) * BigInt(MONTHLY_MOBILIZATION_PERMILLE)) / BigInt(FIXED_SCALE));
}

export function calcDailyInflow(effectivePop: number): number {
  if (effectivePop <= 0) return 0;
  return Math.max(1, Number((BigInt(effectivePop) * BigInt(MONTHLY_MOBILIZATION_PERMILLE)) / 30_000n));
}

export class ManpowerSystem {
  private nations = new Map<string, NationManpowerState>();
  private nationOrder: string[] = [];

  reset(getRates: (tag: string) => { baseRatePermille: number; rateModifierPermille: number }): void {
    this.nations.clear();
    this.nationOrder = ALL_PLAYABLE_NATIONS_1936.map((p) => p.tag);

    const coreByTag = new Map<string, number>();
    const nonCoreByTag = new Map<string, number>();
    for (const r of REGION_POPS_1936) {
      if (r.isCore) coreByTag.set(r.owner, (coreByTag.get(r.owner) ?? 0) + r.population);
      else nonCoreByTag.set(r.owner, (nonCoreByTag.get(r.owner) ?? 0) + r.population);
    }

    for (const p of ALL_PLAYABLE_NATIONS_1936) {
      const corePop = coreByTag.get(p.tag) ?? 0;
      const nonCorePop = nonCoreByTag.get(p.tag) ?? 0;
      const effectivePop = calcEffectivePop(corePop, nonCorePop);
      const { baseRatePermille, rateModifierPermille } = getRates(p.tag);
      const maxManpower = calcMaxManpower(effectivePop, baseRatePermille, rateModifierPermille);

      this.nations.set(p.tag, {
        tag: p.tag,
        corePop,
        nonCorePop,
        effectivePop,
        baseRatePermille,
        rateModifierPermille,
        maxManpower,
        mobilizedPool: maxManpower,
        deployed: p.brigades * BRIGADE_MANPOWER_PLACEHOLDER,
        inTraining: 0,
        casualties: 0,
      });
    }
  }

  /** Replace placeholder deployed manpower with real brigade sum + reserved training manpower. */
  setDeployedAndTraining(tag: string, deployed: number, inTraining: number): void {
    const n = this.nations.get(tag);
    if (!n) return;
    n.deployed = Math.max(0, Math.trunc(deployed));
    n.inTraining = Math.max(0, Math.trunc(inTraining));
  }

  /** Recalculate max cap immediately when laws/modifiers change; upward gap fills smoothly over time. */
  syncRates(tag: string, baseRatePermille: number, rateModifierPermille: number): void {
    const n = this.nations.get(tag);
    if (!n) return;
    n.baseRatePermille = baseRatePermille;
    n.rateModifierPermille = rateModifierPermille;
    n.maxManpower = calcMaxManpower(n.effectivePop, baseRatePermille, rateModifierPermille);
    if (n.mobilizedPool > n.maxManpower) {
      n.mobilizedPool = n.maxManpower;
    }
  }

  /** Advance 1 simulation day: smoothly trickle mobilizedPool toward maxManpower at +0.4% pop/month. */
  stepDaily(getRates: (tag: string) => { baseRatePermille: number; rateModifierPermille: number }): void {
    for (const tag of this.nationOrder) {
      const n = this.nations.get(tag)!;
      const { baseRatePermille, rateModifierPermille } = getRates(tag);
      n.baseRatePermille = baseRatePermille;
      n.rateModifierPermille = rateModifierPermille;
      n.maxManpower = calcMaxManpower(n.effectivePop, baseRatePermille, rateModifierPermille);

      if (n.mobilizedPool < n.maxManpower) {
        const inflow = calcDailyInflow(n.effectivePop);
        n.mobilizedPool = Math.min(n.maxManpower, n.mobilizedPool + inflow);
      } else if (n.mobilizedPool > n.maxManpower) {
        n.mobilizedPool = n.maxManpower;
      }
    }
  }

  getAvailableManpower(tag: string): number {
    const n = this.nations.get(tag);
    if (!n) return 0;
    return Math.max(0, n.mobilizedPool - n.deployed - n.inTraining - n.casualties);
  }

  getAvailableManpowerK(tag: string): number {
    return Math.floor(this.getAvailableManpower(tag) / 1000);
  }

  getSnapshotFor(tag: string): ManpowerSnapshot {
    const n = this.nations.get(tag) ?? this.nations.get('GER')!;
    const effRate = Math.max(0, (n.baseRatePermille + n.rateModifierPermille) | 0);
    const available = Math.max(0, n.mobilizedPool - n.deployed - n.inTraining - n.casualties);
    const isMobilizing = n.mobilizedPool < n.maxManpower;
    const dailyInflow = isMobilizing ? Math.min(calcDailyInflow(n.effectivePop), n.maxManpower - n.mobilizedPool) : 0;
    const monthlyInflow = isMobilizing ? calcMonthlyInflow(n.effectivePop) : 0;

    return {
      corePop: n.corePop,
      nonCorePop: n.nonCorePop,
      effectivePop: n.effectivePop,
      baseRatePermille: n.baseRatePermille,
      rateModifierPermille: n.rateModifierPermille,
      effectiveRatePermille: effRate,
      maxManpower: n.maxManpower,
      mobilizedPool: n.mobilizedPool,
      deployed: n.deployed,
      casualties: n.casualties,
      available,
      dailyInflow,
      monthlyInflow,
    };
  }

  mixHash(mix: (v: number) => void): void {
    for (const tag of this.nationOrder) {
      const n = this.nations.get(tag)!;
      mix(n.maxManpower | 0);
      mix(n.mobilizedPool | 0);
      mix((n.deployed ^ (n.inTraining << 2) ^ (n.casualties << 1)) | 0);
    }
  }
}
