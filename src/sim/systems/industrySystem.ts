/**
 * Deterministic Industry, Construction Queue & Production Line System (Batch 03).
 * Pure TypeScript — zero DOM/PIXI references.
 */
import { clampInt, FIXED_SCALE } from '../core/FixedMath';
import { ALL_PLAYABLE_NATIONS_1936 } from '../data/nations1936';
import { REGIONS_1936 } from '../data/regions1936';
import {
  calcConsumerGoodsCiv,
  calcDailyCpFixed,
  calcLineDailyUnitsFixed,
  calcLineResourceMultPermille,
  calcResourceCoveragePermille,
  stepMasteryMicro,
} from './industryMath';
import { buildOpeningLineAlloc, buildOpeningStockpilesFixed } from './industryPresets';
import {
  BUILDING_SPECS,
  CONSUMER_GOODS_PERMILLE,
  EQUIPMENT_LIST,
  EQUIPMENT_SPECS,
  MASTERY_INIT_MICRO,
  MASTERY_MAX_INIT_MICRO,
  MAX_CIV_PER_PROJECT,
  SYNTH_OIL_BONUS,
  type BuildingType,
  type ConstructionProjectSnap,
  type EconomyLaw,
  type EquipmentType,
  type IndustrySnapshot,
  type ProductionLineSnap,
  type RegionDynamicSnap,
  type ResourceBreakdown,
  type ResourceType,
  type TradeDeal,
} from './industryTypes';
import { resolveDailyTrade, type TradeNationInput } from './tradeSystem';

interface RegionState {
  id: number;
  owner: string;
  nameZh: string;
  isCoastal: boolean;
  slots: number;
  infra: number;
  civ: number;
  mil: number;
  doc: number;
  synth: number;
  baseSteel: number;
  baseOil: number;
  baseRare: number;
}

interface LineState {
  factories: number;
  masteryMicro: number;
  masteryMaxMicro: number;
  stockpileFixed: number;
  lastDailyUnitsFixed: number;
  lastResourceMultPermille: number;
}

interface ProjectState {
  id: number;
  regionId: number;
  building: BuildingType;
  progressFixed: number;
  costFixed: number;
  lastAssignedCiv: number;
  lastDailyCpFixed: number;
}

interface NationIndustryState {
  tag: string;
  economyLaw: EconomyLaw;
  autoTrade: boolean;
  civTotal: number;
  civConsumer: number;
  civTrade: number;
  civBuild: number;
  civIdle: number;
  milTotal: number;
  docTotal: number;
  convoysUsed: number;
  lines: Record<EquipmentType, LineState>;
  queue: ProjectState[];
  resources: Record<ResourceType, ResourceBreakdown>;
  deals: TradeDeal[];
}

export interface CompletedBuildingEvent {
  tag: string;
  regionId: number;
  regionNameZh: string;
  building: BuildingType;
}

export class IndustrySystem {
  private regions: RegionState[] = [];
  private regionById = new Map<number, RegionState>();
  private nations = new Map<string, NationIndustryState>();
  private nationOrder: string[] = [];
  private nextProjectId = 1;

  reset(cohesionByTag: ReadonlyMap<string, number>): void {
    this.regions = REGIONS_1936.map((r) => ({
      id: r.id,
      owner: r.owner,
      nameZh: r.nameZh,
      isCoastal: r.isCoastal,
      slots: r.slots,
      infra: r.infra,
      civ: r.civ,
      mil: r.mil,
      doc: r.doc,
      synth: 0,
      baseSteel: r.steel,
      baseOil: r.oil,
      baseRare: r.rare,
    }));
    this.regionById = new Map(this.regions.map((r) => [r.id, r]));
    this.nations.clear();
    this.nationOrder = ALL_PLAYABLE_NATIONS_1936.map((p) => p.tag);
    this.nextProjectId = 1;

    for (const p of ALL_PLAYABLE_NATIONS_1936) {
      const alloc = buildOpeningLineAlloc(p);
      const stock = buildOpeningStockpilesFixed(p);
      const lines = {} as Record<EquipmentType, LineState>;
      for (const eq of EQUIPMENT_LIST) {
        lines[eq] = {
          factories: alloc[eq],
          masteryMicro: MASTERY_INIT_MICRO,
          masteryMaxMicro: MASTERY_MAX_INIT_MICRO,
          stockpileFixed: stock[eq],
          lastDailyUnitsFixed: 0,
          lastResourceMultPermille: FIXED_SCALE,
        };
      }
      this.nations.set(p.tag, {
        tag: p.tag,
        economyLaw: 'civilian',
        autoTrade: true,
        civTotal: p.civ,
        civConsumer: 0,
        civTrade: 0,
        civBuild: 0,
        civIdle: 0,
        milTotal: p.mil,
        docTotal: p.doc,
        convoysUsed: 0,
        lines,
        queue: [],
        resources: {
          steel: { prod: 0, demand: 0, imported: 0, exported: 0, net: 0 },
          oil: { prod: 0, demand: 0, imported: 0, exported: 0, net: 0 },
          rare: { prod: 0, demand: 0, imported: 0, exported: 0, net: 0 },
        },
        deals: [],
      });
    }
    this.recomputeEconomyPreview(cohesionByTag);
  }

  /** Recompute factories, resources, trade, and construction allocation without advancing time. */
  recomputeEconomyPreview(cohesionByTag: ReadonlyMap<string, number>): void {
    const prodByTag = this.aggregateRegions();
    const tradeInputs: TradeNationInput[] = [];

    for (const tag of this.nationOrder) {
      const n = this.nations.get(tag)!;
      const ag = prodByTag.get(tag)!;
      n.civTotal = ag.civ;
      n.milTotal = ag.mil;
      n.docTotal = ag.doc;
      this.clampLineFactoriesToTotals(n);

      const cgPerm = CONSUMER_GOODS_PERMILLE[n.economyLaw];
      n.civConsumer = calcConsumerGoodsCiv(n.civTotal, cgPerm);
      const usableCiv = n.civTotal - n.civConsumer;
      const demand = this.calcLineDemand(n);

      tradeInputs.push({
        tag,
        autoTrade: n.autoTrade,
        usableCiv,
        convoysTotal: Math.floor(n.lines.CONVOY.stockpileFixed / FIXED_SCALE),
        hasCoastal: ag.hasCoastal,
        prod: { steel: ag.steel, oil: ag.oil, rare: ag.rare },
        demand,
      });
    }

    const tradeResults = resolveDailyTrade(tradeInputs);

    for (const inp of tradeInputs) {
      const n = this.nations.get(inp.tag)!;
      const tr = tradeResults.get(inp.tag)!;
      const usableCiv = n.civTotal - n.civConsumer;
      n.civTrade = clampInt(tr.tradeCiv, 0, usableCiv);
      n.convoysUsed = tr.convoysUsed;
      n.deals = tr.deals;

      for (const r of ['steel', 'oil', 'rare'] as const) {
        const net = inp.prod[r] - inp.demand[r] + tr.imported[r] - tr.exported[r];
        n.resources[r] = { prod: inp.prod[r], demand: inp.demand[r], imported: tr.imported[r], exported: tr.exported[r], net };
      }

      const covS = calcResourceCoveragePermille(inp.prod.steel + tr.imported.steel - tr.exported.steel, inp.demand.steel);
      const covO = calcResourceCoveragePermille(inp.prod.oil + tr.imported.oil - tr.exported.oil, inp.demand.oil);
      const covR = calcResourceCoveragePermille(inp.prod.rare + tr.imported.rare - tr.exported.rare, inp.demand.rare);
      const coh = cohesionByTag.get(inp.tag) ?? 500;

      for (const eq of EQUIPMENT_LIST) {
        const line = n.lines[eq];
        const spec = EQUIPMENT_SPECS[eq];
        const resMult = calcLineResourceMultPermille(spec, covS, covO, covR);
        line.lastResourceMultPermille = resMult;
        line.lastDailyUnitsFixed = calcLineDailyUnitsFixed(spec, line.factories, line.masteryMicro, coh, FIXED_SCALE, resMult);
      }

      let remBuild = usableCiv - n.civTrade;
      let usedBuild = 0;
      for (const proj of n.queue) {
        const reg = this.regionById.get(proj.regionId);
        const assigned = Math.min(MAX_CIV_PER_PROJECT, remBuild);
        proj.lastAssignedCiv = assigned;
        proj.lastDailyCpFixed = reg ? calcDailyCpFixed(assigned, reg.infra) : 0;
        remBuild -= assigned;
        usedBuild += assigned;
      }
      n.civBuild = usedBuild;
      n.civIdle = usableCiv - n.civTrade - usedBuild;
    }
  }

  /** Advance 1 full simulation day: produce equipment, advance mastery, progress construction. */
  stepDaily(cohesionByTag: ReadonlyMap<string, number>): CompletedBuildingEvent[] {
    const completed: CompletedBuildingEvent[] = [];

    for (const tag of this.nationOrder) {
      const n = this.nations.get(tag)!;
      // 1. Production output & mastery growth
      for (const eq of EQUIPMENT_LIST) {
        const line = n.lines[eq];
        if (line.factories <= 0) continue;
        line.stockpileFixed += line.lastDailyUnitsFixed;
        line.masteryMicro = stepMasteryMicro(line.masteryMicro, line.masteryMaxMicro);
      }
      // 2. Construction progress
      const remainingQueue: ProjectState[] = [];
      for (const proj of n.queue) {
        if (proj.lastDailyCpFixed > 0) {
          proj.progressFixed += proj.lastDailyCpFixed;
        }
        if (proj.progressFixed >= proj.costFixed) {
          const reg = this.regionById.get(proj.regionId);
          if (reg && reg.owner === tag) {
            this.applyCompletedBuilding(reg, proj.building);
            completed.push({ tag, regionId: reg.id, regionNameZh: reg.nameZh, building: proj.building });
          }
        } else {
          remainingQueue.push(proj);
        }
      }
      n.queue = remainingQueue;
    }

    this.recomputeEconomyPreview(cohesionByTag);
    return completed;
  }

  queueConstruction(tag: string, regionId: number, building: BuildingType, cohesionByTag: ReadonlyMap<string, number>): boolean {
    const n = this.nations.get(tag);
    const reg = this.regionById.get(regionId);
    if (!n || !reg || reg.owner !== tag) return false;
    const spec = BUILDING_SPECS[building];
    if (spec.requiresCoastal && !reg.isCoastal) return false;

    if (building === 'INFRA') {
      const queuedInfra = n.queue.filter((p) => p.regionId === regionId && p.building === 'INFRA').length;
      if (reg.infra + queuedInfra >= 5) return false;
    } else {
      const usedSlots = reg.civ + reg.mil + reg.doc + reg.synth;
      const queuedSlots = n.queue.filter((p) => p.regionId === regionId && BUILDING_SPECS[p.building].usesSlot).length;
      if (usedSlots + queuedSlots >= reg.slots) return false;
    }

    n.queue.push({
      id: this.nextProjectId++,
      regionId,
      building,
      progressFixed: 0,
      costFixed: spec.costFixed,
      lastAssignedCiv: 0,
      lastDailyCpFixed: 0,
    });
    this.recomputeEconomyPreview(cohesionByTag);
    return true;
  }

  cancelConstruction(tag: string, projectId: number, cohesionByTag: ReadonlyMap<string, number>): boolean {
    const n = this.nations.get(tag);
    if (!n) return false;
    const idx = n.queue.findIndex((p) => p.id === projectId);
    if (idx < 0) return false;
    n.queue.splice(idx, 1);
    this.recomputeEconomyPreview(cohesionByTag);
    return true;
  }

  reorderConstruction(tag: string, projectId: number, dir: 'up' | 'down' | 'top', cohesionByTag: ReadonlyMap<string, number>): boolean {
    const n = this.nations.get(tag);
    if (!n) return false;
    const idx = n.queue.findIndex((p) => p.id === projectId);
    if (idx < 0) return false;
    if (dir === 'top' && idx > 0) {
      const [item] = n.queue.splice(idx, 1);
      n.queue.unshift(item!);
    } else if (dir === 'up' && idx > 0) {
      [n.queue[idx - 1], n.queue[idx]] = [n.queue[idx]!, n.queue[idx - 1]!];
    } else if (dir === 'down' && idx < n.queue.length - 1) {
      [n.queue[idx + 1], n.queue[idx]] = [n.queue[idx]!, n.queue[idx + 1]!];
    } else {
      return false;
    }
    this.recomputeEconomyPreview(cohesionByTag);
    return true;
  }

  setLineFactories(tag: string, eqType: EquipmentType, desired: number, cohesionByTag: ReadonlyMap<string, number>): boolean {
    const n = this.nations.get(tag);
    if (!n) return false;
    const spec = EQUIPMENT_SPECS[eqType];
    const line = n.lines[eqType];
    const poolTotal = spec.factoryKind === 'DOC' ? n.docTotal : n.milTotal;
    const otherUsed = EQUIPMENT_LIST.reduce((acc, k) => {
      if (k === eqType || EQUIPMENT_SPECS[k].factoryKind !== spec.factoryKind) return acc;
      return acc + n.lines[k].factories;
    }, 0);
    const next = clampInt(desired, 0, Math.max(0, poolTotal - otherUsed));
    if (next === line.factories) return false;

    if (next === 0) {
      line.factories = 0;
      line.masteryMicro = MASTERY_INIT_MICRO;
    } else if (next > line.factories) {
      const added = next - line.factories;
      const blended = Math.floor((line.factories * line.masteryMicro + added * MASTERY_INIT_MICRO) / next);
      line.factories = next;
      line.masteryMicro = blended;
    } else {
      line.factories = next;
    }
    this.recomputeEconomyPreview(cohesionByTag);
    return true;
  }

  /** Switch factories from one MIL line to another and reset target line mastery to 30%. */
  switchProductionLine(
    tag: string,
    fromType: EquipmentType,
    toType: EquipmentType,
    count: number | undefined,
    cohesionByTag: ReadonlyMap<string, number>,
  ): boolean {
    const n = this.nations.get(tag);
    if (!n || fromType === toType) return false;
    if (EQUIPMENT_SPECS[fromType].factoryKind !== EQUIPMENT_SPECS[toType].factoryKind) return false;
    const src = n.lines[fromType];
    const dst = n.lines[toType];
    const move = clampInt(count ?? src.factories, 0, src.factories);
    if (move <= 0) return false;

    src.factories -= move;
    if (src.factories === 0) src.masteryMicro = MASTERY_INIT_MICRO;
    dst.factories += move;
    dst.masteryMicro = MASTERY_INIT_MICRO; // Carbon §4.6: switching production resets mastery to 30%
    this.recomputeEconomyPreview(cohesionByTag);
    return true;
  }

  toggleAutoTrade(tag: string, enabled: boolean | undefined, cohesionByTag: ReadonlyMap<string, number>): void {
    const n = this.nations.get(tag);
    if (!n) return;
    n.autoTrade = typeof enabled === 'boolean' ? enabled : !n.autoTrade;
    this.recomputeEconomyPreview(cohesionByTag);
  }

  getNationSummary(tag: string): { civ: number; mil: number; doc: number; steelNet: number; oilNet: number; rareNet: number } | null {
    const n = this.nations.get(tag);
    if (!n) return null;
    return {
      civ: n.civTotal,
      mil: n.milTotal,
      doc: n.docTotal,
      steelNet: n.resources.steel.net,
      oilNet: n.resources.oil.net,
      rareNet: n.resources.rare.net,
    };
  }

  getSnapshotFor(tag: string): IndustrySnapshot {
    const n = this.nations.get(tag) ?? this.nations.get('GER')!;
    const milAssigned = EQUIPMENT_LIST.reduce((s, k) => s + (EQUIPMENT_SPECS[k].factoryKind === 'MIL' ? n.lines[k].factories : 0), 0);
    const docAssigned = n.lines.CONVOY.factories;
    const lines: ProductionLineSnap[] = EQUIPMENT_LIST.map((eq) => {
      const l = n.lines[eq];
      const sp = EQUIPMENT_SPECS[eq];
      return {
        type: eq,
        factories: l.factories,
        masteryPermille: Math.round(l.masteryMicro / 1000),
        masteryMaxPermille: Math.round(l.masteryMaxMicro / 1000),
        dailyUnitsFixed: l.lastDailyUnitsFixed,
        stockpileFixed: l.stockpileFixed,
        resourceMultPermille: l.lastResourceMultPermille,
        needSteel: l.factories * sp.steelPerFac,
        needOil: l.factories * sp.oilPerFac,
        needRare: l.factories * sp.rarePerFac,
      };
    });

    const queue: ConstructionProjectSnap[] = n.queue.map((p) => {
      const reg = this.regionById.get(p.regionId);
      const rem = Math.max(0, p.costFixed - p.progressFixed);
      const etaDays = p.lastDailyCpFixed > 0 ? Math.ceil(rem / p.lastDailyCpFixed) : -1;
      return {
        id: p.id,
        regionId: p.regionId,
        regionNameZh: reg?.nameZh ?? `#${p.regionId}`,
        building: p.building,
        progressFixed: p.progressFixed,
        costFixed: p.costFixed,
        assignedCiv: p.lastAssignedCiv,
        dailyCpFixed: p.lastDailyCpFixed,
        etaDays,
      };
    });

    const activeByRegion = new Map<number, { building: BuildingType; progressPermille: number; count: number }>();
    for (const p of n.queue) {
      const prev = activeByRegion.get(p.regionId);
      if (!prev) {
        activeByRegion.set(p.regionId, {
          building: p.building,
          progressPermille: Math.min(1000, Math.floor((p.progressFixed * 1000) / Math.max(1, p.costFixed))),
          count: 1,
        });
      } else {
        prev.count += 1;
      }
    }

    const regions: RegionDynamicSnap[] = this.regions.map((r) => {
      const act = r.owner === n.tag ? activeByRegion.get(r.id) : undefined;
      return {
        id: r.id,
        owner: r.owner,
        civ: r.civ,
        mil: r.mil,
        doc: r.doc,
        synth: r.synth,
        infra: r.infra,
        slots: r.slots,
        steel: r.baseSteel,
        oil: r.baseOil + r.synth * SYNTH_OIL_BONUS,
        rare: r.baseRare,
        activeBuilding: act?.building ?? null,
        activeProgressPermille: act?.progressPermille ?? 0,
        queuedCount: act?.count ?? 0,
      };
    });

    return {
      tag: n.tag,
      economyLaw: n.economyLaw,
      consumerGoodsPermille: CONSUMER_GOODS_PERMILLE[n.economyLaw],
      civTotal: n.civTotal,
      civConsumer: n.civConsumer,
      civTrade: n.civTrade,
      civBuild: n.civBuild,
      civIdle: n.civIdle,
      milTotal: n.milTotal,
      milAssigned,
      docTotal: n.docTotal,
      docAssigned,
      convoysTotal: Math.floor(n.lines.CONVOY.stockpileFixed / FIXED_SCALE),
      convoysUsed: n.convoysUsed,
      autoTrade: n.autoTrade,
      resources: {
        steel: { ...n.resources.steel },
        oil: { ...n.resources.oil },
        rare: { ...n.resources.rare },
      },
      lines,
      queue,
      deals: n.deals.slice(),
      regions,
    };
  }

  mixHash(mix: (v: number) => void): void {
    for (const r of this.regions) {
      mix(r.id + (r.civ << 8) + (r.mil << 16) + (r.doc << 24));
      mix(r.infra + (r.synth << 8));
    }
    for (const tag of this.nationOrder) {
      const n = this.nations.get(tag)!;
      mix((n.autoTrade ? 1 : 0) + (n.civTrade << 4) + (n.civBuild << 12) + (n.civIdle << 20));
      for (const eq of EQUIPMENT_LIST) {
        const l = n.lines[eq];
        mix(l.factories ^ l.masteryMicro);
        mix(l.stockpileFixed);
      }
      mix(n.queue.length);
      for (const p of n.queue) {
        mix(p.id + (p.regionId << 10));
        mix(p.progressFixed);
      }
    }
  }

  private applyCompletedBuilding(reg: RegionState, building: BuildingType): void {
    if (building === 'CIV') reg.civ += 1;
    else if (building === 'MIL') reg.mil += 1;
    else if (building === 'DOC') reg.doc += 1;
    else if (building === 'INFRA') reg.infra = Math.min(5, reg.infra + 1);
    else if (building === 'SYNTH') reg.synth += 1;
  }

  private aggregateRegions(): Map<string, { civ: number; mil: number; doc: number; steel: number; oil: number; rare: number; hasCoastal: boolean }> {
    const out = new Map<string, { civ: number; mil: number; doc: number; steel: number; oil: number; rare: number; hasCoastal: boolean }>();
    for (const tag of this.nationOrder) {
      out.set(tag, { civ: 0, mil: 0, doc: 0, steel: 0, oil: 0, rare: 0, hasCoastal: false });
    }
    for (const r of this.regions) {
      const acc = out.get(r.owner);
      if (!acc) continue;
      acc.civ += r.civ;
      acc.mil += r.mil;
      acc.doc += r.doc;
      acc.steel += r.baseSteel;
      acc.oil += r.baseOil + r.synth * SYNTH_OIL_BONUS;
      acc.rare += r.baseRare;
      if (r.isCoastal) acc.hasCoastal = true;
    }
    return out;
  }

  private calcLineDemand(n: NationIndustryState): Record<ResourceType, number> {
    let steel = 0, oil = 0, rare = 0;
    for (const eq of EQUIPMENT_LIST) {
      const f = n.lines[eq].factories;
      if (f <= 0) continue;
      const sp = EQUIPMENT_SPECS[eq];
      steel += f * sp.steelPerFac;
      oil += f * sp.oilPerFac;
      rare += f * sp.rarePerFac;
    }
    return { steel, oil, rare };
  }

  private clampLineFactoriesToTotals(n: NationIndustryState): void {
    let milUsed = 0;
    for (const eq of EQUIPMENT_LIST) {
      if (EQUIPMENT_SPECS[eq].factoryKind !== 'MIL') continue;
      milUsed += n.lines[eq].factories;
    }
    if (milUsed > n.milTotal) {
      let over = milUsed - n.milTotal;
      for (let i = EQUIPMENT_LIST.length - 1; i >= 0 && over > 0; i--) {
        const eq = EQUIPMENT_LIST[i]!;
        if (EQUIPMENT_SPECS[eq].factoryKind !== 'MIL') continue;
        const cut = Math.min(over, n.lines[eq].factories);
        n.lines[eq].factories -= cut;
        over -= cut;
      }
    }
    if (n.lines.CONVOY.factories > n.docTotal) {
      n.lines.CONVOY.factories = n.docTotal;
    }
  }
}
