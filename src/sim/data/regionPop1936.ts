/**
 * Historical 1936 Core / Non-Core Population Estimates for all 143 European Industrial Regions.
 * Deterministic integer populations calibrated so GER/GBR/FRA/SOV/ITA/POL scale realistically
 * and opening available manpower aligns cleanly with nations1936*.ts manpowerK order of magnitude.
 */
import { REGIONS_1936 } from './regions1936';

/** Non-core overseas/colonial/mandate regions in 1936 (contribute 12% to MaxManpower per Carbon §4.7). */
export const NON_CORE_REGION_IDS: ReadonlySet<number> = new Set<number>([
  16, 17, 19, 21,             // GBR: Kuwait, Cairo, Tel Aviv, Suez
  25, 26, 27, 28, 31, 32, 33, 34, // FRA: Levant & French North Africa
  62, 63, 65,                 // ITA: Tobruk, Tripoli, Rhodes
  80,                         // SPR: Tangier / Spanish Morocco
]);

interface NationPopTarget {
  corePop: number;
  nonCorePop: number;
}

/** Realistic 1936 theater populations (exact people). */
const NATION_POP_TARGETS: Readonly<Record<string, NationPopTarget>> = {
  SOV: { corePop: 122_000_000, nonCorePop: 0 },
  GER: { corePop: 66_000_000, nonCorePop: 0 },
  GBR: { corePop: 47_000_000, nonCorePop: 19_000_000 },
  ITA: { corePop: 42_500_000, nonCorePop: 1_200_000 },
  FRA: { corePop: 41_500_000, nonCorePop: 18_500_000 },
  POL: { corePop: 33_800_000, nonCorePop: 0 },
  SPR: { corePop: 24_500_000, nonCorePop: 900_000 },
  ROM: { corePop: 19_200_000, nonCorePop: 0 },
  TUR: { corePop: 16_500_000, nonCorePop: 0 },
  CZE: { corePop: 15_200_000, nonCorePop: 0 },
  YUG: { corePop: 15_000_000, nonCorePop: 0 },
  HOL: { corePop: 10_500_000, nonCorePop: 0 },
  BEL: { corePop: 9_800_000, nonCorePop: 0 },
  HUN: { corePop: 9_000_000, nonCorePop: 0 },
  POR: { corePop: 8_200_000, nonCorePop: 0 },
  SWE: { corePop: 7_400_000, nonCorePop: 0 },
  GRE: { corePop: 7_000_000, nonCorePop: 0 },
  AUS: { corePop: 6_800_000, nonCorePop: 0 },
  BUL: { corePop: 6_200_000, nonCorePop: 0 },
  SWI: { corePop: 4_400_000, nonCorePop: 0 },
  FIN: { corePop: 4_200_000, nonCorePop: 0 },
  DEN: { corePop: 4_000_000, nonCorePop: 0 },
  IRE: { corePop: 3_600_000, nonCorePop: 0 },
  NOR: { corePop: 3_200_000, nonCorePop: 0 },
  LIT: { corePop: 2_600_000, nonCorePop: 0 },
  LAT: { corePop: 2_100_000, nonCorePop: 0 },
  EST: { corePop: 1_700_000, nonCorePop: 0 },
  ALB: { corePop: 1_500_000, nonCorePop: 0 },
  LUX: { corePop: 1_400_000, nonCorePop: 0 },
  DNZ: { corePop: 1_200_000, nonCorePop: 0 },
  ISL: { corePop: 1_200_000, nonCorePop: 0 },
};

export interface RegionPopDef {
  regionId: number;
  owner: string;
  isCore: boolean;
  population: number;
}

function buildRegionPopulations(): RegionPopDef[] {
  const byOwner = new Map<string, typeof REGIONS_1936[number][]>();
  for (const r of REGIONS_1936) {
    const list = byOwner.get(r.owner) ?? [];
    list.push(r);
    byOwner.set(r.owner, list);
  }

  const out: RegionPopDef[] = [];
  for (const [owner, regs] of byOwner.entries()) {
    const target = NATION_POP_TARGETS[owner] ?? { corePop: 3_000_000, nonCorePop: 0 };
    const coreRegs = regs.filter((r) => !NON_CORE_REGION_IDS.has(r.id));
    const nonCoreRegs = regs.filter((r) => NON_CORE_REGION_IDS.has(r.id));

    const distribute = (group: typeof regs, totalPop: number, isCore: boolean): void => {
      if (group.length === 0) return;
      const weights = group.map((r) => Math.max(1, r.slots * 3 + r.civ * 2 + r.mil + r.provinceIds.length));
      const sumW = weights.reduce((s, w) => s + w, 0);
      let assigned = 0;
      for (let i = 0; i < group.length; i++) {
        const reg = group[i]!;
        const pop =
          i === group.length - 1
            ? Math.max(0, totalPop - assigned)
            : Math.floor((totalPop * weights[i]!) / sumW);
        assigned += pop;
        out.push({ regionId: reg.id, owner, isCore, population: pop });
      }
    };

    distribute(coreRegs, target.corePop, true);
    distribute(nonCoreRegs, target.nonCorePop, false);
  }

  out.sort((a, b) => a.regionId - b.regionId);
  return out;
}

export const REGION_POPS_1936: readonly RegionPopDef[] = buildRegionPopulations();
