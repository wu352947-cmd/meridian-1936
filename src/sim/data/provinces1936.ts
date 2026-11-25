/**
 * Pure deterministic 1936 land-province graph for src/sim/ (zero DOM/PIXI/fetch).
 */
import rawData from './provinces1936.json';
import type { LandTerrainType } from './brigadeTemplates';

export interface SimProvince {
  id: number;
  owner: string;
  terrain: LandTerrainType;
  cx: number;
  cy: number;
  vp: number;
  isCapital: boolean;
  isCoastal: boolean;
  nameZh: string;
  neighbors: readonly number[];
}

type RawRow = [number, string, LandTerrainType, number, number, number, number, number, string, number[]];

const ROWS = (rawData as unknown as { provinces: RawRow[] }).provinces;

export const SIM_PROVINCES: readonly SimProvince[] = ROWS.map((r) => ({
  id: r[0],
  owner: r[1],
  terrain: r[2],
  cx: r[3],
  cy: r[4],
  vp: r[5],
  isCapital: r[6] === 1,
  isCoastal: r[7] === 1,
  nameZh: r[8],
  neighbors: r[9],
}));

const PROV_BY_ID = new Map<number, SimProvince>();
const PROVS_BY_OWNER = new Map<string, SimProvince[]>();
const CAPITAL_BY_OWNER = new Map<string, SimProvince>();

for (const p of SIM_PROVINCES) {
  PROV_BY_ID.set(p.id, p);
  const list = PROVS_BY_OWNER.get(p.owner) ?? [];
  list.push(p);
  PROVS_BY_OWNER.set(p.owner, list);
  if (p.isCapital && !CAPITAL_BY_OWNER.has(p.owner)) {
    CAPITAL_BY_OWNER.set(p.owner, p);
  }
}

// Fallback capital (e.g. SWI) -> highest VP province, then smallest ID
for (const [owner, list] of PROVS_BY_OWNER.entries()) {
  if (!CAPITAL_BY_OWNER.has(owner) && list.length > 0) {
    const best = [...list].sort((a, b) => (b.vp - a.vp) || (a.id - b.id))[0]!;
    CAPITAL_BY_OWNER.set(owner, best);
  }
}

export function getSimProvince(provId: number): SimProvince | null {
  return PROV_BY_ID.get(provId) ?? null;
}

export function getOwnerProvinces(tag: string): readonly SimProvince[] {
  return PROVS_BY_OWNER.get(tag) ?? [];
}

export function getCapitalProvince(tag: string): SimProvince | null {
  return CAPITAL_BY_OWNER.get(tag) ?? null;
}

export function getLandNeighborTags(tag: string): string[] {
  const seen = new Set<string>();
  for (const p of getOwnerProvinces(tag)) {
    for (const nid of p.neighbors) {
      const nb = PROV_BY_ID.get(nid);
      if (nb && nb.owner !== tag && nb.owner !== 'EDG' && nb.owner !== 'SEA') {
        seen.add(nb.owner);
      }
    }
  }
  return [...seen].sort();
}
