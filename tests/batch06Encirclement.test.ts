import { describe, expect, it } from 'vitest';
import { SimEngine } from '../src/sim/core/SimEngine';
import { BRIGADE_TEMPLATES } from '../src/sim/data/brigadeTemplates';
import { getSimProvince } from '../src/sim/data/provinces1936';

describe('Batch 06 Retreat, Occupation, Encirclement Wipeout, Pockets & Arrow Execution', () => {
  it('1. retreats defeated defender to adjacent friendly province and transfers province control', () => {
    const eng = new SimEngine(19390901, 'GER');
    eng.declareMockWar('GER', 'POL');
    const army = eng.getArmySystemForTest();
    const combat = eng.getCombatSystemForTest();

    // Clear all GER/POL units from 388 (波兹南) and 222 (波美拉尼亚), place isolated test battle
    for (const b of [...army.getAllBrigades()]) {
      if (b.owner === 'GER' || b.owner === 'POL') army.removeBrigade(b.id);
    }
    const atk1 = army.spawnBrigadeForTest('GER', 'ARM', 222, null, 1000, 1000);
    const atk2 = army.spawnBrigadeForTest('GER', 'ARM', 222, null, 1000, 1000);
    const def = army.spawnBrigadeForTest('POL', 'GAR', 388, null, 80, 1000);

    expect(combat.getController(388)).toBe('POL');
    combat.startOrJoinAttack(atk1, 388, eng.tick, army);
    combat.startOrJoinAttack(atk2, 388, eng.tick, army);
    eng.stepMany(8);

    // Defender retreated out of 388 into adjacent POL province; GER now controls & occupies 388
    expect(combat.getController(388)).toBe('GER');
    expect(army.getBrigade(def.id)).toBeDefined();
    expect(def.provinceId !== 388 || def.retreating).toBe(true);
    const dest = def.moveTargetProvId ?? def.provinceId;
    expect(getSimProvince(388)!.neighbors).toContain(dest);
    expect(combat.getController(dest)).toBe('POL');
    expect(atk1.provinceId === 388 || atk2.provinceId === 388).toBe(true);
  });

  it('2. wipes out encircled defenders with 100% manpower loss and exact 15% equipment capture', () => {
    const eng = new SimEngine(19390902, 'GER');
    eng.declareMockWar('GER', 'POL');
    const army = eng.getArmySystemForTest();
    const combat = eng.getCombatSystemForTest();

    for (const b of [...army.getAllBrigades()]) {
      if (b.owner === 'GER' || b.owner === 'POL') army.removeBrigade(b.id);
    }

    // 389 (大波兰) is landlocked (isCoastal=false); surround all its land neighbors with GER control
    const pocketProv = getSimProvince(389)!;
    expect(pocketProv.isCoastal).toBe(false);
    for (const nid of pocketProv.neighbors) combat.setController(nid, 'GER');

    const atkProv = pocketProv.neighbors[0]!;
    const a1 = army.spawnBrigadeForTest('GER', 'ARM', atkProv, null, 1000, 1000);
    const a2 = army.spawnBrigadeForTest('GER', 'ARM', atkProv, null, 1000, 1000);
    const trapped1 = army.spawnBrigadeForTest('POL', 'INF', 389, null, 40, 1000);
    const trapped2 = army.spawnBrigadeForTest('POL', 'MOT', 389, null, 40, 1000);

    const stockBefore = Object.fromEntries(
      eng.getIndustrySnapshot('GER').lines.map((l) => [l.type, Math.floor(l.stockpileFixed / 1000)]),
    );
    const polCasBefore = eng.getGovernanceSnapshot('POL').manpower.casualties;

    combat.startOrJoinAttack(a1, 389, eng.tick, army);
    combat.startOrJoinAttack(a2, 389, eng.tick, army);
    eng.stepMany(3); // < 1 day so daily industry production does not alter stockpiles

    expect(combat.getController(389)).toBe('GER');
    expect(army.getBrigade(trapped1.id)).toBeUndefined();
    expect(army.getBrigade(trapped2.id)).toBeUndefined();

    const snap = combat.getSnapshot();
    expect(snap.recentWipeouts.length).toBe(1);
    const w = snap.recentWipeouts[0]!;
    expect(w.brigadeCount).toBe(2);
    expect(w.provinceId).toBe(389);

    // Exact 15% capture conservation per required equipment type:
    // INF (100 INF_EQ, 10 ART_EQ) -> 15 INF_EQ, 1 ART_EQ
    // MOT (100 INF_EQ, 35 MOT_EQ, 10 ART_EQ) -> 15 INF_EQ, 5 MOT_EQ, 1 ART_EQ
    expect(w.equipmentCaptured.INF_EQ).toBe(30);
    expect(w.equipmentCaptured.MOT_EQ).toBe(5);
    expect(w.equipmentCaptured.ART_EQ).toBe(2);

    const stockAfter = Object.fromEntries(
      eng.getIndustrySnapshot('GER').lines.map((l) => [l.type, Math.floor(l.stockpileFixed / 1000)]),
    );
    expect(stockAfter.INF_EQ! - stockBefore.INF_EQ!).toBe(30);
    expect(stockAfter.MOT_EQ! - stockBefore.MOT_EQ!).toBe(5);
    expect(stockAfter.ART_EQ! - stockBefore.ART_EQ!).toBe(2);

    // Manpower conservation: casualties grew by combat losses + 100% remaining trapped manpower
    const polCasAfter = eng.getGovernanceSnapshot('POL').manpower.casualties;
    const expectedMinLost = Math.floor((BRIGADE_TEMPLATES.INF.manpower + BRIGADE_TEMPLATES.MOT.manpower) * 0.9);
    expect(polCasAfter - polCasBefore).toBeGreaterThanOrEqual(expectedMinLost);
  });

  it('3. scans encircled inland pockets daily without falsely flagging sea-linked East Prussia', () => {
    const eng = new SimEngine(19390903, 'GER');
    eng.resetScenario({ scenarioId: '1936', countryTag: 'GER', seed: 19390903, mockWar: 'GER_POL_POCKET', paused: true });
    eng.stepMany(4); // cross daily boundary

    const pockets = eng.getCombatSnapshot().pockets;
    expect(pockets.some((p) => p.owner === 'POL' && p.provinceIds.includes(389))).toBe(true);
    expect(pockets.some((p) => p.owner === 'GER')).toBe(false);
  });

  it('4. executes offensive arrows to advance >=1 province while respecting manualOverride', () => {
    const eng = new SimEngine(19390904, 'GER');
    eng.resetScenario({ scenarioId: '1936', countryTag: 'GER', seed: 19390904, mockWar: 'GER_POL', paused: true });

    const army = eng.getArmySystemForTest();
    const gerArmies = army.getArmiesFor('GER');
    const lockedId = gerArmies[0]!.brigadeIds[0]!;
    // Give one brigade a manual override march to Berlin (231)
    eng.applyImmediate({
      tick: eng.tick,
      actorTag: 'GER',
      type: 'MARCH_BRIGADES',
      payload: { brigadeIds: [lockedId], targetProvId: 231 },
    });
    expect(army.getBrigade(lockedId)!.manualOverride).toBe(true);
    expect(army.getBrigade(lockedId)!.moveTargetProvId).toBe(231);

    // Track every tick: locked brigade must stay locked & reach Berlin without AI hijacking it
    let reachedBerlin = false;
    for (let t = 0; t < 36; t++) {
      eng.stepTick();
      const locked = army.getBrigade(lockedId)!;
      if (locked.provinceId === 231) {
        reachedBerlin = true;
      } else if (!reachedBerlin) {
        expect(locked.manualOverride).toBe(true);
        expect(locked.moveTargetProvId).toBe(231);
        expect(locked.inCombatBattleId).toBeNull();
      }
    }

    expect(reachedBerlin).toBe(true);
    const combatSnap = eng.getCombatSnapshot();
    const gerOccupied = combatSnap.occupiedProvinces.filter((o) => o.controller === 'GER');
    expect(gerOccupied.length).toBeGreaterThanOrEqual(1);
  });
});
