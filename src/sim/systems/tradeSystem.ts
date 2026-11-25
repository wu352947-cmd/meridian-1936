/**
 * Pure deterministic Auto-Trade & Resource Market Resolver (Carbon §4.6).
 * 1 CIV buys up to 8 units of a resource; overland trade requires 0 convoys,
 * cross-sea trade requires 2 convoys per 8-unit lot. Hostile nations cannot trade.
 */
import { LAND_ADJACENCY_1936 } from '../data/regions1936';
import {
  SEA_CONVOYS_PER_LOT,
  TRADE_UNITS_PER_CIV,
  type ResourceType,
  type TradeDeal,
} from './industryTypes';

export interface TradeNationInput {
  tag: string;
  autoTrade: boolean;
  usableCiv: number;
  convoysTotal: number;
  hasCoastal: boolean;
  prod: Record<ResourceType, number>;
  demand: Record<ResourceType, number>;
}

export interface TradeNationResult {
  imported: Record<ResourceType, number>;
  exported: Record<ResourceType, number>;
  tradeCiv: number;
  convoysUsed: number;
  deals: TradeDeal[];
}

type Bloc = 'allies' | 'axis' | 'comintern' | 'neutral';

const NATION_BLOC: Record<string, Bloc> = {
  GER: 'axis', ITA: 'axis', HUN: 'axis',
  GBR: 'allies', FRA: 'allies',
  SOV: 'comintern',
};

const RIVAL_PAIRS = new Set<string>([
  'GER:SOV', 'SOV:GER', 'GER:FRA', 'FRA:GER', 'GER:GBR', 'GBR:GER',
  'ITA:GBR', 'GBR:ITA', 'ITA:FRA', 'FRA:ITA', 'POL:SOV', 'SOV:POL',
]);

function pairKey(a: string, b: string): string {
  return `${a}:${b}`;
}

function buildLandComponents(
  tags: readonly string[],
  hostilePairs: ReadonlySet<string>,
): Map<string, number> {
  const comp = new Map<string, number>();
  let nextId = 1;
  for (const start of tags) {
    if (comp.has(start)) continue;
    const id = nextId++;
    comp.set(start, id);
    const q: string[] = [start];
    while (q.length > 0) {
      const cur = q.shift()!;
      for (const nb of LAND_ADJACENCY_1936[cur] ?? []) {
        if (comp.has(nb) || hostilePairs.has(pairKey(cur, nb))) continue;
        comp.set(nb, id);
        q.push(nb);
      }
    }
  }
  return comp;
}

export function isLandConnected(
  fromTag: string,
  toTag: string,
  hostilePairs: ReadonlySet<string>,
): boolean {
  if (fromTag === toTag) return true;
  const visited = new Set<string>([fromTag]);
  const queue: string[] = [fromTag];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const nbrs = LAND_ADJACENCY_1936[cur] ?? [];
    for (const nb of nbrs) {
      if (visited.has(nb)) continue;
      if (hostilePairs.has(pairKey(fromTag, nb))) continue;
      if (nb === toTag) return true;
      visited.add(nb);
      queue.push(nb);
    }
  }
  return false;
}

export function tradeRelationScore(a: string, b: string, isLand: boolean): number {
  const ba: Bloc = NATION_BLOC[a] ?? 'neutral';
  const bb: Bloc = NATION_BLOC[b] ?? 'neutral';
  let score = 0;
  if (ba === bb && ba !== 'neutral') score += 50;
  else if (bb === 'neutral') score += 25;
  else if (RIVAL_PAIRS.has(pairKey(a, b))) score -= 30;
  else score += 5;
  if (isLand) score += 40;
  return score;
}

const RESOURCE_ORDER: readonly ResourceType[] = ['oil', 'rare', 'steel'];

export function resolveDailyTrade(
  inputs: readonly TradeNationInput[],
  hostilePairs: ReadonlySet<string> = new Set(),
): Map<string, TradeNationResult> {
  const results = new Map<string, TradeNationResult>();
  const surplus = new Map<string, Record<ResourceType, number>>();
  const hasHostiles = hostilePairs.size > 0;
  const landComp = hasHostiles ? null : buildLandComponents(inputs.map((i) => i.tag), hostilePairs);

  for (const inp of inputs) {
    results.set(inp.tag, {
      imported: { steel: 0, oil: 0, rare: 0 },
      exported: { steel: 0, oil: 0, rare: 0 },
      tradeCiv: 0,
      convoysUsed: 0,
      deals: [],
    });
    surplus.set(inp.tag, {
      steel: Math.max(0, inp.prod.steel - inp.demand.steel),
      oil: Math.max(0, inp.prod.oil - inp.demand.oil),
      rare: Math.max(0, inp.prod.rare - inp.demand.rare),
    });
  }

  for (const buyer of inputs) {
    if (!buyer.autoTrade || buyer.usableCiv <= 0) continue;
    const bRes = results.get(buyer.tag)!;
    let remCiv = buyer.usableCiv;
    let remConvoys = buyer.convoysTotal;

    for (const res of RESOURCE_ORDER) {
      let deficit = buyer.demand[res] - buyer.prod[res] - bRes.imported[res];
      if (deficit <= 0 || remCiv <= 0) continue;

      const candidates: Array<{ tag: string; avail: number; isSea: boolean; score: number }> = [];
      for (const seller of inputs) {
        if (seller.tag === buyer.tag) continue;
        if (hostilePairs.has(pairKey(buyer.tag, seller.tag))) continue;
        const avail = surplus.get(seller.tag)![res];
        if (avail <= 0) continue;
        const land = landComp
          ? landComp.get(buyer.tag) === landComp.get(seller.tag)
          : isLandConnected(buyer.tag, seller.tag, hostilePairs);
        if (!land && (!buyer.hasCoastal || !seller.hasCoastal || remConvoys < SEA_CONVOYS_PER_LOT)) {
          continue;
        }
        const fullLotBonus = avail >= TRADE_UNITS_PER_CIV ? 35 : 0;
        candidates.push({
          tag: seller.tag,
          avail,
          isSea: !land,
          score: tradeRelationScore(buyer.tag, seller.tag, land) + fullLotBonus,
        });
      }

      candidates.sort((a, b) => b.score - a.score || b.avail - a.avail || a.tag.localeCompare(b.tag));

      for (const cand of candidates) {
        if (deficit <= 0 || remCiv <= 0) break;
        const curAvail = surplus.get(cand.tag)![res];
        if (curAvail <= 0) continue;
        const maxConvoyLots = cand.isSea ? Math.floor(remConvoys / SEA_CONVOYS_PER_LOT) : remCiv;
        if (maxConvoyLots <= 0) continue;

        const neededLots = Math.ceil(deficit / TRADE_UNITS_PER_CIV);
        const availLots = Math.ceil(curAvail / TRADE_UNITS_PER_CIV);
        const lots = Math.min(neededLots, availLots, remCiv, maxConvoyLots);
        if (lots <= 0) continue;

        const amount = Math.min(curAvail, lots * TRADE_UNITS_PER_CIV);
        const convoys = cand.isSea ? lots * SEA_CONVOYS_PER_LOT : 0;

        surplus.get(cand.tag)![res] -= amount;
        bRes.imported[res] += amount;
        bRes.tradeCiv += lots;
        bRes.convoysUsed += convoys;
        remCiv -= lots;
        remConvoys -= convoys;
        deficit -= amount;

        const sRes = results.get(cand.tag)!;
        sRes.exported[res] += amount;

        const deal: TradeDeal = {
          importerTag: buyer.tag,
          exporterTag: cand.tag,
          resource: res,
          amount,
          civCost: lots,
          convoys,
          isSea: cand.isSea,
        };
        bRes.deals.push(deal);
        sRes.deals.push(deal);
      }
    }
  }

  return results;
}
