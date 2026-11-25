import { describe, expect, it } from 'vitest';
import { SimEngine } from '../src/sim/core/SimEngine';
import { BRIGADE_TEMPLATES, getCombatSlotsForBattle } from '../src/sim/data/brigadeTemplates';
import { calcTickHitDamage, computeUnitCombatBreakdown, partitionCombatSlots } from '../src/sim/systems/combatMath';
import { createEmptyModifiers } from '../src/sim/systems/modifierTypes';

describe('Batch 06 Land Combat Determinism, Slots, Modifiers & Armor Suppression', () => {
  it('1. guarantees bit-exact determinism with same seed and diverges with different seed', () => {
    const run = (seed: number) => {
      const eng = new SimEngine(seed, 'GER');
      eng.resetScenario({ scenarioId: '1936', countryTag: 'GER', seed, mockWar: 'GER_POL', paused: true });
      eng.stepMany(20);
      return {
        hash: eng.computeStateHashHex(),
        combat: eng.getCombatSnapshot(),
        gerCas: eng.getGovernanceSnapshot('GER').manpower.casualties,
        polCas: eng.getGovernanceSnapshot('POL').manpower.casualties,
      };
    };

    const a = run(19390901);
    const b = run(19390901);
    const c = run(19400510);

    expect(a.hash).toBe(b.hash);
    expect(a.gerCas).toBe(b.gerCas);
    expect(a.polCas).toBe(b.polCas);
    expect(a.gerCas + a.polCas).toBeGreaterThan(0);
    expect(a.hash).not.toBe(c.hash);
  });

  it('2. computes exact combat slots for single-axis, 3-way flanking, mountain/marsh, and urban battles', () => {
    expect(getCombatSlotsForBattle('plains', 1)).toEqual({ frontline: 4, support: 2 });
    expect(getCombatSlotsForBattle('plains', 3)).toEqual({ frontline: 8, support: 4 });
    expect(getCombatSlotsForBattle('mountain', 1)).toEqual({ frontline: 3, support: 1 });
    expect(getCombatSlotsForBattle('marsh', 1)).toEqual({ frontline: 3, support: 1 });
    expect(getCombatSlotsForBattle('urban', 1)).toEqual({ frontline: 5, support: 2 });
    expect(getCombatSlotsForBattle('mountain', 3)).toEqual({ frontline: 7, support: 3 });

    const roles: Record<number, 'frontline' | 'support'> = {
      1: 'frontline', 2: 'frontline', 3: 'frontline', 4: 'frontline', 5: 'frontline',
      6: 'support', 7: 'support', 8: 'support',
    };
    const part = partitionCombatSlots([8, 3, 1, 6, 2, 5, 4, 7], (id) => roles[id]!, 4, 2);
    expect(part.frontline).toEqual([1, 2, 3, 4]);
    expect(part.support).toEqual([6, 7]);
    expect(part.reserves).toEqual([5, 8]);
  });

  it('3. halves exposed ART defense when fighting without frontline cover', () => {
    const mods = createEmptyModifiers();
    const covered = computeUnitCombatBreakdown({
      brigadeId: 10, nameZh: '第1重炮旅', template: 'ART', strengthPermille: 1000,
      entrenchPermille: 0, planPermille: 0, isAttacking: false, terrain: 'plains',
      river: 'none', fortLevel: 0, hasAttackerArtillery: false, hasFrontlineCover: true,
      enemyMaxPiercing: 8, commanderId: null, nationMods: mods,
    });
    const exposed = computeUnitCombatBreakdown({
      brigadeId: 10, nameZh: '第1重炮旅', template: 'ART', strengthPermille: 1000,
      entrenchPermille: 0, planPermille: 0, isAttacking: false, terrain: 'plains',
      river: 'none', fortLevel: 0, hasAttackerArtillery: false, hasFrontlineCover: false,
      enemyMaxPiercing: 8, commanderId: null, nationMods: mods,
    });

    expect(covered.exposedArtPenalty).toBe(false);
    expect(exposed.exposedArtPenalty).toBe(true);
    expect(exposed.effGuardFixed).toBe(Math.floor(covered.effGuardFixed / 2));
  });

  it('4. toggles armor suppression (Arm > Prc: x0.60 Org taken, x1.35 Org dealt) vs pierced (Arm <= Prc)', () => {
    const mods = createEmptyModifiers();
    const unpierced = computeUnitCombatBreakdown({
      brigadeId: 1, nameZh: '装甲1旅', template: 'ARM', strengthPermille: 1000,
      entrenchPermille: 0, planPermille: 0, isAttacking: true, terrain: 'plains',
      river: 'none', fortLevel: 0, hasAttackerArtillery: false, hasFrontlineCover: true,
      enemyMaxPiercing: 8, commanderId: null, nationMods: mods,
    });
    const pierced = computeUnitCombatBreakdown({
      brigadeId: 1, nameZh: '装甲1旅', template: 'ARM', strengthPermille: 1000,
      entrenchPermille: 0, planPermille: 0, isAttacking: true, terrain: 'plains',
      river: 'none', fortLevel: 0, hasAttackerArtillery: false, hasFrontlineCover: true,
      enemyMaxPiercing: 45, commanderId: null, nationMods: mods,
    });

    expect(unpierced.armorAdvantage).toBe(true);
    expect(pierced.armorAdvantage).toBe(false);

    const dealAdv = calcTickHitDamage(40_000, 20_000, true, false, BRIGADE_TEMPLATES.INF.maxOrg);
    const dealFlat = calcTickHitDamage(40_000, 20_000, false, false, BRIGADE_TEMPLATES.INF.maxOrg);
    expect(dealAdv.orgLossPermille).toBeGreaterThan(dealFlat.orgLossPermille);
    expect(dealAdv.orgLossPermille / dealFlat.orgLossPermille).toBeCloseTo(1.35, 1);

    const takeAdv = calcTickHitDamage(20_000, 20_000, false, true, BRIGADE_TEMPLATES.ARM.maxOrg);
    const takeFlat = calcTickHitDamage(20_000, 20_000, false, false, BRIGADE_TEMPLATES.ARM.maxOrg);
    expect(takeAdv.orgLossPermille).toBeLessThan(takeFlat.orgLossPermille);
    expect(takeAdv.orgLossPermille / takeFlat.orgLossPermille).toBeCloseTo(0.6, 1);
  });

  it('5. applies mountain, major river, fort/ART negation, and marks disabled supply/air/night factors', () => {
    const mods = createEmptyModifiers();
    const armMtnRiver = computeUnitCombatBreakdown({
      brigadeId: 2, nameZh: '装甲旅', template: 'ARM', strengthPermille: 1000,
      entrenchPermille: 0, planPermille: 0, isAttacking: true, terrain: 'mountain',
      river: 'major', fortLevel: 0, hasAttackerArtillery: false, hasFrontlineCover: true,
      enemyMaxPiercing: 8, commanderId: null, nationMods: mods,
    });
    const mtnMtnRiver = computeUnitCombatBreakdown({
      brigadeId: 3, nameZh: '山地旅', template: 'MTN', strengthPermille: 1000,
      entrenchPermille: 0, planPermille: 0, isAttacking: true, terrain: 'mountain',
      river: 'major', fortLevel: 0, hasAttackerArtillery: false, hasFrontlineCover: true,
      enemyMaxPiercing: 8, commanderId: null, nationMods: mods,
    });

    const fMap = (bd: typeof armMtnRiver) => Object.fromEntries(bd.factors.map((f) => [f.key, f]));
    expect(fMap(armMtnRiver).terrain!.multPermille).toBe(300); // -70%
    expect(fMap(armMtnRiver).river!.multPermille).toBe(550);   // -45%
    expect(fMap(mtnMtnRiver).terrain!.multPermille).toBe(850); // -15%
    expect(fMap(mtnMtnRiver).river!.multPermille).toBe(700);   // -30%

    // Disabled Batch 07/10 factors pinned to 1.00 and flagged disabled
    for (const k of ['supply', 'air', 'night']) {
      expect(fMap(armMtnRiver)[k]!.multPermille).toBe(1000);
      expect(fMap(armMtnRiver)[k]!.enabled).toBe(false);
    }

    // Fort level 4: -56% without ART -> -28% with ART support (-2 levels negated)
    const noArtFort = computeUnitCombatBreakdown({
      brigadeId: 4, nameZh: '步兵旅', template: 'INF', strengthPermille: 1000,
      entrenchPermille: 0, planPermille: 0, isAttacking: true, terrain: 'plains',
      river: 'none', fortLevel: 4, hasAttackerArtillery: false, hasFrontlineCover: true,
      enemyMaxPiercing: 8, commanderId: null, nationMods: mods,
    });
    const withArtFort = computeUnitCombatBreakdown({
      brigadeId: 4, nameZh: '步兵旅', template: 'INF', strengthPermille: 1000,
      entrenchPermille: 0, planPermille: 0, isAttacking: true, terrain: 'plains',
      river: 'none', fortLevel: 4, hasAttackerArtillery: true, hasFrontlineCover: true,
      enemyMaxPiercing: 8, commanderId: null, nationMods: mods,
    });
    expect(fMap(noArtFort).fort!.multPermille).toBe(440);
    expect(fMap(withArtFort).fort!.multPermille).toBe(720);
  });
});
