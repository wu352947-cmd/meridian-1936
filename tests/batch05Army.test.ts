import { describe, expect, it } from 'vitest';
import {
  BRIGADE_TEMPLATES,
  BRIGADE_TYPE_ORDER,
  COMBAT_SLOT_RULES,
  getCombatSlotsForBattle,
  MAX_ARMY_BRIGADES,
  TERRAIN_MARCH_MULT_PERMILLE,
} from '../src/sim/data/brigadeTemplates';
import { ALL_PLAYABLE_NATIONS_1936 } from '../src/sim/data/nations1936';
import {
  getCapitalProvince,
  getOwnerProvinces,
  getSimProvince,
  SIM_PROVINCES,
} from '../src/sim/data/provinces1936';

describe('Batch 05 Land Brigades, Training, A* Marching, Frontlines & Orders', () => {
  it('1. validates 6 fixed brigade templates schema/stats and combat slot constants (4+2, 3+1, 5+2, flanking +2/+1)', () => {
    expect(BRIGADE_TYPE_ORDER).toEqual(['INF', 'MTN', 'MOT', 'ARM', 'ART', 'GAR']);

    const inf = BRIGADE_TEMPLATES.INF;
    expect(inf).toMatchObject({
      role: 'frontline', manpower: 10_000, maxOrg: 65, attack: 18, defense: 32,
      breakthrough: 12, armor: 0, piercing: 8, speed: 4.0, baseTrainDays: 35,
    });
    expect(inf.equipment).toEqual([{ type: 'INF_EQ', amount: 100 }, { type: 'ART_EQ', amount: 10 }]);

    const mtn = BRIGADE_TEMPLATES.MTN;
    expect(mtn).toMatchObject({
      role: 'frontline', manpower: 10_000, maxOrg: 75, attack: 20, defense: 30,
      breakthrough: 16, armor: 0, piercing: 8, speed: 4.5, baseTrainDays: 45,
    });
    expect(mtn.equipment).toEqual([{ type: 'INF_EQ', amount: 120 }, { type: 'ART_EQ', amount: 15 }]);

    const mot = BRIGADE_TEMPLATES.MOT;
    expect(mot).toMatchObject({
      role: 'frontline', manpower: 10_000, maxOrg: 60, attack: 22, defense: 34,
      breakthrough: 18, armor: 5, piercing: 10, speed: 9.0, baseTrainDays: 45,
    });
    expect(mot.equipment).toEqual([
      { type: 'INF_EQ', amount: 100 },
      { type: 'MOT_EQ', amount: 35 },
      { type: 'ART_EQ', amount: 10 },
    ]);

    const arm = BRIGADE_TEMPLATES.ARM;
    expect(arm).toMatchObject({
      role: 'frontline', manpower: 8_000, maxOrg: 45, attack: 38, defense: 20,
      breakthrough: 42, armor: 45, piercing: 40, speed: 8.0, baseTrainDays: 60,
    });
    expect(arm.equipment).toEqual([
      { type: 'INF_EQ', amount: 40 },
      { type: 'MOT_EQ', amount: 20 },
      { type: 'ARM_EQ', amount: 50 },
    ]);

    const art = BRIGADE_TEMPLATES.ART;
    expect(art).toMatchObject({
      role: 'support', manpower: 6_000, maxOrg: 30, attack: 44, defense: 12,
      breakthrough: 20, armor: 0, piercing: 18, speed: 4.0, baseTrainDays: 45,
    });
    expect(art.equipment).toEqual([{ type: 'INF_EQ', amount: 30 }, { type: 'ART_EQ', amount: 45 }]);

    const gar = BRIGADE_TEMPLATES.GAR;
    expect(gar).toMatchObject({
      role: 'frontline', manpower: 6_000, maxOrg: 45, attack: 10, defense: 20,
      breakthrough: 5, armor: 0, piercing: 4, speed: 3.0, baseTrainDays: 35,
    });
    expect(gar.equipment).toEqual([{ type: 'INF_EQ', amount: 60 }]);

    // Combat slot rules: base 4+2, mountain/marsh 3+1, urban 5+2, flanking +2/+1 per extra direction
    expect(COMBAT_SLOT_RULES.base).toEqual({ frontline: 4, support: 2 });
    expect(COMBAT_SLOT_RULES.narrowTerrains).toEqual({ frontline: 3, support: 1 });
    expect(COMBAT_SLOT_RULES.urban).toEqual({ frontline: 5, support: 2 });
    expect(COMBAT_SLOT_RULES.flankingBonusPerDirection).toEqual({ frontline: 2, support: 1 });

    expect(getCombatSlotsForBattle('plains', 1)).toEqual({ frontline: 4, support: 2 });
    expect(getCombatSlotsForBattle('mountain', 1)).toEqual({ frontline: 3, support: 1 });
    expect(getCombatSlotsForBattle('marsh', 1)).toEqual({ frontline: 3, support: 1 });
    expect(getCombatSlotsForBattle('urban', 1)).toEqual({ frontline: 5, support: 2 });
    expect(getCombatSlotsForBattle('plains', 3)).toEqual({ frontline: 8, support: 4 });
    expect(getCombatSlotsForBattle('mountain', 2)).toEqual({ frontline: 5, support: 2 });

    // Terrain march speed multipliers & army cap
    expect(TERRAIN_MARCH_MULT_PERMILLE).toEqual({
      plains: 1000, forest: 750, hills: 750, mountain: 450, marsh: 500, urban: 900, desert: 850,
    });
    expect(MAX_ARMY_BRIGADES).toBe(16);

    // Sim land province graph covers all 31 playable nations with symmetric land neighbors
    expect(SIM_PROVINCES.length).toBeGreaterThan(600);
    for (const n of ALL_PLAYABLE_NATIONS_1936) {
      expect(getOwnerProvinces(n.tag).length, `No land provinces for ${n.tag}`).toBeGreaterThan(0);
      expect(getCapitalProvince(n.tag), `No capital fallback for ${n.tag}`).not.toBeNull();
    }
    const berlin = getCapitalProvince('GER')!;
    expect(berlin.nameZh).toBe('柏林');
    expect(getSimProvince(berlin.id)?.neighbors.length).toBeGreaterThan(0);
  });
});
