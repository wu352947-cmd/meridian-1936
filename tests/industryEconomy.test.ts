import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../src/sim/core/ClockCalendar';
import { SimEngine } from '../src/sim/core/SimEngine';
import { ALL_PLAYABLE_NATIONS_1936 } from '../src/sim/data/nations1936';
import { REGIONS_1936 } from '../src/sim/data/regions1936';
import {
  calcConsumerGoodsCiv,
  calcLineDailyUnitsFixed,
  calcLineResourceMultPermille,
  calcResourceCoveragePermille,
  stepMasteryMicro,
} from '../src/sim/systems/industryMath';
import {
  EQUIPMENT_SPECS,
  MASTERY_INIT_MICRO,
  MASTERY_MAX_INIT_MICRO,
} from '../src/sim/systems/industryTypes';

describe('Batch 03 Industry, Production Mastery, Construction & Auto-Trade', () => {
  it('1. converges production mastery from 30% over 90 days according to deltaE = 0.012*(Emax-E)/Emax', () => {
    let eMicro = MASTERY_INIT_MICRO;
    let eFloat = 0.30;
    const eMax = 0.75;

    for (let day = 0; day < 90; day++) {
      eMicro = stepMasteryMicro(eMicro, MASTERY_MAX_INIT_MICRO);
      eFloat += 0.012 * ((eMax - eFloat) / eMax);
    }

    // Exact analytic recursion at 90 days is ~64.46%, tightly matching fixed-point micro recursion
    expect(Math.abs(eMicro / 1_000_000 - eFloat)).toBeLessThan(0.001);
    expect(eMicro).toBeGreaterThan(640_000);
    expect(eMicro).toBeLessThanOrEqual(MASTERY_MAX_INIT_MICRO);

    // Continued production converges monotonically to ~75% without stalling or overshooting
    for (let day = 90; day < 300; day++) {
      eMicro = stepMasteryMicro(eMicro, MASTERY_MAX_INIT_MICRO);
    }
    expect(eMicro).toBeGreaterThan(745_000);
    expect(eMicro).toBeLessThanOrEqual(MASTERY_MAX_INIT_MICRO);

    // Also verify end-to-end inside SimEngine over 90 days (360 ticks)
    const eng = new SimEngine(19360101, 'GER');
    const startLine = eng.getIndustrySnapshot('GER').lines.find((l) => l.type === 'INF_EQ')!;
    expect(startLine.masteryPermille).toBe(300);

    eng.stepMany(90 * TICKS_PER_DAY);
    const endLine = eng.getIndustrySnapshot('GER').lines.find((l) => l.type === 'INF_EQ')!;
    expect(Math.abs(endLine.masteryPermille - Math.round(eFloat * 1000))).toBeLessThanOrEqual(2);
    expect(endLine.stockpileFixed).toBeGreaterThan(startLine.stockpileFixed);
  });

  it('2. applies exact -40% output penalty (5 x 8%) at 50% steel shortage and caps worst penalty at -80%', () => {
    const infSpec = EQUIPMENT_SPECS.INF_EQ;
    const cov50 = calcResourceCoveragePermille(5, 10);
    expect(cov50).toBe(500);

    const mult50 = calcLineResourceMultPermille(infSpec, cov50, 1000, 1000);
    expect(mult50).toBe(600); // exact -40% penalty

    const fullOut = calcLineDailyUnitsFixed(infSpec, 10, 500_000, 500, 1000, 1000);
    const shortOut = calcLineDailyUnitsFixed(infSpec, 10, 500_000, 500, 1000, mult50);
    expect(fullOut).toBe(45_000); // 10 * 4.5 * 0.5 / 0.5 = 45.000 units/day
    expect(shortOut).toBe(27_000); // exact 60% of 45.000 = 27.000 units/day

    // 100% shortage never stalls to 0: capped at -80% (20% floor)
    const mult0 = calcLineResourceMultPermille(infSpec, 0, 1000, 1000);
    expect(mult0).toBe(200);
    const minOut = calcLineDailyUnitsFixed(infSpec, 10, 500_000, 500, 1000, mult0);
    expect(minOut).toBe(9_000);
  });

  it('3. conserves total CIV with 35% consumer goods rounding (total = consumer + build + trade + idle)', () => {
    for (let total = 0; total <= 60; total++) {
      const cg = calcConsumerGoodsCiv(total, 350);
      expect(cg).toBe(Math.round(total * 0.35));
      expect(cg).toBeGreaterThanOrEqual(0);
      expect(cg).toBeLessThanOrEqual(total);
    }

    const eng = new SimEngine(19360101, 'GER');
    // Queue 2 projects for Germany so construction + trade + consumer goods + idle all participate
    eng.applyImmediate({ tick: 0, actorTag: 'GER', type: 'QUEUE_CONSTRUCTION', payload: { regionId: 4, building: 'MIL' } });
    eng.applyImmediate({ tick: 0, actorTag: 'GER', type: 'QUEUE_CONSTRUCTION', payload: { regionId: 1, building: 'CIV' } });

    for (const profile of ALL_PLAYABLE_NATIONS_1936) {
      const ind = eng.getIndustrySnapshot(profile.tag);
      expect(ind.consumerGoodsPermille).toBe(350);
      expect(ind.civConsumer).toBe(Math.round(ind.civTotal * 0.35));
      expect(ind.civConsumer + ind.civBuild + ind.civTrade + ind.civIdle).toBe(ind.civTotal);
    }

    // Verify GER specific opening oil shortage triggers auto-trade import from Romania
    const gerInd = eng.getIndustrySnapshot('GER');
    expect(gerInd.resources.steel.prod).toBe(95);
    expect(gerInd.resources.oil.prod).toBe(6);
    expect(gerInd.resources.oil.demand).toBeGreaterThan(gerInd.resources.oil.prod);
    expect(gerInd.resources.oil.imported).toBeGreaterThan(0);
    expect(gerInd.civTrade).toBeGreaterThan(0);
    expect(gerInd.deals.some((d) => d.importerTag === 'GER' && d.exporterTag === 'ROM' && d.resource === 'oil')).toBe(true);
  });

  it('4. resets mastery to 30% when switching a production line', () => {
    const eng = new SimEngine(19360101, 'GER');
    eng.stepMany(50 * TICKS_PER_DAY);

    const before = eng.getIndustrySnapshot('GER');
    const armBefore = before.lines.find((l) => l.type === 'ARM_EQ')!;
    const infBefore = before.lines.find((l) => l.type === 'INF_EQ')!;
    expect(armBefore.masteryPermille).toBeGreaterThan(500);
    expect(infBefore.factories).toBeGreaterThan(0);

    eng.applyImmediate({
      tick: eng.tick,
      actorTag: 'GER',
      type: 'SWITCH_PRODUCTION_LINE',
      payload: { fromType: 'INF_EQ', toType: 'ARM_EQ', count: 3 },
    });

    const after = eng.getIndustrySnapshot('GER');
    const armAfter = after.lines.find((l) => l.type === 'ARM_EQ')!;
    const infAfter = after.lines.find((l) => l.type === 'INF_EQ')!;
    expect(infAfter.factories).toBe(infBefore.factories - 3);
    expect(armAfter.factories).toBe(armBefore.factories + 3);
    expect(armAfter.masteryPermille).toBe(300); // reset to 30%
  });

  it('5. produces identical state hash across two seeded runs with construction, production & trade commands', () => {
    const runScenario = () => {
      const eng = new SimEngine(19360101, 'GER');
      eng.applyImmediate({ tick: 0, actorTag: 'GER', type: 'QUEUE_CONSTRUCTION', payload: { regionId: 4, building: 'MIL' } });
      eng.applyImmediate({ tick: 0, actorTag: 'GER', type: 'QUEUE_CONSTRUCTION', payload: { regionId: 1, building: 'SYNTH' } });
      eng.applyImmediate({ tick: 0, actorTag: 'GER', type: 'SET_LINE_FACTORIES', payload: { eqType: 'AIR_STR', factories: 1 } });
      eng.applyImmediate({ tick: 0, actorTag: 'GER', type: 'SET_LINE_FACTORIES', payload: { eqType: 'ARM_EQ', factories: 6 } });
      eng.stepMany(40 * TICKS_PER_DAY); // completes the MIL in Ruhr (~25 days at infra 5!)
      eng.applyImmediate({ tick: eng.tick, actorTag: 'GER', type: 'TOGGLE_AUTO_TRADE', payload: { enabled: false } });
      eng.stepMany(15 * TICKS_PER_DAY);
      return {
        hash: eng.computeStateHashHex(),
        ind: eng.getIndustrySnapshot('GER'),
        snap: eng.getSnapshot(),
      };
    };

    const a = runScenario();
    const b = runScenario();
    expect(a.hash).toBe(b.hash);
    expect(a.ind).toEqual(b.ind);
    expect(a.ind.milTotal).toBe(27); // 26 opening + 1 newly constructed MIL in Ruhr
    expect(a.ind.autoTrade).toBe(false);
    expect(a.ind.resources.oil.net).toBeLessThan(0); // GER oil deficit visible when auto-trade is off
  });

  it('matches exact opening CIV/MIL/DOC totals from nations1936*.ts across all 31 playable nations and 100-155 regions', () => {
    expect(REGIONS_1936.length).toBeGreaterThanOrEqual(100);
    expect(REGIONS_1936.length).toBeLessThanOrEqual(155);

    for (const p of ALL_PLAYABLE_NATIONS_1936) {
      const own = REGIONS_1936.filter((r) => r.owner === p.tag);
      expect(own.length, `Missing regions for ${p.tag}`).toBeGreaterThan(0);
      const civ = own.reduce((s, r) => s + r.civ, 0);
      const mil = own.reduce((s, r) => s + r.mil, 0);
      const doc = own.reduce((s, r) => s + r.doc, 0);
      expect(civ, `CIV mismatch for ${p.tag}`).toBe(p.civ);
      expect(mil, `MIL mismatch for ${p.tag}`).toBe(p.mil);
      expect(doc, `DOC mismatch for ${p.tag}`).toBe(p.doc);
    }
  });
});
