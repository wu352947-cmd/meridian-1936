import { describe, expect, it } from 'vitest';
import { dateStringToTick } from '../src/sim/core/ClockCalendar';
import { SimEngine } from '../src/sim/core/SimEngine';
import { getProvinceClimateZone } from '../src/sim/data/climateZones1936';
import { getCapitalProvince } from '../src/sim/data/provinces1936';
import { buildFrontlineOrder, computeFrontlineAssignments } from '../src/sim/systems/armyOrderSystem';
import { computeUnitCombatBreakdown } from '../src/sim/systems/combatMath';
import { createEmptyModifiers } from '../src/sim/systems/modifierTypes';
import {
  getAiArmorOffensiveWeightPermille,
  getAirSortieMultPermille,
  getNightAttackMultPermille,
  getProvinceSeasonCondition,
  getTheaterSeasonSummary,
  getWeatherCombatEffect,
  getWeatherMarchMultPermille,
  getWinterAttritionMultPermille,
} from '../src/sim/systems/weatherSystem';

describe('Batch 07 Seasonal Climate (Mud & Severe Winter), Night Combat & Supply-Aware AI', () => {
  const moscowId = getCapitalProvince('SOV')!.id;
  const warsawId = getCapitalProvince('POL')!.id;
  const helsinkiId = getCapitalProvince('FIN')!.id;
  const berlinId = getCapitalProvince('GER')!.id;
  const romeId = getCapitalProvince('ITA')!.id;

  it('1. maps climate zones and deterministic seasonal calendar (Apr & Oct 16-31 mud, Dec-Feb winter, Jul clear)', () => {
    expect(getProvinceClimateZone(moscowId)).toBe('east_continental');
    expect(getProvinceClimateZone(warsawId)).toBe('east_continental');
    expect(getProvinceClimateZone(helsinkiId)).toBe('nordic_subarctic');
    expect(getProvinceClimateZone(berlinId)).toBe('west_temperate');
    expect(getProvinceClimateZone(romeId)).toBe('med_arid');

    const jan15 = dateStringToTick('1936-01-15')!;
    const apr15 = dateStringToTick('1936-04-15')!;
    const jul15 = dateStringToTick('1936-07-15')!;
    const oct10 = dateStringToTick('1936-10-10')!;
    const oct20 = dateStringToTick('1936-10-20')!;
    const dec15 = dateStringToTick('1936-12-15')!;

    expect(getProvinceSeasonCondition(moscowId, jan15)).toBe('winter');
    expect(getProvinceSeasonCondition(moscowId, dec15)).toBe('winter');
    expect(getProvinceSeasonCondition(moscowId, apr15)).toBe('mud');
    expect(getProvinceSeasonCondition(moscowId, oct10)).toBe('normal');
    expect(getProvinceSeasonCondition(moscowId, oct20)).toBe('mud');
    expect(getProvinceSeasonCondition(moscowId, jul15)).toBe('normal');

    expect(getProvinceSeasonCondition(helsinkiId, jan15)).toBe('winter');
    expect(getProvinceSeasonCondition(helsinkiId, apr15)).toBe('normal');
    expect(getProvinceSeasonCondition(berlinId, jan15)).toBe('normal');
    expect(getProvinceSeasonCondition(romeId, dec15)).toBe('normal');

    const winterSummary = getTheaterSeasonSummary(dec15);
    expect(winterSummary.eastCondition).toBe('winter');
    expect(winterSummary.nextChangeDateIso).toBe('1937-03-01');
  });

  it('2. applies East mud (-40% march, -35% ARM/MOT atk) and severe winter (-25% atk, MTN exempt, FIN/SOV half offset, 2x attrition)', () => {
    const apr15 = dateStringToTick('1936-04-15')!;
    const jan15 = dateStringToTick('1936-01-15')!;
    const jul15 = dateStringToTick('1936-07-15')!;

    // East Europe April mud
    expect(getWeatherMarchMultPermille(warsawId, apr15)).toBe(600);
    expect(getWeatherMarchMultPermille(warsawId, jul15)).toBe(1000);
    expect(getWeatherCombatEffect(warsawId, 'GER', 'ARM', true, apr15).attackMultPermille).toBe(650);
    expect(getWeatherCombatEffect(warsawId, 'GER', 'MOT', true, apr15).attackMultPermille).toBe(650);
    expect(getWeatherCombatEffect(warsawId, 'GER', 'INF', true, apr15).attackMultPermille).toBe(1000);

    // East/Nordic January severe winter
    expect(getWeatherCombatEffect(moscowId, 'GER', 'INF', true, jan15).attackMultPermille).toBe(750); // -25%
    expect(getWeatherCombatEffect(moscowId, 'GER', 'MTN', true, jan15).attackMultPermille).toBe(1000); // MTN exempt!
    expect(getWeatherCombatEffect(moscowId, 'SOV', 'INF', true, jan15).attackMultPermille).toBe(875); // SOV -12.5%
    expect(getWeatherCombatEffect(helsinkiId, 'FIN', 'INF', true, jan15).attackMultPermille).toBe(875); // FIN -12.5%
    expect(getWeatherCombatEffect(moscowId, 'GER', 'INF', false, jan15).attackMultPermille).toBe(1000); // defender exempt

    // Winter attrition doubling & cold-resistant half offset
    expect(getWinterAttritionMultPermille(moscowId, 'GER', 'INF', jan15)).toBe(2000);
    expect(getWinterAttritionMultPermille(moscowId, 'SOV', 'INF', jan15)).toBe(1500);
    expect(getWinterAttritionMultPermille(helsinkiId, 'FIN', 'INF', jan15)).toBe(1500);
    expect(getWinterAttritionMultPermille(moscowId, 'GER', 'INF', jul15)).toBe(1000);
  });

  it('3. applies 18:00 Night Tick x0.75 land attack (both sides), x0.50 air hook, and live breakdown multipliers', () => {
    const dayTick = dateStringToTick('1936-07-15')!; // 00:00
    const nightTick = dayTick + 3;                    // 18:00

    expect(getNightAttackMultPermille(dayTick)).toBe(1000);
    expect(getNightAttackMultPermille(nightTick)).toBe(750);
    expect(getAirSortieMultPermille(dayTick)).toBe(1000);
    expect(getAirSortieMultPermille(nightTick)).toBe(500);

    const mods = createEmptyModifiers();
    const bdNight = computeUnitCombatBreakdown({
      brigadeId: 1, nameZh: '装甲1旅', template: 'ARM', strengthPermille: 1000,
      entrenchPermille: 0, planPermille: 0, isAttacking: true, terrain: 'plains',
      river: 'none', fortLevel: 0, hasAttackerArtillery: false, hasFrontlineCover: true,
      enemyMaxPiercing: 8, commanderId: null, nationMods: mods,
      supply: { multPermille: 700, supplyValue: 18, status: 'low', noteZh: 'S=18 · 缺粮 −30%' },
      weather: { multPermille: 650, labelZh: '东欧泥泞', noteZh: '东欧泥泞 · 装甲/摩步 −35%' },
      isNight: true,
    });
    const byKey = Object.fromEntries(bdNight.factors.map((f) => [f.key, f]));
    expect(byKey.supply!.enabled).toBe(true);
    expect(byKey.supply!.multPermille).toBe(700);
    expect(byKey.season!.enabled).toBe(true);
    expect(byKey.season!.multPermille).toBe(650);
    expect(byKey.night!.enabled).toBe(true);
    expect(byKey.night!.multPermille).toBe(750);
    expect(byKey.air!.enabled).toBe(false); // Reserved for Air batch
  });

  it('4. respects province supply cap in frontline AI and lowers armored offensive weight (x0.4) in mud/winter', () => {
    const apr15 = dateStringToTick('1936-04-15')!;
    const jan15 = dateStringToTick('1936-01-15')!;
    const jul15 = dateStringToTick('1936-07-15')!;
    expect(getAiArmorOffensiveWeightPermille(warsawId, apr15)).toBe(400);
    expect(getAiArmorOffensiveWeightPermille(moscowId, jan15)).toBe(400);
    expect(getAiArmorOffensiveWeightPermille(warsawId, jul15)).toBe(1000);

    // Frontline AI must stop stacking brigades into provinces whose supply cap is 1
    const eng = new SimEngine(19360708, 'POL');
    const army = eng.getArmySystemForTest();
    const polArmy = army.getArmiesFor('POL')[0]!;
    const fl = buildFrontlineOrder('POL', 'GER')!;
    const brigs = polArmy.brigadeIds.map((id) => army.getBrigade(id)!);
    expect(brigs.length).toBeGreaterThan(fl.friendlyProvIds.length);

    const assigned = computeFrontlineAssignments(fl, brigs, 'POL', undefined, () => 1);
    const counts = new Map<number, number>();
    for (const pid of assigned.values()) counts.set(pid, (counts.get(pid) ?? 0) + 1);
    for (const c of counts.values()) {
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});
