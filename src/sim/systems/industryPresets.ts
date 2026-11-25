/**
 * Opening 1936 military/dockyard line allocations and initial equipment stockpiles.
 * Guarantees sum of MIL lines <= nation.mil and DOC line <= nation.doc.
 */
import type { NationStartProfile } from '../data/nations1936Core';
import type { EquipmentType } from './industryTypes';

type LineAlloc = Record<EquipmentType, number>;

const MAJOR_MIL_PRESETS: Record<string, Partial<LineAlloc>> = {
  // GER: 26 MIL, 10 DOC -> Steel demand 57 (prod 95, surplus), Oil demand 16 (prod 6, -10 deficit!), Rare demand 26 (prod 18, -8 deficit!)
  GER: { INF_EQ: 8, ART_EQ: 4, MOT_EQ: 3, ARM_EQ: 5, AIR_TAC: 4, AIR_STR: 2, CONVOY: 10 },
  // SOV: 28 MIL, 6 DOC -> self-sufficient industrial giant
  SOV: { INF_EQ: 11, ART_EQ: 5, MOT_EQ: 3, ARM_EQ: 5, AIR_TAC: 3, AIR_STR: 1, CONVOY: 6 },
  // GBR: 14 MIL, 20 DOC -> maritime & air focus
  GBR: { INF_EQ: 4, ART_EQ: 2, MOT_EQ: 2, ARM_EQ: 2, AIR_TAC: 3, AIR_STR: 1, CONVOY: 14 },
  // FRA: 12 MIL, 8 DOC -> infantry, artillery & armor defense
  FRA: { INF_EQ: 5, ART_EQ: 3, MOT_EQ: 1, ARM_EQ: 2, AIR_TAC: 1, AIR_STR: 0, CONVOY: 8 },
  // ITA: 14 MIL, 12 DOC -> resource-poor regional major
  ITA: { INF_EQ: 6, ART_EQ: 3, MOT_EQ: 1, ARM_EQ: 2, AIR_TAC: 2, AIR_STR: 0, CONVOY: 10 },
  // POL: 10 MIL, 1 DOC
  POL: { INF_EQ: 5, ART_EQ: 2, MOT_EQ: 1, ARM_EQ: 1, AIR_TAC: 1, AIR_STR: 0, CONVOY: 1 },
  // SPR: 6 MIL, 4 DOC
  SPR: { INF_EQ: 3, ART_EQ: 1, MOT_EQ: 1, ARM_EQ: 0, AIR_TAC: 1, AIR_STR: 0, CONVOY: 4 },
  // CZE: 11 MIL, 0 DOC
  CZE: { INF_EQ: 5, ART_EQ: 3, MOT_EQ: 1, ARM_EQ: 1, AIR_TAC: 1, AIR_STR: 0, CONVOY: 0 },
};

export function buildOpeningLineAlloc(profile: NationStartProfile): LineAlloc {
  const preset = MAJOR_MIL_PRESETS[profile.tag];
  const alloc: LineAlloc = {
    INF_EQ: 0, ART_EQ: 0, MOT_EQ: 0, ARM_EQ: 0, AIR_TAC: 0, AIR_STR: 0, CONVOY: 0,
  };
  if (preset) {
    let remMil = profile.mil;
    for (const k of ['INF_EQ', 'ART_EQ', 'MOT_EQ', 'ARM_EQ', 'AIR_TAC', 'AIR_STR'] as const) {
      const v = Math.min(remMil, preset[k] ?? 0);
      alloc[k] = v;
      remMil -= v;
    }
    alloc.CONVOY = Math.min(profile.doc, preset.CONVOY ?? profile.doc);
    return alloc;
  }

  // Generic deterministic split for regional/minor states
  let rem = profile.mil;
  if (rem > 0) {
    const inf = Math.max(1, Math.ceil(rem * 0.55));
    alloc.INF_EQ = Math.min(rem, inf);
    rem -= alloc.INF_EQ;
  }
  if (rem > 0) {
    const art = Math.max(1, Math.floor(rem * 0.5));
    alloc.ART_EQ = Math.min(rem, art);
    rem -= alloc.ART_EQ;
  }
  if (rem > 0) { alloc.MOT_EQ = 1; rem -= 1; }
  if (rem > 0) { alloc.AIR_TAC = 1; rem -= 1; }
  if (rem > 0) { alloc.ARM_EQ = rem; }
  alloc.CONVOY = profile.doc;
  return alloc;
}

export function buildOpeningStockpilesFixed(profile: NationStartProfile): Record<EquipmentType, number> {
  const convoys = Math.max(profile.doc * 6, profile.isMajor ? 40 : 12);
  const gbrBonus = profile.tag === 'GBR' ? 80 : 0;
  return {
    INF_EQ: (profile.brigades * 45 + 300) * 1000,
    ART_EQ: (profile.brigades * 6 + 40) * 1000,
    MOT_EQ: (profile.brigades * 4 + 30) * 1000,
    ARM_EQ: (profile.isMajor ? 60 : 10) * 1000,
    AIR_TAC: (profile.airWings * 12 + 10) * 1000,
    AIR_STR: (profile.isMajor ? 18 : 0) * 1000,
    CONVOY: (convoys + gbrBonus) * 1000,
  };
}
