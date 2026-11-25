/**
 * Unified declarative Modifier table shared by Governance Laws, Cyanotype Techs & Regimes.
 * Pure TypeScript (permille integer scale = 1000 where applicable; flat integers for slots/oil).
 */

export type ModifierKey =
  | 'factory_output'
  | 'mil_output'
  | 'build_speed'
  | 'mil_build_speed'
  | 'synth_build_speed'
  | 'mastery_cap'
  | 'region_slots'
  | 'synth_oil_per_plant'
  | 'research_speed'
  | 'conscription_rate'
  | 'training_time'
  | 'cohesion_cap'
  | 'infantry_attack'
  | 'infantry_defense'
  | 'artillery_attack'
  | 'anti_tank_piercing'
  | 'armor_attack'
  | 'armor_breakthrough'
  | 'army_speed'
  | 'army_org'
  | 'supply_consumption'
  | 'air_superiority'
  | 'ground_support'
  | 'submarine_raiding'
  | 'naval_firepower'
  | 'amphibious_bonus'
  | 'air_intercept';

export interface ModifierEntry {
  key: ModifierKey;
  value: number;
  labelZh: string;
}

export type NationModifiers = Record<ModifierKey, number>;

export const ALL_MODIFIER_KEYS: readonly ModifierKey[] = [
  'factory_output',
  'mil_output',
  'build_speed',
  'mil_build_speed',
  'synth_build_speed',
  'mastery_cap',
  'region_slots',
  'synth_oil_per_plant',
  'research_speed',
  'conscription_rate',
  'training_time',
  'cohesion_cap',
  'infantry_attack',
  'infantry_defense',
  'artillery_attack',
  'anti_tank_piercing',
  'armor_attack',
  'armor_breakthrough',
  'army_speed',
  'army_org',
  'supply_consumption',
  'air_superiority',
  'ground_support',
  'submarine_raiding',
  'naval_firepower',
  'amphibious_bonus',
  'air_intercept',
];

export function createEmptyModifiers(): NationModifiers {
  const out = {} as NationModifiers;
  for (const k of ALL_MODIFIER_KEYS) out[k] = 0;
  return out;
}

export function applyModifierList(target: NationModifiers, entries: readonly ModifierEntry[]): void {
  for (const e of entries) {
    target[e.key] = (target[e.key] + e.value) | 0;
  }
}

export function cloneModifiers(src: Readonly<NationModifiers>): NationModifiers {
  const out = {} as NationModifiers;
  for (const k of ALL_MODIFIER_KEYS) out[k] = src[k];
  return out;
}
