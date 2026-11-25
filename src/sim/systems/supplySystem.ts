/**
 * Deterministic Multi-Source Dijkstra Supply Network (Carbon §4.10 / Batch 07 §1).
 * Flat TypedArray CSR graph + binary max-heap -> recomputes all 676 provinces in < 0.2 ms.
 * Pure TypeScript — zero DOM/PIXI dependencies.
 */
import { clampInt, FIXED_SCALE, mulFixed } from '../core/FixedMath';
import { getSimProvince, SIM_PROVINCES } from '../data/provinces1936';
import { getRegionDefByProvince } from '../data/regions1936';
import {
  calcPortSupplyValue,
  CAPITAL_SUPPLY_VALUE,
  CORE_CITY_SUPPLY_VALUE,
  IS_CAPITAL_PROV,
  IS_CORE_CITY_PROV,
  MAX_SIM_PROV_ID,
  PORT_LEVEL_BY_PROV,
  type SupplySourceKind,
} from '../data/supplySources1936';
import {
  calcSupplyCap,
  SUPPLY_DEFINES,
  SUPPLY_INFRA_MULT_PERMILLE,
  SUPPLY_TERRAIN_COST,
  type ActiveSupplyHubSnap,
} from './supplyTypes';

const N_PROVS = SIM_PROVINCES.length;
const PROV_ID_TO_IDX = new Int16Array(MAX_SIM_PROV_ID + 1).fill(-1);
const IDX_TO_PROV_ID = new Uint16Array(N_PROVS);
const BASE_TERRAIN_MILLI = new Int32Array(N_PROVS);
const PROV_REGION_ID = new Int16Array(N_PROVS);
const PROV_OWNER_STR: string[] = new Array(N_PROVS);
const ADJ_START = new Uint16Array(N_PROVS + 1);
const ADJ_LIST: number[] = [];

for (let i = 0; i < N_PROVS; i++) {
  const p = SIM_PROVINCES[i]!;
  PROV_ID_TO_IDX[p.id] = i;
  IDX_TO_PROV_ID[i] = p.id;
  BASE_TERRAIN_MILLI[i] = (SUPPLY_TERRAIN_COST[p.terrain] ?? 10) * SUPPLY_DEFINES.milliScale;
  PROV_REGION_ID[i] = getRegionDefByProvince(p.id)?.id ?? -1;
  PROV_OWNER_STR[i] = p.owner;
  ADJ_START[i] = ADJ_LIST.length;
  for (const nb of p.neighbors) ADJ_LIST.push(nb);
}
ADJ_START[N_PROVS] = ADJ_LIST.length;

const ADJ_IDX = new Uint16Array(ADJ_LIST.length);
for (let i = 0; i < ADJ_LIST.length; i++) {
  const idx = PROV_ID_TO_IDX[ADJ_LIST[i]!] ?? -1;
  ADJ_IDX[i] = idx >= 0 ? idx : 0xffff;
}

export interface SupplyRecomputeContext {
  tick: number;
  getController: (provId: number) => string;
  getRegionInfra: (regionId: number) => number;
  areAllies?: (tagA: string, tagB: string) => boolean;
  /** Optional port convoy efficiency permille (0..1000, defaults to 1000 until Batch 10 Navy). */
  getPortConvoyEfficiency?: (provId: number, controller: string) => number;
  /** Optional resistance permille (0..1000) for Batch 10 occupation penalty (+4 if >=300). */
  getProvinceResistance?: (provId: number) => number;
  /** Nations whose active motorized-supply armies are funded with trucks (-3 impedance). */
  motorizedTags?: ReadonlySet<string>;
}

/** Multi-source Dijkstra state & fast TypedArray buffers (reused with zero GC per call). */
export class SupplyNetwork {
  readonly supplyByProv = new Uint8Array(MAX_SIM_PROV_ID + 1);
  readonly supplyMilliByIdx = new Int32Array(N_PROVS);
  readonly capByProv = new Uint8Array(MAX_SIM_PROV_ID + 1);
  private readonly occupiedSinceTick = new Map<number, number>();
  private readonly portOverride = new Map<number, number>();
  private readonly ctrlCache: string[] = new Array(N_PROVS);
  private readonly hopCostCache = new Int32Array(N_PROVS);
  private readonly heapNode = new Int32Array(N_PROVS * 4 + 16);
  private readonly heapVal = new Int32Array(N_PROVS * 4 + 16);
  private activeHubs: ActiveSupplyHubSnap[] = [];

  reset(): void {
    this.supplyByProv.fill(0);
    this.supplyMilliByIdx.fill(0);
    this.capByProv.fill(1);
    this.occupiedSinceTick.clear();
    this.portOverride.clear();
    this.activeHubs = [];
  }

  /** Record the exact tick when a province becomes newly occupied (starts 14-day +8 penalty). */
  markOccupied(provId: number, tick: number): void {
    this.occupiedSinceTick.set(provId, tick);
  }

  clearOccupied(provId: number): void {
    this.occupiedSinceTick.delete(provId);
  }

  getOccupiedSinceTick(provId: number): number | undefined {
    return this.occupiedSinceTick.get(provId);
  }

  /** Test & scenario hook to override port level (0..5) on any province. */
  setPortLevelOverride(provId: number, level: number): void {
    this.portOverride.set(provId, clampInt(Math.trunc(level), 0, 5));
  }

  getEffectivePortLevel(provId: number): number {
    const ov = this.portOverride.get(provId);
    if (ov !== undefined) return ov;
    return provId >= 0 && provId <= MAX_SIM_PROV_ID ? (PORT_LEVEL_BY_PROV[provId] ?? 0) : 0;
  }

  /** Recompute full-map multi-source Dijkstra supply values in O((V + E) log V), < 0.2 ms. */
  recompute(ctx: SupplyRecomputeContext): void {
    const best = this.supplyMilliByIdx;
    best.fill(0);
    const hubs: ActiveSupplyHubSnap[] = [];
    let heapSize = 0;
    const hNode = this.heapNode;
    const hVal = this.heapVal;

    const push = (idx: number, val: number): void => {
      let i = heapSize++;
      hNode[i] = idx;
      hVal[i] = val;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hVal[p]! >= hVal[i]!) break;
        const tn = hNode[p]!; const tv = hVal[p]!;
        hNode[p] = hNode[i]!; hVal[p] = hVal[i]!;
        hNode[i] = tn; hVal[i] = tv;
        i = p;
      }
    };

    // Pass 1: cache controllers, per-province hop impedance, and seed all active supply hubs
    for (let i = 0; i < N_PROVS; i++) {
      const pid = IDX_TO_PROV_ID[i]!;
      const ctrl = ctx.getController(pid);
      this.ctrlCache[i] = ctrl;
      const nativeOwner = PROV_OWNER_STR[i]!;

      // Track occupation timestamp lazily if control changed outside explicit hook
      if (ctrl !== nativeOwner) {
        if (!this.occupiedSinceTick.has(pid)) this.occupiedSinceTick.set(pid, ctx.tick);
      } else if (this.occupiedSinceTick.has(pid)) {
        this.occupiedSinceTick.delete(pid);
      }

      // Edge impedance Cost(v) = BaseTerrain / InfraMult + OccupationPenalty - TruckBonus
      const regId = PROV_REGION_ID[i]!;
      const infra = regId >= 0 ? clampInt(ctx.getRegionInfra(regId), 1, 5) : 2;
      const infraMult = SUPPLY_INFRA_MULT_PERMILLE[infra] ?? FIXED_SCALE;
      let costMilli = Math.floor((BASE_TERRAIN_MILLI[i]! * FIXED_SCALE) / infraMult);

      const occTick = this.occupiedSinceTick.get(pid);
      if (occTick !== undefined && ctx.tick - occTick < SUPPLY_DEFINES.recentOccupationTicks) {
        costMilli += SUPPLY_DEFINES.recentOccupationPenalty * SUPPLY_DEFINES.milliScale;
      }
      if (ctx.getProvinceResistance && ctx.getProvinceResistance(pid) >= 300) {
        costMilli += SUPPLY_DEFINES.highResistancePenalty * SUPPLY_DEFINES.milliScale;
      }
      if (ctx.motorizedTags && ctx.motorizedTags.has(ctrl)) {
        costMilli -= SUPPLY_DEFINES.truckBonus * SUPPLY_DEFINES.milliScale;
      }
      this.hopCostCache[i] = Math.max(SUPPLY_DEFINES.minHopCostMilli, costMilli);

      // Evaluate supply sources: capital (100), native VP>=15 core city (85), friendly port (35+13*L)
      let srcS = 0;
      let kind: SupplySourceKind | null = null;
      const portLvl = this.getEffectivePortLevel(pid);
      if (IS_CAPITAL_PROV[pid] === 1 && ctrl === nativeOwner) {
        srcS = CAPITAL_SUPPLY_VALUE;
        kind = 'capital';
      } else if (IS_CORE_CITY_PROV[pid] === 1 && ctrl === nativeOwner) {
        srcS = CORE_CITY_SUPPLY_VALUE;
        kind = 'core_city';
      }
      if (portLvl > 0) {
        const eff = ctx.getPortConvoyEfficiency ? clampInt(ctx.getPortConvoyEfficiency(pid, ctrl), 0, FIXED_SCALE) : FIXED_SCALE;
        const portS = mulFixed(calcPortSupplyValue(portLvl), eff);
        if (portS > srcS) {
          srcS = portS;
          kind = kind ?? 'port';
        }
      }
      if (srcS > 0 && kind !== null) {
        const milli = srcS * SUPPLY_DEFINES.milliScale;
        best[i] = milli;
        push(i, milli);
        const sp = getSimProvince(pid)!;
        hubs.push({
          provId: pid, controller: ctrl, kind, portLevel: portLvl,
          effectiveSupply: srcS, nameZh: sp.nameZh, cx: sp.cx, cy: sp.cy,
        });
      }
    }

    // Pass 2: max-supply multi-source Dijkstra propagation across own & allied provinces
    const canShare = ctx.areAllies;
    while (heapSize > 0) {
      const u = hNode[0]!;
      const curS = hVal[0]!;
      heapSize -= 1;
      if (heapSize > 0) {
        hNode[0] = hNode[heapSize]!;
        hVal[0] = hVal[heapSize]!;
        let i = 0;
        while (true) {
          const l = (i << 1) + 1;
          const r = l + 1;
          let lg = i;
          if (l < heapSize && hVal[l]! > hVal[lg]!) lg = l;
          if (r < heapSize && hVal[r]! > hVal[lg]!) lg = r;
          if (lg === i) break;
          const tn = hNode[i]!; const tv = hVal[i]!;
          hNode[i] = hNode[lg]!; hVal[i] = hVal[lg]!;
          hNode[lg] = tn; hVal[lg] = tv;
          i = lg;
        }
      }
      if (curS < best[u]!) continue;
      const uCtrl = this.ctrlCache[u]!;
      const start = ADJ_START[u]!;
      const end = ADJ_START[u + 1]!;
      for (let e = start; e < end; e++) {
        const v = ADJ_IDX[e]!;
        if (v === 0xffff) continue;
        const vCtrl = this.ctrlCache[v]!;
        if (vCtrl !== uCtrl && !(canShare && canShare(uCtrl, vCtrl))) continue;
        const nextS = curS - this.hopCostCache[v]!;
        if (nextS > best[v]!) {
          best[v] = nextS;
          push(v, nextS);
        }
      }
    }

    // Pass 3: write integer S_p in [0..100] and Cap_p = max(1, floor(S_p / 15))
    this.supplyByProv.fill(0);
    this.capByProv.fill(1);
    for (let i = 0; i < N_PROVS; i++) {
      const pid = IDX_TO_PROV_ID[i]!;
      const s = clampInt(Math.round(best[i]! / SUPPLY_DEFINES.milliScale), 0, SUPPLY_DEFINES.maxSupply);
      this.supplyByProv[pid] = s;
      this.capByProv[pid] = calcSupplyCap(s);
    }
    this.activeHubs = hubs;
  }

  getSupply(provId: number): number {
    return provId >= 0 && provId <= MAX_SIM_PROV_ID ? (this.supplyByProv[provId] ?? 0) : 0;
  }

  getCap(provId: number): number {
    return provId >= 0 && provId <= MAX_SIM_PROV_ID ? (this.capByProv[provId] ?? 1) : 1;
  }

  getActiveHubs(): readonly ActiveSupplyHubSnap[] {
    return this.activeHubs;
  }

  mixHash(mix: (v: number) => void): void {
    let acc = 0;
    for (let i = 0; i < N_PROVS; i++) {
      const pid = IDX_TO_PROV_ID[i]!;
      acc = (Math.imul(acc, 31) + this.supplyByProv[pid]!) | 0;
    }
    mix(acc);
    mix(this.occupiedSinceTick.size + (this.activeHubs.length << 12));
  }
}
