/**
 * Helper for daily motorized-supply truck funding and building LogisticsSnapshot
 * for F5 LogisticsDrawer & MapStage M3 overlay. Pure TypeScript, zero DOM/PIXI.
 */
import type { ArmySystem } from './armySystem';
import type { IndustrySystem } from './industrySystem';
import { countBrigadesByOwnerProv, evaluateSupplyEffect } from './supplyPenalties';
import type { SupplyNetwork } from './supplySystem';
import type { ArmyLogisticsSnap, LogisticsSnapshot } from './supplyTypes';

/** Daily truck cost for an army with motorized supply enabled (ceil(brigades / 6), min 1). */
export function calcArmyDailyTruckCost(brigadeCount: number): number {
  if (brigadeCount <= 0) return 0;
  return Math.max(1, Math.ceil(brigadeCount / 6));
}

/**
 * Determine which nations have funded motorized supply (and optionally consume daily MOT_EQ trucks).
 * Returns the set of tags whose motorized supply bonus (-3 impedance) is active.
 */
export function resolveMotorizedSupplyFunding(
  army: ArmySystem,
  industry: IndustrySystem,
  consumeDaily: boolean,
): Set<string> {
  const demandByTag = new Map<string, number>();
  for (const a of army.getAllArmies()) {
    if (!a.motorizedSupply || a.brigadeIds.length === 0) continue;
    demandByTag.set(a.owner, (demandByTag.get(a.owner) ?? 0) + calcArmyDailyTruckCost(a.brigadeIds.length));
  }

  const funded = new Set<string>();
  for (const [tag, demand] of demandByTag.entries()) {
    const stock = industry.getStockpileUnits(tag, 'MOT_EQ');
    if (stock >= demand) {
      if (consumeDaily) industry.consumeEquipment(tag, 'MOT_EQ', demand);
      funded.add(tag);
    }
  }
  return funded;
}

/** Build structured LogisticsSnapshot for F5 LogisticsDrawer and M3 supply hub overlay. */
export function buildLogisticsSnapshot(
  playerTag: string,
  army: ArmySystem,
  industry: IndustrySystem,
  supply: SupplyNetwork,
  fundedMotorizedTags: ReadonlySet<string>,
): LogisticsSnapshot {
  const allBrigs = army.getAllBrigades();
  const stackCounts = countBrigadesByOwnerProv(allBrigs);
  const playerArmies = army.getArmiesFor(playerTag);
  const truckStock = industry.getStockpileUnits(playerTag, 'MOT_EQ');
  const truckProdFixed = industry.getDailyProdFixed(playerTag, 'MOT_EQ');
  const isTagFunded = fundedMotorizedTags.has(playerTag);

  let truckDailyDemand = 0;
  let totalSupplySum = 0;
  let totalBrigCount = 0;
  let lowCountTotal = 0;
  let starvingTotal = 0;

  const armySnaps: ArmyLogisticsSnap[] = [];
  for (const a of playerArmies) {
    let sSum = 0;
    let lowC = 0;
    let starvC = 0;
    let cnt = 0;
    for (const bid of a.brigadeIds) {
      const b = army.getBrigade(bid);
      if (!b) continue;
      const sVal = supply.getSupply(b.provinceId);
      const n = stackCounts.get(`${b.owner}:${b.provinceId}`) ?? 1;
      const eff = evaluateSupplyEffect(sVal, n, b.zeroSupplyTicks);
      sSum += eff.supplyValue;
      cnt += 1;
      if (eff.status === 'low') lowC += 1;
      else if (eff.status === 'starving') starvC += 1;
    }
    const cost = a.motorizedSupply ? calcArmyDailyTruckCost(cnt) : 0;
    truckDailyDemand += cost;
    armySnaps.push({
      armyId: a.id,
      nameZh: a.nameZh,
      color: a.color,
      brigadeCount: cnt,
      avgSupply: cnt > 0 ? Math.round(sSum / cnt) : 100,
      lowSupplyCount: lowC,
      starvingCount: starvC,
      motorizedSupply: a.motorizedSupply,
      motorizedFunded: a.motorizedSupply && isTagFunded,
      dailyTruckCost: cost,
    });
  }

  for (const b of allBrigs) {
    if (b.owner !== playerTag) continue;
    const sVal = supply.getSupply(b.provinceId);
    const n = stackCounts.get(`${b.owner}:${b.provinceId}`) ?? 1;
    const eff = evaluateSupplyEffect(sVal, n, b.zeroSupplyTicks);
    totalSupplySum += eff.supplyValue;
    totalBrigCount += 1;
    if (eff.status === 'low') lowCountTotal += 1;
    else if (eff.status === 'starving') starvingTotal += 1;
  }

  const allHubs = supply.getActiveHubs().map((h) => ({ ...h }));
  const hubs = allHubs
    .filter((h) => h.controller === playerTag)
    .sort((a, b) => b.effectiveSupply - a.effectiveSupply || a.provId - b.provId);

  return {
    playerTag,
    truckStockpile: truckStock,
    truckDailyDemand,
    truckDailyProdFixed: truckProdFixed,
    avgNationSupply: totalBrigCount > 0 ? Math.round(totalSupplySum / totalBrigCount) : 100,
    lowSupplyBrigades: lowCountTotal,
    starvingBrigades: starvingTotal,
    armies: armySnaps,
    hubs,
    allHubs,
  };
}
