/**
 * Deterministic Batch 06 Mock-War Scenario Presets (`?mockWar=GER_POL` / `GER_POL_POCKET`).
 * Pure TypeScript — zero DOM/PIXI dependencies.
 */
import { getCapitalProvince } from '../data/provinces1936';
import type { ArmySystem } from './armySystem';
import { buildFrontlineOrder } from './armyOrderSystem';
import type { BrigadeState } from './armyTypes';
import type { LandCombatSystem } from './landCombatSystem';

const NORTH_GER_FRONT = [222, 248, 253, 251, 250, 252];
const SOUTH_GER_FRONT = [245, 235, 247];
const POL_BORDER_PROVS = [388, 390, 404, 415, 417, 407, 383, 397];
const POL_RESERVE_PROVS = [389, 408, 403, 384, 382, 416];

function resetBrigPosition(b: BrigadeState, provId: number, planPermille: number, entrenchPermille: number): void {
  b.provinceId = provId;
  b.path = [];
  b.moveProgressFixed = 0;
  b.moveEdgeCostFixed = 0;
  b.moveTargetProvId = null;
  b.manualOverride = false;
  b.inCombatBattleId = null;
  b.retreating = false;
  b.planPermille = planPermille;
  b.entrenchPermille = entrenchPermille;
}

/** Configure a deterministic GER vs POL war across the full border for Batch 06 testing & shots. */
export function applyMockWarPreset(
  code: string,
  army: ArmySystem,
  combat: LandCombatSystem,
  onWarFlags?: (tag: string) => void,
): void {
  const key = code.trim().toUpperCase();
  if (key !== 'GER_POL' && key !== 'GER_POL_POCKET') return;

  combat.declareWar('GER', 'POL');
  onWarFlags?.('GER');
  onWarFlags?.('POL');

  const gerArmies = army.getArmiesFor('GER');
  const northArmy = gerArmies[0];
  const southArmy = gerArmies[1] ?? army.createArmy('GER', '第2西里西亚装甲军');
  if (!northArmy) return;

  army.assignCommander('GER', northArmy.id, 'ger_brenner');
  army.assignCommander('GER', southArmy.id, 'ger_keller');

  // Move armored/motorized spearhead brigades into South Army (Silesia -> Warsaw pincer)
  const gerBrigs = army.getAllBrigades().filter((b) => b.owner === 'GER');
  const mobile = gerBrigs.filter((b) => b.template === 'ARM' || b.template === 'MOT');
  const others = gerBrigs.filter((b) => b.template !== 'ARM' && b.template !== 'MOT');

  for (let i = 0; i < mobile.length; i++) {
    army.assignBrigadeToArmy('GER', mobile[i]!.id, i < 6 ? southArmy.id : northArmy.id);
  }
  for (let i = 0; i < others.length; i++) {
    const targetArmy = northArmy.brigadeIds.length < 15 ? northArmy : southArmy;
    army.assignBrigadeToArmy('GER', others[i]!.id, targetArmy.id);
  }

  const fullFl = buildFrontlineOrder('GER', 'POL', combat.getController);
  const southSet = new Set(SOUTH_GER_FRONT);
  if (fullFl) {
    northArmy.frontline = {
      targetTag: 'POL',
      friendlyProvIds: fullFl.friendlyProvIds.filter((id) => !southSet.has(id)),
      borderPairs: fullFl.borderPairs.filter((p) => !southSet.has(p.friendlyProvId)),
    };
    southArmy.frontline = {
      targetTag: 'POL',
      friendlyProvIds: fullFl.friendlyProvIds.filter((id) => southSet.has(id)),
      borderPairs: fullFl.borderPairs.filter((p) => southSet.has(p.friendlyProvId)),
    };
  }

  // Deploy GER armies along the entire contact line with initial planning bonus
  northArmy.brigadeIds.forEach((bid, idx) => {
    const b = army.getBrigade(bid);
    if (b) resetBrigPosition(b, NORTH_GER_FRONT[idx % NORTH_GER_FRONT.length]!, 150, 60);
  });
  southArmy.brigadeIds.forEach((bid, idx) => {
    const b = army.getBrigade(bid);
    if (b) resetBrigPosition(b, SOUTH_GER_FRONT[idx % SOUTH_GER_FRONT.length]!, 180, 60);
  });

  // Deploy POL armies on border & reserve lines with initial entrenchment
  const polArmies = army.getArmiesFor('POL');
  const polFront = polArmies[0];
  const polRes = polArmies[1];
  if (polFront) {
    army.assignCommander('POL', polFront.id, 'pol_kowalski');
    const polFl = buildFrontlineOrder('POL', 'GER', combat.getController);
    if (polFl) polFront.frontline = polFl;
    polFront.brigadeIds.forEach((bid, idx) => {
      const b = army.getBrigade(bid);
      if (b) resetBrigPosition(b, POL_BORDER_PROVS[idx % POL_BORDER_PROVS.length]!, 0, 120);
    });
  }
  if (polRes) {
    army.assignCommander('POL', polRes.id, 'pol_nowak');
    polRes.brigadeIds.forEach((bid, idx) => {
      const b = army.getBrigade(bid);
      if (b) resetBrigPosition(b, POL_RESERVE_PROVS[idx % POL_RESERVE_PROVS.length]!, 0, 90);
    });
  }

  // Set pincer offensive arrows toward Warsaw (384)
  const warsaw = getCapitalProvince('POL');
  if (warsaw) {
    army.setOffensiveArrow('GER', northArmy.id, 250, warsaw.id, 28, -8, combat.getController);
    army.setOffensiveArrow('GER', southArmy.id, 235, warsaw.id, -16, 22, combat.getController);
  }

  // Optional encirclement showcase preset: GER pincer closes around Greater Poland (389, 390)
  if (key === 'GER_POL_POCKET') {
    for (const occId of [388, 408, 403, 404, 417, 407]) {
      combat.setController(occId, 'GER');
    }
    // Position GER pincer forces on the ring provinces
    const ringProvs = [388, 408, 403, 404, 245, 235];
    southArmy.brigadeIds.forEach((bid, idx) => {
      const b = army.getBrigade(bid);
      if (b) resetBrigPosition(b, ringProvs[idx % ringProvs.length]!, 150, 60);
    });
    // Trap 4 Polish brigades inside inland Greater Poland pocket (389 & 390)
    const trappedIds = (polFront?.brigadeIds ?? []).slice(0, 4);
    trappedIds.forEach((bid, idx) => {
      const b = army.getBrigade(bid);
      if (b) {
        resetBrigPosition(b, idx < 2 ? 389 : 390, 0, 90);
        b.orgPermille = 520;
        b.strengthPermille = 740;
      }
    });
    // Keep remaining Polish brigades east of Vistula (384, 383, 382, 394, 416)
    const eastProvs = [384, 383, 382, 394, 416, 397];
    const restPol = army.getAllBrigades().filter((b) => b.owner === 'POL' && !trappedIds.includes(b.id));
    restPol.forEach((b, idx) => resetBrigPosition(b, eastProvs[idx % eastProvs.length]!, 0, 120));

    army.refreshFrontlines(combat.getController);
    if (southArmy.arrow) southArmy.arrow.active = false;
    if (northArmy.arrow) northArmy.arrow.active = false;
  }

  combat.scanPockets(army);
}
