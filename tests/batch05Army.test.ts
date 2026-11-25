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
import { buildOpeningBrigadesForNation } from '../src/sim/data/openingArmies1936';
import {
  getCapitalProvince,
  getOwnerProvinces,
  getSimProvince,
  SIM_PROVINCES,
} from '../src/sim/data/provinces1936';
import { IndustrySystem } from '../src/sim/systems/industrySystem';
import {
  advanceTrainingOrdersDaily,
  calcTargetTrainDaysFixed,
  createTrainingOrder,
  MIN_DEPLOY_STRENGTH_PERMILLE,
  refundTrainingOrder,
} from '../src/sim/systems/trainingSystem';
import { calcEdgeMarchTicksFixed, findLandPath } from '../src/sim/systems/pathfinding';
import { ArmySystem } from '../src/sim/systems/armySystem';
import { buildFrontlineOrder } from '../src/sim/systems/armyOrderSystem';

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

  it('2. validates opening brigade spread and training queue deductions, equipment shortage ratio, and +10% extensive conscription duration', () => {
    // Opening brigades match profile.brigades and spread across multiple provinces (not all stacked in capital)
    for (const p of ALL_PLAYABLE_NATIONS_1936) {
      const plan = buildOpeningBrigadesForNation(p);
      expect(plan.length, `Opening count mismatch for ${p.tag}`).toBe(p.brigades);
      const uniqueProvs = new Set(plan.map((b) => b.provinceId));
      if (getOwnerProvinces(p.tag).length >= 6 && p.brigades >= 8) {
        expect(uniqueProvs.size, `${p.tag} brigades piled in too few provinces`).toBeGreaterThanOrEqual(4);
      }
    }

    // Verify training days: INF 35, ARM 60, +10% (extensive conscription) -> INF 38.5 (39d), ARM 66d
    expect(calcTargetTrainDaysFixed('INF', 0)).toBe(35_000);
    expect(calcTargetTrainDaysFixed('GAR', 0)).toBe(35_000);
    expect(calcTargetTrainDaysFixed('ARM', 0)).toBe(60_000);
    expect(calcTargetTrainDaysFixed('INF', 100)).toBe(38_500);
    expect(calcTargetTrainDaysFixed('ARM', 100)).toBe(66_000);

    const ind = new IndustrySystem();
    const coh = new Map(ALL_PLAYABLE_NATIONS_1936.map((n) => [n.tag, n.cohesion]));
    ind.reset(coh);

    let availMp = 500_000;
    const adapter = {
      getAvailableManpower: () => availMp,
      consumeEquipment: (tag: string, eq: 'INF_EQ' | 'ART_EQ' | 'MOT_EQ' | 'ARM_EQ' | 'AIR_TAC' | 'AIR_STR' | 'CONVOY', u: number) =>
        ind.consumeEquipment(tag, eq, u),
      refundEquipment: (tag: string, eq: 'INF_EQ' | 'ART_EQ' | 'MOT_EQ' | 'ARM_EQ' | 'AIR_TAC' | 'AIR_STR' | 'CONVOY', u: number) =>
        ind.refundEquipment(tag, eq, u),
    };

    const infBefore = ind.getStockpileUnits('GER', 'INF_EQ');
    const artBefore = ind.getStockpileUnits('GER', 'ART_EQ');
    const ordInf = createTrainingOrder(1, 'GER', 'INF', null, null, 0, adapter)!;
    expect(ordInf).not.toBeNull();
    availMp -= ordInf.manpowerAllocated;
    expect(ordInf.manpowerAllocated).toBe(10_000);
    expect(ind.getStockpileUnits('GER', 'INF_EQ')).toBe(infBefore - 100);
    expect(ind.getStockpileUnits('GER', 'ART_EQ')).toBe(artBefore - 10);
    expect(ordInf.equipmentRatioPermille).toBe(1000);

    // Drain ARM_EQ down to 25 (50% of ARM requirement of 50) -> training still allowed with 50% fill ratio
    const armStock = ind.getStockpileUnits('GER', 'ARM_EQ');
    if (armStock > 25) ind.consumeEquipment('GER', 'ARM_EQ', armStock - 25);
    const ordArm = createTrainingOrder(2, 'GER', 'ARM', null, null, 100, adapter)!;
    expect(ordArm).not.toBeNull();
    expect(ordArm.equipmentRatioPermille).toBe(500);
    expect(ordArm.shortageType).toBe('ARM_EQ');
    expect(Math.max(MIN_DEPLOY_STRENGTH_PERMILLE, ordArm.equipmentRatioPermille)).toBe(500);

    // Refund restores exact equipment taken
    const armAfterTake = ind.getStockpileUnits('GER', 'ARM_EQ');
    expect(armAfterTake).toBe(0);
    refundTrainingOrder(ordArm, adapter);
    expect(ind.getStockpileUnits('GER', 'ARM_EQ')).toBe(25);

    // Step 34 days: INF not done yet; day 35 completes INF
    let queue = [ordInf];
    for (let d = 0; d < 34; d++) {
      const res = advanceTrainingOrdersDaily(queue, () => 0);
      expect(res.completed.length).toBe(0);
      queue = res.remaining;
    }
    const day35 = advanceTrainingOrdersDaily(queue, () => 0);
    expect(day35.completed.length).toBe(1);
    expect(day35.completed[0]!.id).toBe(ordInf.id);
  });

  it('3. computes optimal land A* travel time with terrain multipliers and forbids entering non-hostile foreign territory', () => {
    const berlin = getCapitalProvince('GER')!;
    const warsaw = getCapitalProvince('POL')!;
    const breslau = getOwnerProvinces('GER').find((p) => p.nameZh === '布雷斯劳')!;
    expect(breslau).toBeDefined();

    // Friendly march Berlin -> Breslau succeeds; MOT (9.0) is strictly faster than INF (4.0)
    const infPath = findLandPath({
      startProvId: berlin.id,
      goalProvId: breslau.id,
      ownerTag: 'GER',
      speedTenth: BRIGADE_TEMPLATES.INF.speedTenth,
    });
    const motPath = findLandPath({
      startProvId: berlin.id,
      goalProvId: breslau.id,
      ownerTag: 'GER',
      speedTenth: BRIGADE_TEMPLATES.MOT.speedTenth,
    });
    expect(infPath).not.toBeNull();
    expect(motPath).not.toBeNull();
    expect(infPath!.path[infPath!.path.length - 1]).toBe(breslau.id);
    expect(motPath!.totalTicksFixed).toBeLessThan(infPath!.totalTicksFixed);
    // Every province on a peacetime path must belong to GER
    for (const pid of infPath!.path) {
      expect(getSimProvince(pid)!.owner).toBe('GER');
    }

    // Terrain speed multiplier check: mountain (0.45) > 2x slower than plains (1.00) at equal distance
    const fakeOrigin = { ...berlin, cx: 1000, cy: 1000 };
    const fakePlains = { ...berlin, cx: 1060, cy: 1000, terrain: 'plains' as const };
    const fakeForest = { ...berlin, cx: 1060, cy: 1000, terrain: 'forest' as const };
    const fakeMountain = { ...berlin, cx: 1060, cy: 1000, terrain: 'mountain' as const };
    const fakeMarsh = { ...berlin, cx: 1060, cy: 1000, terrain: 'marsh' as const };
    const tPlains = calcEdgeMarchTicksFixed(fakeOrigin, fakePlains, 40);
    const tForest = calcEdgeMarchTicksFixed(fakeOrigin, fakeForest, 40);
    const tMarsh = calcEdgeMarchTicksFixed(fakeOrigin, fakeMarsh, 40);
    const tMountain = calcEdgeMarchTicksFixed(fakeOrigin, fakeMountain, 40);
    expect(tPlains).toBeLessThan(tForest);
    expect(tForest).toBeLessThan(tMarsh);
    expect(tMarsh).toBeLessThan(tMountain);
    expect(tMountain).toBeGreaterThan(tPlains * 2);

    // Non-hostile foreign territory (GER -> Warsaw without war) is strictly forbidden
    const forbidden = findLandPath({
      startProvId: berlin.id,
      goalProvId: warsaw.id,
      ownerTag: 'GER',
      speedTenth: 40,
    });
    expect(forbidden).toBeNull();

    // East Prussia (e.g. Allenstein) is unreachable by land from Berlin across neutral POL/DNZ!
    const allenstein = getOwnerProvinces('GER').find((p) => p.nameZh === '阿伦施泰因')!;
    expect(
      findLandPath({ startProvId: berlin.id, goalProvId: allenstein.id, ownerTag: 'GER', speedTenth: 40 }),
    ).toBeNull();

    // Only when POL is explicitly in hostileTags does A* allow crossing into Warsaw
    const wartime = findLandPath({
      startProvId: berlin.id,
      goalProvId: warsaw.id,
      ownerTag: 'GER',
      speedTenth: 40,
      hostileTags: new Set(['POL']),
    });
    expect(wartime).not.toBeNull();
    expect(wartime!.path[wartime!.path.length - 1]).toBe(warsaw.id);
  });

  it('4. extracts continuous frontline chains and evenly spreads army brigades along the border with zero gaps', () => {
    // POL -> GER border is a single contiguous frontier of 8 Polish border provinces
    const polFront = buildFrontlineOrder('POL', 'GER')!;
    expect(polFront).not.toBeNull();
    expect(polFront.friendlyProvIds.length).toBeGreaterThanOrEqual(6);
    // Check chain ordering: consecutive provinces along each component share adjacency (at most 1 component break)
    let jumps = 0;
    for (let i = 1; i < polFront.friendlyProvIds.length; i++) {
      const prev = getSimProvince(polFront.friendlyProvIds[i - 1]!)!;
      if (!prev.neighbors.includes(polFront.friendlyProvIds[i]!)) jumps += 1;
    }
    expect(jumps).toBeLessThanOrEqual(1);

    // Bind POL 1st Army (11 brigades >= 8 border provs) -> step until arrival -> EVERY border province covered!
    const sys = new ArmySystem();
    sys.reset();
    const polArmy = sys.getArmiesFor('POL')[0]!;
    expect(polArmy.brigadeIds.length).toBeGreaterThanOrEqual(polFront.friendlyProvIds.length);
    expect(sys.bindFrontline('POL', polArmy.id, 'GER', 0)).toBe(true);
    for (let t = 0; t < 80; t++) sys.stepTick(() => 0);

    const occupied = new Set(polArmy.brigadeIds.map((id) => sys.getBrigade(id)!.provinceId));
    for (const fpid of polFront.friendlyProvIds) {
      expect(occupied.has(fpid), `Gap left on POL frontline province ${fpid}`).toBe(true);
    }

    // Check demoFrontline=GER_POL leaves zero gaps across ALL GER-POL border provinces and stores Warsaw arrow
    const demo = new ArmySystem();
    demo.reset();
    demo.applyDemoFrontline('GER_POL');
    const ger1 = demo.getArmiesFor('GER')[0]!;
    expect(ger1.frontline?.targetTag).toBe('POL');
    expect(ger1.arrow?.targetProvId).toBe(getCapitalProvince('POL')!.id);
    const ger1Occupied = new Set(ger1.brigadeIds.map((id) => demo.getBrigade(id)!.provinceId));
    for (const fpid of ger1.frontline!.friendlyProvIds) {
      expect(ger1Occupied.has(fpid), `Gap left on GER demo frontline province ${fpid}`).toBe(true);
    }
  });

  it('5. protects manualOverride brigades from army frontline AI until arrival at destination', () => {
    const sys = new ArmySystem();
    sys.reset();
    const polArmy = sys.getArmiesFor('POL')[0]!;
    sys.bindFrontline('POL', polArmy.id, 'GER', 0);
    for (let t = 0; t < 60; t++) sys.stepTick(() => 0);

    const lockedId = polArmy.brigadeIds[0]!;
    const locked = sys.getBrigade(lockedId)!;
    // Order this single brigade to march away from the German border to an interior/eastern Polish province (Warsaw or east)
    const polProvs = getOwnerProvinces('POL');
    const frontSet = new Set(polArmy.frontline!.friendlyProvIds);
    const rearProv = polProvs.find((p) => !frontSet.has(p.id) && p.id !== locked.provinceId)!;
    expect(rearProv).toBeDefined();

    expect(sys.marchBrigades('POL', [lockedId], rearProv.id, 0)).toBe(1);
    expect(locked.manualOverride).toBe(true);
    expect(locked.moveTargetProvId).toBe(rearProv.id);

    // Step tick-by-tick: while en route, army frontline AI runs every tick and MUST NOT hijack locked brigade
    let arrived = false;
    for (let t = 0; t < 120; t++) {
      sys.stepTick(() => 0);
      if (locked.provinceId === rearProv.id) {
        arrived = true;
        break;
      }
      expect(locked.manualOverride).toBe(true);
      expect(locked.moveTargetProvId).toBe(rearProv.id);
    }
    expect(arrived).toBe(true);
    // Once arrived, manualOverride clears cleanly so army AI may resume control on subsequent ticks
    expect(locked.manualOverride).toBe(false);
  });
});
