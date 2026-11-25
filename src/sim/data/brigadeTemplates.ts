/**
 * Six fixed combat brigade templates (Carbon §4.9.1), combat slot rules (§4.9.2),
 * and terrain march speed multipliers (§4.9.4). Pure TypeScript, zero DOM/PIXI.
 */
import type { EquipmentType } from '../systems/industryTypes';

export type BrigadeType = 'INF' | 'MTN' | 'MOT' | 'ARM' | 'ART' | 'GAR';
export type BrigadeSlotRole = 'frontline' | 'support';
export type LandTerrainType = 'plains' | 'forest' | 'hills' | 'mountain' | 'marsh' | 'urban' | 'desert';

export interface EquipmentRequirement {
  type: EquipmentType;
  amount: number;
}

export interface BrigadeTemplate {
  type: BrigadeType;
  nameZh: string;
  shortZh: string;
  role: BrigadeSlotRole;
  manpower: number;
  equipment: readonly EquipmentRequirement[];
  maxOrg: number;
  attack: number;
  defense: number;
  breakthrough: number;
  armor: number;
  piercing: number;
  /** Base speed in km/h (also stored as tenth-integer speedTenth for fixed-point math). */
  speed: number;
  speedTenth: number;
  baseTrainDays: number;
  noteZh: string;
}

export const BRIGADE_TYPE_ORDER: readonly BrigadeType[] = [
  'INF', 'MTN', 'MOT', 'ARM', 'ART', 'GAR',
];

export const BRIGADE_TEMPLATES: Readonly<Record<BrigadeType, BrigadeTemplate>> = {
  INF: {
    type: 'INF', nameZh: '主力步兵旅', shortZh: '步兵', role: 'frontline',
    manpower: 10_000,
    equipment: [{ type: 'INF_EQ', amount: 100 }, { type: 'ART_EQ', amount: 10 }],
    maxOrg: 65, attack: 18, defense: 32, breakthrough: 12,
    armor: 0, piercing: 8, speed: 4.0, speedTenth: 40, baseTrainDays: 35,
    noteZh: '填线中坚，全地形均衡，造价低廉',
  },
  MTN: {
    type: 'MTN', nameZh: '山地猎兵旅', shortZh: '山地', role: 'frontline',
    manpower: 10_000,
    equipment: [{ type: 'INF_EQ', amount: 120 }, { type: 'ART_EQ', amount: 15 }],
    maxOrg: 75, attack: 20, defense: 30, breakthrough: 16,
    armor: 0, piercing: 8, speed: 4.5, speedTenth: 45, baseTrainDays: 45,
    noteZh: '高山/丘陵攻防 +30%，严冬损耗减半',
  },
  MOT: {
    type: 'MOT', nameZh: '摩托化步兵旅', shortZh: '摩步', role: 'frontline',
    manpower: 10_000,
    equipment: [
      { type: 'INF_EQ', amount: 100 },
      { type: 'MOT_EQ', amount: 35 },
      { type: 'ART_EQ', amount: 10 },
    ],
    maxOrg: 60, attack: 22, defense: 34, breakthrough: 18,
    armor: 5, piercing: 10, speed: 9.0, speedTenth: 90, baseTrainDays: 45,
    noteZh: '高速穿插巩固突破口，随伴装甲防切割',
  },
  ARM: {
    type: 'ARM', nameZh: '装甲突击旅', shortZh: '装甲', role: 'frontline',
    manpower: 8_000,
    equipment: [
      { type: 'INF_EQ', amount: 40 },
      { type: 'MOT_EQ', amount: 20 },
      { type: 'ARM_EQ', amount: 50 },
    ],
    maxOrg: 45, attack: 38, defense: 20, breakthrough: 42,
    armor: 45, piercing: 40, speed: 8.0, speedTenth: 80, baseTrainDays: 60,
    noteZh: '平原攻坚霸主；森林/山地/沼泽/巷战重罚',
  },
  ART: {
    type: 'ART', nameZh: '重炮工兵支援旅', shortZh: '重炮', role: 'support',
    manpower: 6_000,
    equipment: [{ type: 'INF_EQ', amount: 30 }, { type: 'ART_EQ', amount: 45 }],
    maxOrg: 30, attack: 44, defense: 12, breakthrough: 20,
    armor: 0, piercing: 18, speed: 4.0, speedTenth: 40, baseTrainDays: 45,
    noteZh: '二线支援倾泻火力，削减敌要塞惩罚',
  },
  GAR: {
    type: 'GAR', nameZh: '守备警备旅', shortZh: '守备', role: 'frontline',
    manpower: 6_000,
    equipment: [{ type: 'INF_EQ', amount: 60 }],
    maxOrg: 45, attack: 10, defense: 20, breakthrough: 5,
    armor: 0, piercing: 4, speed: 3.0, speedTenth: 30, baseTrainDays: 35,
    noteZh: '港口海岸防卫与后方占领区镇压',
  },
};

export interface CombatSlotSpec {
  frontline: number;
  support: number;
}

/** Carbon §4.9.2: base 4+2, mountain/marsh 3+1, urban 5+2, flanking +2/+1 per extra direction. */
export const COMBAT_SLOT_RULES = {
  base: { frontline: 4, support: 2 } as CombatSlotSpec,
  narrowTerrains: { frontline: 3, support: 1 } as CombatSlotSpec,
  urban: { frontline: 5, support: 2 } as CombatSlotSpec,
  flankingBonusPerDirection: { frontline: 2, support: 1 } as CombatSlotSpec,
} as const;

export const TERRAIN_COMBAT_SLOTS: Readonly<Record<LandTerrainType, CombatSlotSpec>> = {
  plains: COMBAT_SLOT_RULES.base,
  forest: COMBAT_SLOT_RULES.base,
  hills: COMBAT_SLOT_RULES.base,
  desert: COMBAT_SLOT_RULES.base,
  mountain: COMBAT_SLOT_RULES.narrowTerrains,
  marsh: COMBAT_SLOT_RULES.narrowTerrains,
  urban: COMBAT_SLOT_RULES.urban,
};

export function getCombatSlotsForBattle(terrain: LandTerrainType, attackDirections = 1): CombatSlotSpec {
  const base = TERRAIN_COMBAT_SLOTS[terrain] ?? COMBAT_SLOT_RULES.base;
  const extraDirs = Math.max(0, Math.trunc(attackDirections) - 1);
  return {
    frontline: base.frontline + extraDirs * COMBAT_SLOT_RULES.flankingBonusPerDirection.frontline,
    support: base.support + extraDirs * COMBAT_SLOT_RULES.flankingBonusPerDirection.support,
  };
}

/** Carbon §4.9.4 march speed multipliers (permille, 1000 = 1.00x). */
export const TERRAIN_MARCH_MULT_PERMILLE: Readonly<Record<LandTerrainType, number>> = {
  plains: 1000,
  forest: 750,
  hills: 750,
  mountain: 450,
  marsh: 500,
  urban: 900,
  desert: 850,
};

export const MAX_ARMY_BRIGADES = 16;
export const ARMY_COLORS: readonly string[] = [
  '#C84B31', // vermilion staff ink
  '#3A6EA5', // Prussian steel blue
  '#5A8A4F', // field olive green
  '#B8862E', // brass ochre
  '#7D4E7A', // imperial plum
  '#2E7E82', // teal staff ink
];
