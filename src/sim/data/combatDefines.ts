/**
 * Centralized deterministic balance constants for Batch 06 Land Combat (Carbon §4.9).
 * All multipliers use Int32 permille scale (FIXED_SCALE = 1000 -> 1.00x).
 * Pure TypeScript — zero DOM/PIXI dependencies.
 */
import type { BrigadeType, LandTerrainType } from './brigadeTemplates';

export type RiverCrossingKind = 'none' | 'minor' | 'major';

export const COMBAT_DEFINES = {
  /** Base hit rate permille when attack <= target defense/breakthrough (parried). */
  parryHitPermille: 100,
  /** Hit rate permille for attack exceeding target defense/breakthrough (3x crit). */
  critHitPermille: 300,
  /** Armor advantage (Arm > enemy Prc): Org damage taken x0.60, dealt x1.35. */
  armorOrgTakenMult: 600,
  armorOrgDealtMult: 1350,
  /** Per-hit damage multipliers: dOrg = hits * 1.35, dStr = hits * 0.22 (scaled to permille). */
  orgDmgPerHitPermille: 1350,
  strDmgPerHitPermille: 220,
  /** Strength loss splits 60% into manpower casualties and 40% into equipment loss. */
  strLossManpowerSharePermille: 600,
  strLossEquipmentSharePermille: 400,
  /** Reserve rotation chance per 6h tick (25%, 45% with radio tech). */
  baseReserveRotatePermille: 250,
  radioReserveRotatePermille: 450,
  /** Exhausted frontline org threshold (<15%) eligible for reserve swap. */
  lowOrgRotateThresholdPermille: 150,
  /** Exposed ART brigade without frontline cover takes halved defense (x0.50). */
  exposedArtDefMult: 500,
  /** Entrenchment gain +3%/day (+30 permille/day), base cap +24% (tech +33%). */
  entrenchDailyGainPermille: 30,
  entrenchBaseCapPermille: 240,
  entrenchTechCapPermille: 330,
  /** Offensive planning gain +3%/day, cap +24%, combat decay -2%/day. */
  planDailyGainPermille: 30,
  planMaxCapPermille: 240,
  planCombatDailyDecayPermille: 20,
  /** Fort penalty: -14% per effective level (max 5); ART support negates up to 2 levels. */
  fortPenaltyPerLevelPermille: 140,
  fortMaxLevel: 5,
  artFortReductionLevels: 2,
  /** Minimum strength multiplier floor (10%). */
  minStrengthMultPermille: 100,
  /** Encirclement wipeout equipment capture rate (15% of template full equipment). */
  encirclementCapturePermille: 150,
  /** Daily peace/idle Org recovery (+10% maxOrg/day -> +25 permille per 6h tick). */
  idleOrgRecoveryPerTickPermille: 25,
  /** Minimum Org permille required for army arrow AI to initiate a new assault. */
  arrowMinAttackOrgPermille: 250,
  /** Disabled Batch 07/10 multipliers pinned to 1.00x (1000 permille). */
  disabledMultiplierPermille: 1000,
} as const;

/** Carbon §4.9.4 terrain offensive attack multipliers (permille). */
const TERRAIN_ATK_INF: Readonly<Record<LandTerrainType, number>> = {
  plains: 1000,
  forest: 850,
  hills: 800,
  mountain: 550,
  marsh: 650,
  urban: 700,
  desert: 900,
};

const TERRAIN_ATK_MTN: Readonly<Record<LandTerrainType, number>> = {
  plains: 1000,
  forest: 850,
  hills: 1100,    // +10% (+30% vs standard infantry)
  mountain: 850,  // -15% (+30% vs standard infantry)
  marsh: 650,
  urban: 700,
  desert: 900,
};

const TERRAIN_ATK_ARMOR: Readonly<Record<LandTerrainType, number>> = {
  plains: 1100,   // +10%
  forest: 650,    // -35%
  hills: 700,     // -30%
  mountain: 300,  // -70%
  marsh: 350,     // -65%
  urban: 500,     // -50%
  desert: 1050,   // +5%
};

export function getTerrainAttackMultPermille(template: BrigadeType, terrain: LandTerrainType): number {
  if (template === 'ARM' || template === 'MOT') return TERRAIN_ATK_ARMOR[terrain] ?? 1000;
  if (template === 'MTN') return TERRAIN_ATK_MTN[terrain] ?? 1000;
  return TERRAIN_ATK_INF[terrain] ?? 1000;
}

/** MTN brigades also receive +30% defense bonus in hills & mountains (§4.9.1). */
export function getTerrainDefenseMultPermille(template: BrigadeType, terrain: LandTerrainType): number {
  if (template === 'MTN' && (terrain === 'hills' || terrain === 'mountain')) return 1300;
  return 1000;
}

/** Carbon §4.9.4 river crossing attack multiplier (permille). */
export function getRiverAttackMultPermille(template: BrigadeType, river: RiverCrossingKind): number {
  if (river === 'none') return 1000;
  const isMech = template === 'ARM' || template === 'MOT';
  if (river === 'minor') return isMech ? 750 : 850;
  return isMech ? 550 : 700;
}

/** Static 1936 historical land fortifications (1..5 levels). */
export const STATIC_FORTS_1936: Readonly<Record<number, number>> = {
  138: 5, // 斯特拉斯堡 (马奇诺核心)
  44: 3,  // 乌斯季 (苏台德筑垒)
  37: 2,  // 比尔森 (波希米亚西垒)
};

export function getProvinceFortLevel(provId: number): number {
  return STATIC_FORTS_1936[provId] ?? 0;
}

export const TERRAIN_ZH: Readonly<Record<LandTerrainType, string>> = {
  plains: '平原',
  forest: '森林',
  hills: '丘陵',
  mountain: '高山',
  marsh: '沼泽',
  urban: '都市',
  desert: '荒漠',
};

export const RIVER_ZH: Readonly<Record<RiverCrossingKind, string>> = {
  none: '',
  minor: '跨支流',
  major: '跨大河',
};
