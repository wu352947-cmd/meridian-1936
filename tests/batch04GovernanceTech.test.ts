import { describe, expect, it } from 'vitest';
import { dateStringToTick, formatDateIso, TICKS_PER_DAY } from '../src/sim/core/ClockCalendar';
import { SimEngine } from '../src/sim/core/SimEngine';
import { getTechNode, TECH_NODES } from '../src/sim/data/techTree1936';
import {
  calcTechActualDaysFixed,
  calcTechAheadPenaltyPermille,
  calcTechDailyProgressMicro,
} from '../src/sim/systems/techTypes';

describe('Batch 04 Manpower, Governance Laws & Cyanotype Tech Tree', () => {
  it('1. validates 36 tech nodes form an acyclic DAG with legal prerequisites and symmetric mutually exclusive doctrines', () => {
    expect(TECH_NODES.length).toBe(36);
    const byBranch = new Map<string, number>();
    const byId = new Map(TECH_NODES.map((n) => [n.id, n]));
    expect(byId.size).toBe(36);

    for (const node of TECH_NODES) {
      byBranch.set(node.branch, (byBranch.get(node.branch) ?? 0) + 1);
      expect(node.baseDays).toBeGreaterThanOrEqual(75);
      expect(node.baseDays).toBeLessThanOrEqual(135);
      expect(node.modifiers.length).toBeGreaterThan(0);

      for (const pre of node.prerequisites) {
        expect(byId.has(pre), `Missing prereq ${pre} for ${node.id}`).toBe(true);
        expect(pre).not.toBe(node.id);
      }
      for (const ex of node.mutuallyExclusive) {
        const peer = byId.get(ex);
        expect(peer, `Missing mutual exclusion peer ${ex}`).toBeDefined();
        expect(peer!.mutuallyExclusive).toContain(node.id);
      }
    }

    expect(byBranch.get('infantry_artillery')).toBe(9);
    expect(byBranch.get('armor_doctrine')).toBe(9);
    expect(byBranch.get('air_navy_radar')).toBe(10);
    expect(byBranch.get('industry_chem')).toBe(8);

    // Topological sort (Kahn) proves strict acyclicity
    const indeg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const n of TECH_NODES) {
      indeg.set(n.id, n.prerequisites.length);
      for (const pre of n.prerequisites) {
        const list = adj.get(pre) ?? [];
        list.push(n.id);
        adj.set(pre, list);
      }
    }
    const q = TECH_NODES.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
    let visited = 0;
    while (q.length > 0) {
      const cur = q.shift()!;
      visited += 1;
      for (const nxt of adj.get(cur) ?? []) {
        const nextDeg = (indeg.get(nxt) ?? 1) - 1;
        indeg.set(nxt, nextDeg);
        if (nextDeg === 0) q.push(nxt);
      }
    }
    expect(visited).toBe(36);

    // Mutually exclusive land doctrine chain blocks rival doctrines once started
    const eng = new SimEngine(19360101, 'GER');
    eng.applyImmediate({ tick: 0, actorTag: 'GER', type: 'START_RESEARCH', payload: { techId: 'doctrine_mobile' } });
    eng.applyImmediate({ tick: 0, actorTag: 'GER', type: 'START_RESEARCH', payload: { techId: 'doctrine_firepower' } });
    eng.applyImmediate({ tick: 0, actorTag: 'GER', type: 'START_RESEARCH', payload: { techId: 'doctrine_deep_battle' } });
    const activeIds = eng.getTechSnapshot('GER').slots.map((s) => s.techId).filter(Boolean);
    expect(activeIds).toEqual(['doctrine_mobile']);
  });

  it('2. applies exact +300% ahead-of-time penalty for 1939 tank in 1936 and recalculates rate on New Year (Jan 1, 1937)', () => {
    const tank = getTechNode('medium_tank_1939')!;
    expect(tank.year).toBe(1939);
    expect(tank.baseDays).toBe(100);

    // Pure formula check: 1936 -> 1939 is 3 years ahead = +300% (4x duration)
    expect(calcTechAheadPenaltyPermille(1939, 1936)).toBe(3000);
    expect(calcTechActualDaysFixed(100, 1939, 1936, 0)).toBe(400_000);
    expect(calcTechDailyProgressMicro(100, 1939, 1936, 0)).toBe(2500);
    // On Jan 1, 1937: 2 years ahead = +200% (3x duration)
    expect(calcTechAheadPenaltyPermille(1939, 1937)).toBe(2000);
    expect(calcTechActualDaysFixed(100, 1939, 1937, 0)).toBe(300_000);

    // End-to-end inside SimEngine: GER starts on 1936-12-20 with 0% research bonus (wartime_embargo)
    const eng = new SimEngine(19360101, 'GER');
    eng.resetScenario({
      scenarioId: '1936',
      countryTag: 'GER',
      seed: 19360101,
      playerAp: 200,
      initialLaws: [{ slot: 'trade', lawId: 'wartime_embargo' }],
      startDate: '1936-12-20',
    });
    eng.applyImmediate({ tick: eng.tick, actorTag: 'GER', type: 'START_RESEARCH', payload: { techId: 'medium_tank_1939' } });

    const beforeNy = eng.getTechSnapshot('GER').slots[0]!;
    expect(beforeNy.techId).toBe('medium_tank_1939');
    expect(beforeNy.aheadPenaltyPermille).toBe(3000);
    expect(beforeNy.actualDaysFixed).toBe(400_000);
    expect(beforeNy.etaDays).toBe(400);

    // Advance across 1936-12-31 -> 1937-01-01 (12 days to reach Jan 1, 1937 00:00)
    const jan1Tick = dateStringToTick('1937-01-01')!;
    eng.stepMany(jan1Tick - eng.tick);
    expect(formatDateIso(eng.tick)).toBe('1937-01-01');

    const afterNy = eng.getTechSnapshot('GER').slots[0]!;
    expect(afterNy.aheadPenaltyPermille).toBe(2000);
    expect(afterNy.actualDaysFixed).toBe(300_000);
    expect(afterNy.dailyProgressMicro).toBeGreaterThan(beforeNy.dailyProgressMicro);
    // 12 days at 2500/day = 30,000 progress -> remaining 970,000 / 3333 ≈ 292 days (sharp drop from ~388!)
    expect(afterNy.etaDays).toBeLessThan(300);
  });

  it('3. spends 100 AP to upgrade civilian -> early_mob when crisis >= 15%, lowers consumer goods 35%->25% and conserves CIV', () => {
    const eng = new SimEngine(19360101, 'GER');
    // At opening crisis = 5%, early_mob must be blocked and AP untouched
    const apStart = eng.getGovernanceSnapshot('GER').apPermille;
    eng.applyImmediate({ tick: 0, actorTag: 'GER', type: 'SET_GOVERNANCE_LAW', payload: { slot: 'economy', lawId: 'early_mob' } });
    expect(eng.getGovernanceSnapshot('GER').economyLaw).toBe('civilian');
    expect(eng.getGovernanceSnapshot('GER').apPermille).toBe(apStart);

    // With crisis = 20% and AP = 150, upgrade succeeds
    eng.resetScenario({ scenarioId: '1936', countryTag: 'GER', seed: 19360101, crisisPermille: 200, playerAp: 150 });
    const indBefore = eng.getIndustrySnapshot('GER');
    expect(indBefore.consumerGoodsPermille).toBe(350);
    const usableBefore = indBefore.civTotal - indBefore.civConsumer;

    eng.applyImmediate({ tick: 0, actorTag: 'GER', type: 'SET_GOVERNANCE_LAW', payload: { slot: 'economy', lawId: 'early_mob' } });
    const govAfter = eng.getGovernanceSnapshot('GER');
    const indAfter = eng.getIndustrySnapshot('GER');

    expect(govAfter.economyLaw).toBe('early_mob');
    expect(govAfter.apPermille).toBe(50_000); // 150 - 100 = 50 AP
    expect(indAfter.consumerGoodsPermille).toBe(250);
    expect(indAfter.civConsumer).toBe(Math.round(indAfter.civTotal * 0.25));
    expect(indAfter.civTotal - indAfter.civConsumer).toBeGreaterThan(usableBefore);
    expect(indAfter.civConsumer + indAfter.civBuild + indAfter.civTrade + indAfter.civIdle).toBe(indAfter.civTotal);
    expect(eng.getDispatches()[0]?.textZh).toContain('早期动员');
  });

  it('4. doubles max manpower on 3%->6% conscription with smooth monthly inflow, enforces total_mob -1.5% cap & tech/trade effects', () => {
    const eng = new SimEngine(19360101, 'GER');
    eng.resetScenario({
      scenarioId: '1936',
      countryTag: 'GER',
      seed: 19360101,
      playerAp: 350,
      playerMobilizationPermille: 600,
      playerAtWarWithMajor: true,
    });

    const mpBefore = eng.getGovernanceSnapshot('GER').manpower;
    expect(mpBefore.effectiveRatePermille).toBe(30); // limited 3.0%

    eng.applyImmediate({ tick: 0, actorTag: 'GER', type: 'SET_GOVERNANCE_LAW', payload: { slot: 'conscription', lawId: 'extensive' } });
    const mpDay0 = eng.getGovernanceSnapshot('GER').manpower;
    expect(mpDay0.effectiveRatePermille).toBe(60); // extensive 6.0%
    expect(mpDay0.maxManpower).toBe(mpBefore.maxManpower * 2);
    // Must NOT jump instantaneously on day 0
    expect(mpDay0.available).toBe(mpBefore.available);

    // Day 1: smooth small inflow, far below full gap
    eng.stepMany(TICKS_PER_DAY);
    const mpDay1 = eng.getGovernanceSnapshot('GER').manpower;
    expect(mpDay1.available).toBeGreaterThan(mpBefore.available);
    expect(mpDay1.available - mpBefore.available).toBeLessThan(mpBefore.maxManpower / 50);

    // 30 days total: ~0.4% of effective population flowed in
    eng.stepMany(29 * TICKS_PER_DAY);
    const mpDay30 = eng.getGovernanceSnapshot('GER').manpower;
    const expectedMonth = Math.floor((mpBefore.effectivePop * 4) / 1000);
    expect(Math.abs((mpDay30.available - mpBefore.available) - expectedMonth)).toBeLessThanOrEqual(30);

    // Total mobilization applies -1.5% to effective conscription rate (6.0% -> 4.5%)
    eng.applyImmediate({ tick: eng.tick, actorTag: 'GER', type: 'SET_GOVERNANCE_LAW', payload: { slot: 'economy', lawId: 'total_mob' } });
    expect(eng.getGovernanceSnapshot('GER').manpower.effectiveRatePermille).toBe(45);

    // Trade embargo (0% export) prevents Romania from exporting oil to Germany
    eng.applyImmediate({ tick: eng.tick, actorTag: 'ROM', type: 'SET_GOVERNANCE_LAW', payload: { slot: 'trade', lawId: 'wartime_embargo' } });
    // ROM starts with 85 AP; after 30 days at ~2.1 AP/day ROM has >145 AP so switch succeeds!
    expect(eng.getGovernanceSnapshot('ROM').tradeLaw).toBe('wartime_embargo');
    expect(eng.getIndustrySnapshot('ROM').resources.oil.exported).toBe(0);

    // Industrial techs inject directly into mastery cap & region slots on completion
    const slotsBefore = eng.getIndustrySnapshot('GER').regions.find((r) => r.id === 1)!.slots;
    eng.applyImmediate({ tick: eng.tick, actorTag: 'GER', type: 'START_RESEARCH', payload: { techId: 'machine_tools_1' } });
    eng.applyImmediate({ tick: eng.tick, actorTag: 'GER', type: 'START_RESEARCH', payload: { techId: 'modular_build_1' } });
    eng.stepMany(85 * TICKS_PER_DAY);
    const indDone = eng.getIndustrySnapshot('GER');
    expect(indDone.lines[0]!.masteryMaxPermille).toBe(830); // 75% + 8% from machine_tools_1
    expect(indDone.regions.find((r) => r.id === 1)!.slots).toBe(slotsBefore + 1);
  });

  it('5. produces identical state hash across two seeded runs with law switches and research progression', () => {
    const runOnce = () => {
      const eng = new SimEngine(19360101, 'GBR');
      eng.resetScenario({
        scenarioId: '1936',
        countryTag: 'GBR',
        seed: 19360404,
        crisisPermille: 200,
        playerAp: 250,
        playerMobilizationPermille: 550,
      });
      eng.applyImmediate({ tick: 0, actorTag: 'GBR', type: 'SET_GOVERNANCE_LAW', payload: { slot: 'economy', lawId: 'early_mob' } });
      eng.applyImmediate({ tick: 0, actorTag: 'GBR', type: 'SET_GOVERNANCE_LAW', payload: { slot: 'conscription', lawId: 'extensive' } });
      eng.applyImmediate({ tick: 0, actorTag: 'GBR', type: 'START_RESEARCH', payload: { techId: 'machine_tools_1' } });
      eng.applyImmediate({ tick: 0, actorTag: 'GBR', type: 'START_RESEARCH', payload: { techId: 'medium_tank_1939' } });
      eng.stepMany(95 * TICKS_PER_DAY);
      return {
        hash: eng.computeStateHashHex(),
        gov: eng.getGovernanceSnapshot('GBR'),
        tech: eng.getTechSnapshot('GBR'),
        ind: eng.getIndustrySnapshot('GBR'),
      };
    };

    const a = runOnce();
    const b = runOnce();
    expect(a.hash).toBe(b.hash);
    expect(a.gov).toEqual(b.gov);
    expect(a.tech).toEqual(b.tech);
    expect(a.ind).toEqual(b.ind);
    expect(a.tech.completedIds).toContain('machine_tools_1');
  });
});
